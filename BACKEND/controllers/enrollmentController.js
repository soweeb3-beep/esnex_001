const mongoose = require("mongoose");
const { getModel } = require("../config/adapter");

const getEnrollment = () => getModel("Enrollment");
const getCourse = () => getModel("Course");
const getUser = () => getModel("User");
const getPayment = () => getModel("Payment");

const getLessonCount = (course) => {
  if (!course || !Array.isArray(course.sections)) return 0;
  return course.sections.reduce((sum, section) => {
    const lessons = Array.isArray(section.lessons)
      ? section.lessons
      : Array.isArray(section.videos)
        ? section.videos
        : [];
    return sum + lessons.length;
  }, 0);
};

const findLessonCoordinates = (course, lessonId) => {
  if (!course || !Array.isArray(course.sections)) return null;
  for (let sectionIndex = 0; sectionIndex < course.sections.length; sectionIndex += 1) {
    const section = course.sections[sectionIndex];
    const lessons = Array.isArray(section.lessons)
      ? section.lessons
      : Array.isArray(section.videos)
        ? section.videos
        : [];

    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
      const lesson = lessons[lessonIndex];
      if (!lesson) continue;
      const id = lesson._id ? String(lesson._id) : String(lesson);
      if (String(lessonId) === id) {
        return { sectionIndex, lessonIndex };
      }
    }
  }
  return null;
};

const buildProgressResponse = async (enrollment, courseId) => {
  const course = await getCourse().findById(courseId);
  const totalLessons = getLessonCount(course);
  const completedLessons = Array.isArray(enrollment.progress?.completedLessons)
    ? enrollment.progress.completedLessons
    : [];
  const completedCount = completedLessons.length;
  const percentage = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const completed = totalLessons > 0 && completedCount >= totalLessons;

  return {
    enrolled: true,
    paymentStatus: enrollment.paymentStatus || "pending",
    accessType: enrollment.accessType,
    validUntil: enrollment.validUntil,
    progress: {
      completedLessons,
      percentage,
    },
    totalLessons,
    completedCount,
    completed,
    certificateIssuedAt: enrollment.certificateIssuedAt,
  };
};

exports.enrollCourse = async (req, res) => {
  try {
    const {
      courseId,
      accessType = "full",
      paymentStatus = "pending",
      paymentMethod = "Manual",
      paymentAmount,
      paymentCurrency = "GMD",
      paymentReference,
      transactionId,
      paymentDate,
      paymentId,
    } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID required" });
    }

    if (typeof courseId === "string" && !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const course = await getCourse().findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    let enrollment = await getEnrollment().findOne({ student: req.user.id, course: courseId });
    const validUntil = accessType === "assessment"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const resolvedPaymentAmount = typeof paymentAmount !== "undefined" ? paymentAmount : course.price || 0;
    const resolvedPaymentReference = paymentReference || (paymentStatus === "paid" ? `ESNEX_${req.user.id}_${courseId}_${Date.now()}` : "");
    const resolvedTransactionId = transactionId || resolvedPaymentReference;
    const resolvedPaymentDate = paymentDate ? new Date(paymentDate) : (paymentStatus === "paid" ? new Date() : undefined);

    const Payment = getPayment();
    let verifiedPayment = null;
    if (paymentStatus === "paid") {
      if (!paymentId) {
        return res.status(400).json({ message: "Paid enrollments must be backed by a verified payment record. Use the canonical payment flow." });
      }
      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        return res.status(400).json({ message: "Invalid paymentId" });
      }
      verifiedPayment = await Payment.findById(paymentId);
      if (!verifiedPayment || String(verifiedPayment.studentId) !== String(req.user.id) || verifiedPayment.productType !== "course" || String(verifiedPayment.productId) !== String(courseId) || verifiedPayment.status !== "completed" || verifiedPayment.verificationStatus !== "verified") {
        return res.status(403).json({ message: "Payment record is not verified or does not match this enrollment." });
      }
    }

    const User = getUser();
    const user = await User.findById(req.user.id);

    if (enrollment) {
      if (enrollment.paymentStatus === "paid" && accessType === "full") {
        return res.status(400).json({ message: "Already enrolled and paid" });
      }
      enrollment.accessType = accessType;
      enrollment.paymentStatus = paymentStatus;
      enrollment.paymentId = verifiedPayment?._id || enrollment.paymentId || null;
      enrollment.paymentMethod = paymentMethod || enrollment.paymentMethod || "Manual";
      enrollment.paymentAmount = typeof resolvedPaymentAmount !== "undefined" ? resolvedPaymentAmount : enrollment.paymentAmount;
      enrollment.paymentCurrency = paymentCurrency || enrollment.paymentCurrency || "GMD";
      if (paymentStatus === "paid") {
        enrollment.paymentReference = enrollment.paymentReference || resolvedPaymentReference;
        enrollment.transactionId = enrollment.transactionId || resolvedTransactionId;
        enrollment.paymentDate = enrollment.paymentDate || resolvedPaymentDate;
      }
      enrollment.validUntil = validUntil;
      if (typeof enrollment.save === "function") {
        await enrollment.save();
      } else if (typeof getEnrollment().findByIdAndUpdate === "function") {
        await getEnrollment().findByIdAndUpdate(enrollment._id || enrollment.id || null, {
          accessType: enrollment.accessType,
          paymentStatus: enrollment.paymentStatus,
          paymentId: enrollment.paymentId || null,
          paymentMethod: enrollment.paymentMethod,
          paymentAmount: enrollment.paymentAmount,
          paymentCurrency: enrollment.paymentCurrency,
          paymentReference: enrollment.paymentReference,
          transactionId: enrollment.transactionId,
          paymentDate: enrollment.paymentDate,
          validUntil: enrollment.validUntil,
        });
      }
    } else {
      enrollment = await getEnrollment().create({
        student: req.user.id,
        course: courseId,
        accessType,
        paymentStatus,
        paymentId: verifiedPayment?._id || null,
        paymentMethod,
        paymentAmount: resolvedPaymentAmount,
        paymentCurrency,
        paymentReference: paymentStatus === "paid" ? resolvedPaymentReference : "",
        transactionId: paymentStatus === "paid" ? resolvedTransactionId : "",
        paymentDate: paymentStatus === "paid" ? resolvedPaymentDate : undefined,
        validUntil,
        progress: { completedLessons: [], percentage: 0 },
      });

      if (!course.students?.includes(req.user.id)) {
        course.students = [...(course.students || []), req.user.id];
        if (typeof course.save === "function") {
          await course.save();
        } else if (typeof getCourse().findByIdAndUpdate === "function") {
          await getCourse().findByIdAndUpdate(course._id || courseId, { students: course.students });
        }
      }
    }

    if (user && !user.enrolledCourses?.map(String).includes(String(courseId))) {
      const updatedCourses = [...(user.enrolledCourses || []), courseId];
      if (typeof user.save === "function") {
        user.enrolledCourses = updatedCourses;
        await user.save();
      } else if (typeof User.findByIdAndUpdate === "function") {
        await User.findByIdAndUpdate(req.user.id, { enrolledCourses: updatedCourses });
      }
    }

    res.status(201).json({ message: "Enrollment created", enrollment });
  } catch (err) {
    console.error("Enroll error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.handlePayment = async (req, res) => {
  try {
    const { courseId, accessType = "full", paymentId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID required" });
    }

    const course = await getCourse().findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const validUntil = accessType === "assessment"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const Payment = getPayment();
    let verifiedPayment = null;
    if (course.price > 0) {
      if (!paymentId) {
        return res.status(402).json({
          message: "Payment is required to complete enrollment. Use the verified payment flow.",
          requiresPayment: true,
        });
      }
      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        return res.status(400).json({ message: "Invalid paymentId" });
      }
      verifiedPayment = await Payment.findById(paymentId);
      if (!verifiedPayment || String(verifiedPayment.studentId) !== String(req.user.id) || verifiedPayment.productType !== "course" || String(verifiedPayment.productId) !== String(courseId) || verifiedPayment.status !== "completed" || verifiedPayment.verificationStatus !== "verified") {
        return res.status(403).json({ message: "Payment record is not verified or does not match this course." });
      }
    }

    let enrollment = await getEnrollment().findOne({ student: req.user.id, course: courseId });
    const resolvedAmount = verifiedPayment ? verifiedPayment.amount : course.price || 0;
    const paymentReference = verifiedPayment ? verifiedPayment.paymentId : enrollment?.paymentReference || `ESNEX_${req.user.id}_${courseId}_${Date.now()}`;
    const transactionId = verifiedPayment ? (verifiedPayment.transactionId || paymentReference) : paymentReference;

    if (enrollment) {
      enrollment.paymentStatus = verifiedPayment ? "paid" : enrollment.paymentStatus;
      enrollment.accessType = accessType;
      enrollment.validUntil = validUntil;
      enrollment.paymentMethod = verifiedPayment ? verifiedPayment.paymentMethod : enrollment.paymentMethod || "Manual";
      enrollment.paymentAmount = resolvedAmount;
      enrollment.paymentCurrency = enrollment.paymentCurrency || "GMD";
      enrollment.paymentDate = verifiedPayment ? verifiedPayment.verifiedAt || new Date() : enrollment.paymentDate;
      enrollment.paymentReference = paymentReference;
      enrollment.transactionId = transactionId;
      enrollment.paymentId = verifiedPayment?._id || enrollment.paymentId || null;
      enrollment.deviceInfo = enrollment.deviceInfo || {};
      enrollment.auditLogs = Array.isArray(enrollment.auditLogs) ? enrollment.auditLogs : [];
      if (verifiedPayment) {
        enrollment.auditLogs.push({
          event: "payment_verified",
          details: `Verified payment applied for course ${course.title}`,
          createdAt: new Date(),
        });
      }
      if (typeof enrollment.save === "function") {
        await enrollment.save();
      } else if (typeof getEnrollment().findByIdAndUpdate === "function") {
        await getEnrollment().findByIdAndUpdate(enrollment._id || enrollment?.id || null, {
          paymentStatus: enrollment.paymentStatus,
          accessType: enrollment.accessType,
          validUntil: enrollment.validUntil,
          paymentMethod: enrollment.paymentMethod,
          paymentAmount: enrollment.paymentAmount,
          paymentCurrency: enrollment.paymentCurrency,
          paymentDate: enrollment.paymentDate,
          paymentReference: enrollment.paymentReference,
          transactionId: enrollment.transactionId,
          paymentId: enrollment.paymentId,
          deviceInfo: enrollment.deviceInfo,
          auditLogs: enrollment.auditLogs,
        });
      }
    } else {
      enrollment = await getEnrollment().create({
        student: req.user.id,
        course: courseId,
        paymentStatus: verifiedPayment ? "paid" : "pending",
        accessType,
        validUntil,
        paymentMethod: verifiedPayment ? verifiedPayment.paymentMethod : "Manual",
        paymentAmount: resolvedAmount,
        paymentCurrency: "GMD",
        paymentDate: verifiedPayment ? (verifiedPayment.verifiedAt || new Date()) : undefined,
        paymentReference,
        transactionId,
        paymentId: verifiedPayment?._id || null,
        progress: { completedLessons: [], percentage: 0 },
        auditLogs: [
          {
            event: verifiedPayment ? "payment_verified" : "payment_pending",
            details: verifiedPayment ? `Verified course payment created for ${course.title}` : `Payment pending for ${course.title}`,
            createdAt: new Date(),
          },
        ],
      });
    }

    if (!course.students?.map(String).includes(String(req.user.id))) {
      course.students = [...(course.students || []), req.user.id];
      if (typeof course.save === "function") {
        await course.save();
      } else if (typeof getCourse().findByIdAndUpdate === "function") {
        await getCourse().findByIdAndUpdate(course._id || courseId, { students: course.students });
      }
    }

    const User = getUser();
    const user = await User.findById(req.user.id);
    if (user && !user.enrolledCourses?.map(String).includes(String(courseId))) {
      const updatedCourses = [...(user.enrolledCourses || []), courseId];
      if (typeof user.save === "function") {
        user.enrolledCourses = updatedCourses;
        await user.save();
      } else if (typeof User.findByIdAndUpdate === "function") {
        await User.findByIdAndUpdate(req.user.id, { enrolledCourses: updatedCourses });
      }
    }

    res.json({ message: "Payment confirmed", enrollment, paymentId: verifiedPayment?._id || null });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ message: "Server error processing payment" });
  }
};

exports.getMyCourses = async (req, res) => {
  try {
    const Enrollment = getEnrollment();
    const CourseModel = getCourse();
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.json([]);
    }

    let enrollments = [];
    console.log('[getMyCourses] studentId:', studentId);
    console.log('[getMyCourses] Enrollment.find type:', typeof Enrollment.find);
    try {
      enrollments = await Enrollment.find({ student: studentId }).populate({
        path: "course",
        model: CourseModel,
        strictPopulate: false,
      });
    } catch (populateError) {
      console.warn("Populate course failed for my-courses, falling back to unpopulated results:", populateError?.message || populateError);
      enrollments = await Enrollment.find({ student: studentId });
    }

    const normalized = (Array.isArray(enrollments) ? enrollments : []).map((enrollment) => {
      const safeEnrollment = enrollment && typeof enrollment.toObject === "function" ? enrollment.toObject() : (enrollment || {});
      const course = safeEnrollment.course || enrollment?.course || null;
      const courseId = course?._id || safeEnrollment.courseId || course || null;

      return {
        ...safeEnrollment,
        courseId,
        course: course && typeof course === "object" ? course : null,
      };
    });

    res.json(normalized);
  } catch (err) {
    console.error("Get my courses error:", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCourseProgress = async (req, res) => {
  try {
    const enrollment = await getEnrollment().findOne({ student: req.user.id, course: req.params.courseId });
    if (!enrollment) {
      return res.json({ enrolled: false, progress: { completedLessons: [], percentage: 0 }, totalLessons: 0, completedCount: 0, completed: false });
    }
    const response = await buildProgressResponse(enrollment, req.params.courseId);
    res.json(response);
  } catch (err) {
    console.error("Get course progress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserAccessFlags = async (req, res) => {
  try {
    const Enrollment = getEnrollment();
    const AssessmentEnrollment = getModel("AssessmentEnrollment");

    const courseEnrollments = await Enrollment.find({ student: req.user.id }).select("course");
    const assessmentEnrollments = await AssessmentEnrollment.find({ studentId: req.user.id, accessGranted: true }).select("assessmentId");

    const enrolledCourseIds = courseEnrollments.map((item) => String(item.course));
    const enrolledAssessmentIds = assessmentEnrollments.map((item) => String(item.assessmentId));

    res.json({
      isEnrolledCourse: enrolledCourseIds.length > 0,
      isEnrolledAssessment: enrolledAssessmentIds.length > 0,
      enrolledCourseIds,
      enrolledAssessmentIds,
    });
  } catch (err) {
    console.error("Get access flags error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateLessonProgress = async (req, res) => {
  try {
    const { sectionIndex, lessonIndex, lessonId, completed } = req.body;
    const course = await getCourse().findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    let coords = null;
    if (lessonId) {
      coords = findLessonCoordinates(course, lessonId);
    }
    if (!coords) {
      if (typeof sectionIndex !== "number" || typeof lessonIndex !== "number") {
        return res.status(400).json({ message: "Lesson ID or section/lesson index required" });
      }
      coords = { sectionIndex, lessonIndex };
    }

    const enrollment = await getEnrollment().findOne({ student: req.user.id, course: req.params.courseId });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment required before tracking progress" });
    }

    const existingLessons = Array.isArray(enrollment.progress?.completedLessons)
      ? enrollment.progress.completedLessons
      : [];

    const resolvedLessonId = lessonId || (coords.lessonId ? String(coords.lessonId) : null);

    const completedLessons = existingLessons.filter((item) => {
      if (resolvedLessonId && item.lessonId) {
        return String(item.lessonId) !== String(resolvedLessonId);
      }
      return !(item.sectionIndex === coords.sectionIndex && item.lessonIndex === coords.lessonIndex);
    });

    if (completed) {
      const newEntry = {
        completedAt: new Date(),
        lessonId: lessonId || null,
        sectionIndex: coords.sectionIndex,
        lessonIndex: coords.lessonIndex,
      };
      completedLessons.push(newEntry);
    }

    const totalLessons = getLessonCount(course);
    const percentage = totalLessons ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

    enrollment.progress = {
      completedLessons,
      percentage,
    };

    if (percentage === 100 && !enrollment.certificateIssuedAt) {
      enrollment.certificateIssuedAt = new Date();
    }

    await enrollment.save();
    const response = await buildProgressResponse(enrollment, req.params.courseId);
    res.json(response);
  } catch (err) {
    console.error("Update lesson progress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};