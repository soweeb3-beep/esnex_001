const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { getModel } = require("../config/adapter");

const debugFile = path.join(__dirname, '../access-middleware-debug.log');
const appendAccessDebug = (message) => {
  try {
    fs.appendFileSync(debugFile, `${new Date().toISOString()} - ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Failed to append access middleware debug log', err && err.message);
  }
};

appendAccessDebug('accessMiddleware module loaded');

const getEnrollment = () => getModel("Enrollment");
const getAssessmentEnrollment = () => getModel("AssessmentEnrollment");
const getPayment = () => getModel("Payment");
const getCourse = () => getModel("Course");

const isPaymentVerified = async (paymentId) => {
  const debugPrefix = `[isPaymentVerified] paymentId=${paymentId}`;
  appendAccessDebug(`${debugPrefix} start`);
  if (!paymentId) {
    appendAccessDebug(`${debugPrefix} missing paymentId`);
    return false;
  }
  const Payment = getPayment();
  appendAccessDebug(`${debugPrefix} Payment model type=${typeof Payment}`);
  try {
    appendAccessDebug(`${debugPrefix} calling Payment.findById`);
    const queryOrPromise = Payment.findById ? Payment.findById(paymentId) : null;
    appendAccessDebug(`${debugPrefix} queryOrPromise type=${typeof queryOrPromise}`);
    let p = null;
    if (queryOrPromise) {
      if (typeof queryOrPromise.lean === "function") {
        p = await queryOrPromise.lean();
      } else {
        p = await queryOrPromise;
      }
    }
    appendAccessDebug(`${debugPrefix} result=${p ? JSON.stringify({ _id: p._id, status: p.status, verificationStatus: p.verificationStatus }) : 'null'}`);
    return !!(p && p.status === "completed" && p.verificationStatus === "verified");
  } catch (e) {
    appendAccessDebug(`${debugPrefix} error=${e && e.message}`);
    appendAccessDebug(`${debugPrefix} stack=${e && e.stack}`);
    console.error('isPaymentVerified helper error:', e && e.message ? e.message : e, e.stack);
    return false;
  }
};

// Middleware: check course access for routes that require a paid/full course
const checkCourseAccess = async (req, res, next) => {
  console.log('[checkCourseAccess MIDDLEWARE START]');
  try {
    const courseId = req.params.courseId || req.params.id || req.body.courseId || req.query.courseId;
    const userId = req.user?.id || req.user?._id;

    console.log('[checkCourseAccess] courseId:', courseId, 'userId:', userId);

    if (!courseId || !userId) {
      console.log('[checkCourseAccess] Missing courseId or userId');
      return res.status(401).json({ message: "Missing or unauthenticated user" });
    }

    const Course = getCourse();
    console.log('[checkCourseAccess] Getting course with findById:', courseId);
    let query = Course.findById(courseId);
    // Safe query handling: avoid calling .lean() on mock models
    if (typeof query.lean === 'function') {
      query = query.lean();
    }
    const course = await query;
    console.log('[checkCourseAccess] course found:', !!course, course ? { _id: course._id, price: course.price } : null);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Free course -> allow
    if (!course.price || Number(course.price) === 0) {
      console.log('[checkCourseAccess] Course is free, allowing access');
      return next();
    }

    const Enrollment = getEnrollment();
    console.log('[checkCourseAccess] Getting enrollment for student:', userId, 'course:', courseId);
    const enrollment = await Enrollment.findOne({ student: userId, course: courseId });
    console.log('[checkCourseAccess] enrollment:', !!enrollment, enrollment ? { _id: enrollment._id, paymentId: enrollment.paymentId, paymentReference: enrollment.paymentReference, paymentStatus: enrollment.paymentStatus } : null);
    if (!enrollment) return res.status(403).json({ message: "Not enrolled in this course", requiresPayment: true });

    // If enrollment has a linked paymentId, ensure it's verified
    if (enrollment.paymentId) {
      console.log('[checkCourseAccess] Checking payment verification for paymentId:', enrollment.paymentId);
      const ok = await isPaymentVerified(enrollment.paymentId);
      console.log('[checkCourseAccess] Payment verified:', ok);
      if (!ok) return res.status(403).json({ message: "Payment not verified for this enrollment" });
      return next();
    }

    // Fall back: if enrollment.paymentStatus indicates paid, still require a verification check via paymentReference
    if (enrollment.paymentReference) {
      console.log('[checkCourseAccess] Checking payment by reference:', enrollment.paymentReference);
      const Payment = getPayment();
      try {
        const q = Payment.findOne ? Payment.findOne({ paymentId: enrollment.paymentReference }) : null;
        const p = q ? (typeof q.lean === 'function' ? await q.lean() : await q) : null;
        if (p && p.status === "completed" && p.verificationStatus === "verified") {
          console.log('[checkCourseAccess] Payment verified via reference, allowing access');
          return next();
        }
      } catch (e) {
        console.error('Payment lookup error in access check fallback:', e && e.message ? e.message : e);
      }
    }

    return res.status(403).json({ message: "Payment verification required for course access" });
  } catch (err) {
    console.error("checkCourseAccess error:", err);
    return res.status(500).json({ message: "Access check failed", error: err.message, stack: err.stack ? err.stack.split('\n').slice(0,5) : undefined });
  }
};

const resolveAssessmentForAccess = async (req) => {
  try {
    const assessmentId = req.params.assessmentId || req.params.id || req.body.assessmentId || req.query.assessmentId || req.body.id || req.query.id;
    const subject = req.params.subject || req.body.subject || req.query.subject;
    appendAccessDebug(`[resolveAssessmentForAccess] assessmentId=${assessmentId} subject=${subject}`);
    const Assessment = getModel("Assessment");

    if (assessmentId) {
      const assess = await Assessment.findById(assessmentId);
      if (assess) {
        return { assessment: assess, assessmentId: String(assess._id || assess.id || assessmentId) };
      }
    }

    if (subject) {
      const normalizedSubject = String(subject || "").trim();
      if (normalizedSubject) {
        const esc = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&");
        const queryObj = {
          type: "global",
          visibility: true,
          status: "published",
          $or: [
            { subject: normalizedSubject },
            { subject: { $regex: new RegExp(`^${esc(normalizedSubject)}$`, "i") } },
            { name: { $regex: new RegExp(`^${esc(normalizedSubject)}$`, "i") } },
            { displayName: { $regex: new RegExp(`^${esc(normalizedSubject)}$`, "i") } },
          ],
        };

        // Prefer paid variant: try to sort by price desc when supported by the model/query
        let assess = null;
        try {
          const q = Assessment.findOne ? Assessment.findOne(queryObj) : null;
          if (q && typeof q.sort === 'function') {
            const q2 = q.sort({ price: -1 });
            assess = typeof q2.lean === 'function' ? await q2.lean() : await q2;
          } else {
            // Fallback for mock DB: fetch all matching and pick highest price
            const all = Assessment.find ? await (typeof Assessment.find === 'function' ? Assessment.find(queryObj) : []) : [];
            if (Array.isArray(all) && all.length > 0) {
              assess = all.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))[0];
            } else if (all && !Array.isArray(all)) {
              assess = all;
            }
          }
        } catch (e) {
          appendAccessDebug(`[resolveAssessmentForAccess] subjectLookup error=${e && e.message}`);
          assess = null;
        }
        appendAccessDebug(`[resolveAssessmentForAccess] subjectLookup result=${assess ? String(assess._id || assess.id) : 'null'}`);
        if (assess) {
          return { assessment: assess, assessmentId: String(assess._id || assess.id) };
        }
      }
    }

    return { assessment: null, assessmentId: null };
  } catch (error) {
    console.error("resolveAssessmentForAccess error:", error);
    return { assessment: null, assessmentId: null };
  }
};

// Middleware: check assessment access (global or course assessment)
const checkAssessmentAccess = async (req, res, next) => {
  console.log('[checkAssessmentAccess] start', { method: req.method, url: req.originalUrl, params: req.params, query: req.query, body: req.body });
  appendAccessDebug(`[checkAssessmentAccess] start method=${req.method} url=${req.originalUrl} params=${JSON.stringify(req.params)}`);
  try {
    const userId = req.user?.id || req.user?._id;
    console.log('[checkAssessmentAccess] userId=', userId);
    appendAccessDebug(`[checkAssessmentAccess] userId=${userId}`);
    if (!userId) return res.status(401).json({ message: "Missing or unauthenticated user" });

    const { assessment, assessmentId: resolvedAssessmentId } = await resolveAssessmentForAccess(req);
    console.log('[checkAssessmentAccess] resolvedAssessmentId=', resolvedAssessmentId, 'assessment=', assessment ? { _id: assessment._id, subject: assessment.subject, price: assessment.price, type: assessment.type } : null);

    if (!resolvedAssessmentId) {
      const hasAssessmentReference = Boolean(req.params.assessmentId || req.params.id || req.body.assessmentId || req.query.assessmentId || req.body.id || req.query.id || req.params.subject || req.body.subject || req.query.subject || req.params.subject || req.body.subject || req.query.subject);
      if (hasAssessmentReference) {
        console.log('[checkAssessmentAccess] assessment reference found but not resolved');
        return res.status(404).json({ message: "Assessment not found" });
      }
      console.log('[checkAssessmentAccess] no assessment reference, allowing');
      return next();
    }

    const AssessmentEnrollment = getAssessmentEnrollment();
    const enrollment = await AssessmentEnrollment.findOne({ assessmentId: resolvedAssessmentId, studentId: userId });

    if (!enrollment) {
      if (assessment && (assessment.price === 0 || assessment.price === undefined)) {
        return next();
      }
      return res.status(402).json({
        message: "Enrollment required. Please complete payment.",
        requiresPayment: true,
        assessmentId: resolvedAssessmentId,
        price: assessment?.price,
      });
    }

    if (!enrollment.accessGranted) {
      return res.status(403).json({ message: "Access not granted to this assessment" });
    }

    if (enrollment.expiryDate && new Date() > new Date(enrollment.expiryDate)) {
      await AssessmentEnrollment.findByIdAndUpdate(enrollment._id, {
        accessGranted: false,
        subscriptionStatus: "expired",
        status: "expired",
      }).catch((err) => console.error("Failed to expire assessment enrollment during access check", err));

      await getModel("AssessmentAttempt").deleteMany({
        studentId: userId,
        assessmentId: resolvedAssessmentId,
      }).catch((err) => console.error("Failed to clear expired assessment attempts during access check", err));

      return res.status(403).json({
        message: "Your assessment access has expired. Please renew to continue.",
        requiresPayment: true,
      });
    }

    // A paid assessment enrollment must be backed by a verified Payment.  Do
    // this before trusting the enrollment status so stale pending records (or
    // a forged paid flag) cannot grant access.
    if (enrollment.paymentId) {
      const ok = await isPaymentVerified(enrollment.paymentId);
      if (!ok) {
        return res.status(403).json({ message: "Payment not verified for this assessment enrollment" });
      }
      return next();
    }

    if (enrollment.paymentReference) {
      const Payment = getPayment();
      const p = await Payment.findOne({ paymentId: enrollment.paymentReference });
      if (p && p.status === "completed" && p.verificationStatus === "verified") {
        return next();
      }
      return res.status(403).json({ message: "Payment not verified for this assessment enrollment" });
    }

    // Free assessments do not have a Payment record. Paid assessments must
    // have reached this middleware through a verified payment completion.
    if (assessment && Number(assessment.price || 0) === 0) return next();

    // Additionally ensure the assessment itself is published/active
    try {
      const now = new Date();
      if (!assessment) return res.status(404).json({ message: "Assessment not found" });
      if (assessment.status !== "published") return res.status(403).json({ message: "Assessment not available" });
      if (assessment.availabilityDate && new Date(assessment.availabilityDate) > now) return res.status(403).json({ message: "Assessment not yet available" });
      if (assessment.closingDate && new Date(assessment.closingDate) < now) return res.status(403).json({ message: "Assessment has closed" });
    } catch (e) {
      console.error("Assessment availability check failed:", e);
      return res.status(500).json({ message: "Assessment access check failed" });
    }

    return res.status(403).json({ message: "Payment verification required for assessment access" });
  } catch (err) {
    console.error("checkAssessmentAccess error:", err);
    return res.status(500).json({ message: "Access check failed" });
  }
};

module.exports = {
  checkCourseAccess,
  checkAssessmentAccess,
};
