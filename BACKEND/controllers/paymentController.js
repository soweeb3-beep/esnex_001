const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { getModel } = require("../config/adapter");
const crypto = require("crypto");
const axios = require("axios");
const ModemPay = require("modem-pay");

const getEnrollment = () => getModel("Enrollment");
const getUser = () => getModel("User");
const getCourse = () => getModel("Course");
const getAssessmentEnrollment = () => getModel("AssessmentEnrollment");
const getAssessment = () => getModel("Assessment");
const getPayment = () => getModel("Payment");

const PAYMENT_SOURCES = ["Modem Pay", "Bank Transfer", "Cash", "Admin Granted"];
const PAYMENT_METHODS = ["Modem Pay", "Card", "Bank Transfer", "Cash", "Admin Granted", "Manual", "Wallet", "Other"];

const calculateTransactionFee = (amount) => {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(numeric * 0.01));
};

const generatePaymentId = (studentId, productType, productId) => {
  const shortId = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `ESNEX-${String(productType || "PAY").toUpperCase()}-${shortId}`;
};

const createAuditLog = (event, details) => ({ event, details, createdAt: new Date() });

const findPayment = async ({ paymentId, transactionId, gatewayReference, paymentRef, studentId } = {}) => {
  const Payment = getPayment();
  const normalizedStudentId = studentId ? String(studentId).trim() : null;
  const normalizedPaymentId = paymentId ? String(paymentId).trim() : "";
  const normalizedTransactionId = transactionId ? String(transactionId).trim() : "";
  const normalizedGatewayReference = gatewayReference ? String(gatewayReference).trim() : "";
  const normalizedPaymentRef = paymentRef ? String(paymentRef).trim() : "";

  // Build candidate exact-match queries first
  const candidateQueries = [];
  if (normalizedPaymentId) candidateQueries.push({ paymentId: normalizedPaymentId });
  if (normalizedTransactionId) candidateQueries.push({ transactionId: normalizedTransactionId });
  if (normalizedGatewayReference) candidateQueries.push({ gatewayReference: normalizedGatewayReference });
  if (normalizedPaymentRef) candidateQueries.push({ paymentId: normalizedPaymentRef });

  const isSameStudent = (payment) => !normalizedStudentId || String(payment.studentId || "") === normalizedStudentId || String(payment.student_id || "") === normalizedStudentId;

  const preferMatch = (payment) => {
    if (!payment) return false;
    if (normalizedStudentId && !isSameStudent(payment)) return false;
    return true;
  };

  for (const query of candidateQueries) {
    const payment = await Payment.findOne(query);
    if (!payment || !preferMatch(payment)) continue;
    return payment;
  }

  if (normalizedStudentId && normalizedPaymentId) {
    const directMatch = await Payment.findOne({ paymentId: normalizedPaymentId, studentId: normalizedStudentId });
    if (directMatch) return directMatch;
  }

  const listQuery = typeof Payment.find === "function" ? Payment.find({}) : null;
  const allPayments = listQuery ? (await listQuery) : [];
  const paymentList = Array.isArray(allPayments)
    ? allPayments
    : Array.isArray(allPayments?._result)
      ? allPayments._result
      : [];

  // More flexible matching: allow exact, suffix, contains, and match by receipt/gateway/metadata
  const normalizedCandidates = paymentList.filter((payment) => !!payment && isSameStudent(payment));

  const scoreFor = (payment) => {
    let score = 0;
    const pid = String(payment.paymentId || "").trim();
    const tid = String(payment.transactionId || "").trim();
    const greff = String(payment.gatewayReference || "").trim();
    const receipt = String(payment.receiptNumber || "").trim();
    const meta = JSON.stringify(payment.metadata || {}).toLowerCase();

    if (normalizedPaymentId && pid === normalizedPaymentId) score += 10;
    if (normalizedPaymentId && pid.endsWith(normalizedPaymentId)) score += 6;
    if (normalizedPaymentId && pid.includes(normalizedPaymentId)) score += 3;

    if (normalizedTransactionId && tid === normalizedTransactionId) score += 8;
    if (normalizedTransactionId && tid.includes(normalizedTransactionId)) score += 3;

    if (normalizedGatewayReference && greff === normalizedGatewayReference) score += 7;
    if (normalizedGatewayReference && greff.includes(normalizedGatewayReference)) score += 3;

    if (normalizedPaymentRef && pid === normalizedPaymentRef) score += 6;

    if (receipt && (receipt === normalizedPaymentId || receipt.includes(normalizedPaymentId))) score += 4;

    if (meta && normalizedPaymentId && meta.includes(normalizedPaymentId.toLowerCase())) score += 2;

    return score;
  };

  const candidatesWithScores = normalizedCandidates
    .map((p) => ({ p, score: scoreFor(p) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return (candidatesWithScores[0] && candidatesWithScores[0].p) || null;
};

const resolveProductInfo = async (productType, productId) => {
  try {
    if (productType === "course") {
      const CourseModel = getCourse();
      let course = null;
      if (CourseModel) {
        console.log(`[resolveProductInfo] CourseModel available. hasFindById=${typeof CourseModel.findById==='function'} hasFindOne=${typeof CourseModel.findOne==='function'}`);
        if (typeof CourseModel.findById === 'function') {
          course = await CourseModel.findById(productId);
          console.log('[resolveProductInfo] CourseModel.findById result:', !!course);
        }
        if (!course && typeof CourseModel.findOne === 'function') {
          course = await CourseModel.findOne({ _id: productId }) || await CourseModel.findOne({ id: productId }) || await CourseModel.findOne({ name: productId });
          console.log('[resolveProductInfo] CourseModel.findOne fallback result:', !!course);
        }
      }
      return course ? { productName: course.title || course.name || "Course", productTypeRef: "Course", productModel: course } : null;
    }
    if (productType === "assessment") {
      const AssessmentModel = getAssessment();
      let assessment = null;
      if (AssessmentModel) {
        console.log(`[resolveProductInfo] AssessmentModel available. hasFindById=${typeof AssessmentModel.findById==='function'} hasFindOne=${typeof AssessmentModel.findOne==='function'}`);
        if (typeof AssessmentModel.findById === 'function') {
          assessment = await AssessmentModel.findById(productId);
          console.log('[resolveProductInfo] AssessmentModel.findById result:', !!assessment);
        }
        if (!assessment && typeof AssessmentModel.findOne === 'function') {
          assessment = await AssessmentModel.findOne({ _id: productId })
            || await AssessmentModel.findOne({ id: productId })
            || await AssessmentModel.findOne({ name: productId });
          console.log('[resolveProductInfo] AssessmentModel.findOne fallback result:', !!assessment);
        }
      }
      return assessment ? { productName: assessment.name || assessment.title || "Assessment", productTypeRef: "Assessment", productModel: assessment } : null;
    }
  } catch (error) {
    // Invalid ID format or lookup error should simply bubble as not found
    console.warn(`resolveProductInfo lookup failed for ${productType} ${productId}:`, error.message);
  }
  // As a last resort, attempt to read from file-based mock data so separate mock-only processes
  // (which write into BACKEND/data/*.json) can still be resolved by the running server.
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    const fallbackLog = `[resolveProductInfo] fallback file check for ${productType} ${productId} at ${dataDir}`;
    console.log(fallbackLog);
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), fallbackLog + '\n', 'utf8'); } catch (e) {}
    if (productType === 'assessment') {
      const primaryFile = path.join(dataDir, 'assessments.json');
      const standardFile = path.join(dataDir, 'standard-assessments.json');
      const primary = fs.existsSync(primaryFile) ? JSON.parse(fs.readFileSync(primaryFile, 'utf8')) : [];
      const standard = fs.existsSync(standardFile) ? JSON.parse(fs.readFileSync(standardFile, 'utf8')) : [];
      const merged = [...primary, ...standard];
      const found = merged.find((a) => String(a._id) === String(productId));
      if (found) {
        const msg = `[resolveProductInfo] found in file-based assessments.json ${found._id}`;
        console.log(msg);
        try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), msg + '\n', 'utf8'); } catch (e) {}
        return { productName: found.name || found.title || 'Assessment', productTypeRef: 'Assessment', productModel: found };
      }
    }
    if (productType === 'course') {
      const file = path.join(dataDir, 'courses.json');
      const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      const found = list.find((c) => String(c._id) === String(productId));
      if (found) {
        const msg = `[resolveProductInfo] found in file-based courses.json ${found._id}`;
        console.log(msg);
        try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), msg + '\n', 'utf8'); } catch (e) {}
        return { productName: found.title || found.name || 'Course', productTypeRef: 'Course', productModel: found };
      }
    }
  } catch (err) {
    // ignore file-read errors
  }
  return null;
};

const formatPayment = (payment) => {
  if (!payment) return null;
  return {
    paymentId: payment.paymentId,
    studentId: payment.studentId,
    studentName: payment.studentName,
    email: payment.email,
    productType: payment.productType,
    productId: payment.productId,
    productName: payment.productName,
    courseTitle: payment.productName,
    courseSubject: payment.productType,
    amount: payment.amount,
    amountPaid: payment.amount,
    paymentDate: payment.verifiedAt || payment.createdAt,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    paymentSource: payment.paymentSource,
    transactionId: payment.transactionId,
    paymentReference: payment.paymentId,
    gatewayReference: payment.gatewayReference,
    status: payment.status,
    paymentStatus: payment.status,
    verificationStatus: payment.verificationStatus,
    receiptNumber: payment.receiptNumber,
    receiptUrl: payment.receiptUrl,
    approvedBy: payment.approvedBy,
    approvedAt: payment.approvedAt,
    approvalReason: payment.approvalReason,
    allowRepurchase: payment.allowRepurchase,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    verifiedAt: payment.verifiedAt,
    auditLogs: payment.auditLogs || [],
    metadata: payment.metadata || {},
  };
};

const createCourseEnrollment = async (payment) => {
  const Enrollment = getEnrollment();
  const User = getUser();
  let enrollment = await Enrollment.findOne({ student: payment.studentId, course: payment.productId });
  const paymentMeta = {
    paymentStatus: "paid",
    paymentId: payment._id,
    paymentReference: payment.paymentId,
    transactionId: payment.transactionId || payment.gatewayReference || payment.paymentId,
    paymentMethod: payment.paymentMethod,
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    paymentDate: payment.verifiedAt || new Date(),
    accessType: "full",
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    auditLogs: [createAuditLog("payment_verified", `Payment completed for course ${payment.productName}`)],
  };

  if (enrollment) {
    Object.assign(enrollment, paymentMeta);
    enrollment.paymentStatus = "paid";
    if (typeof enrollment.save === "function") {
      await enrollment.save();
    } else {
      await Enrollment.findByIdAndUpdate(enrollment._id || enrollment.id, paymentMeta);
      enrollment = await Enrollment.findById(enrollment._id || enrollment.id);
    }
  } else {
    enrollment = await Enrollment.create({
      student: payment.studentId,
      course: payment.productId,
      progress: { completedLessons: [] },
      ...paymentMeta,
    });
  }

  const user = await User.findById(payment.studentId);
  if (user) {
    const enrolledCourseIds = Array.isArray(user.enrolledCourses) ? user.enrolledCourses.map(String) : [];
    if (!enrolledCourseIds.includes(String(payment.productId))) {
      user.enrolledCourses = [...(user.enrolledCourses || []), payment.productId];
      if (typeof user.save === "function") {
        await user.save();
      } else {
        await User.findByIdAndUpdate(user._id || user.id, { enrolledCourses: user.enrolledCourses });
      }
    }
  }

  return enrollment;
};

const createAssessmentEnrollment = async (payment) => {
  const AssessmentEnrollmentModel = getAssessmentEnrollment();
  const metadata = payment.metadata || {};
  try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG createAssessmentEnrollment start paymentId=${payment.paymentId} studentId=${payment.studentId} assessmentId=${payment.productId} status=${payment.status}\n`, 'utf8'); } catch (e) {}
  // Use the verification timestamp as the start of the monthly period. This
  // ensures idempotency: repeated verifications for the same payment do not
  // keep extending access unintentionally.
  const paidAt = payment.verifiedAt ? new Date(payment.verifiedAt) : new Date();
  const defaultExpiryDate = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const subscriptionType = payment.paymentSource === "Admin Granted" || payment.amount === 0 ? "free" : "monthly";

  const assessmentId = payment.productId;
  const studentId = payment.studentId;

  // Load any existing enrollment for this student + assessment
  let existing = await AssessmentEnrollmentModel.findOne({ assessmentId, studentId });
  try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG createAssessmentEnrollment existing=${existing? (existing._id||existing.id) : 'null'}\n`, 'utf8'); } catch (e) {}

  // If an existing enrollment is found, reconcile it with the verified payment
  if (existing) {
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG existing enrollment BEFORE update: id=${existing._id||existing.id} studentId=${existing.studentId} assessmentId=${existing.assessmentId} paymentId=${existing.paymentId||''} paymentStatus=${existing.paymentStatus||''} accessGranted=${existing.accessGranted||false} expiryDate=${existing.expiryDate||existing.validUntil||''} subscriptionStatus=${existing.subscriptionStatus||''}\n`, 'utf8'); } catch (e) {}
    // If this enrollment already references the same verified payment and is
    // still active, preserve its expiry (idempotent).
    let preserveExpiry = false;
    try {
      if (String(existing.paymentId || "") === String(payment._id || "") && existing.expiryDate && new Date(existing.expiryDate) > new Date()) {
        preserveExpiry = true;
      }
    } catch (e) {
      preserveExpiry = false;
    }

    const expiryDate = preserveExpiry ? existing.expiryDate : (metadata.expiryDate || defaultExpiryDate);
    const validUntil = preserveExpiry ? (existing.validUntil || existing.expiryDate) : (metadata.expiryDate || defaultExpiryDate);

    existing.accessGranted = true;
    existing.paymentId = payment._id;
    existing.paymentDate = paidAt;
    existing.paidAt = paidAt;
    existing.paymentStatus = "paid";
    existing.paymentReference = payment.paymentId;
    existing.transactionId = payment.transactionId || payment.gatewayReference || payment.paymentId;
    existing.paymentMethod = payment.paymentMethod;
    existing.paymentAmount = payment.amount;
    existing.paymentCurrency = payment.currency;
    existing.subscriptionType = subscriptionType;
    existing.subscriptionStatus = "active";
    existing.expiryDate = expiryDate;
    existing.validUntil = validUntil;
    existing.accessType = "assessment";

    if (typeof existing.save === "function") {
      await existing.save();
    } else {
      await AssessmentEnrollmentModel.findByIdAndUpdate(existing._id || existing.id, existing);
      existing = await AssessmentEnrollmentModel.findById(existing._id || existing.id);
    }
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG existing enrollment AFTER update: id=${existing._id||existing.id} studentId=${existing.studentId} assessmentId=${existing.assessmentId} paymentId=${existing.paymentId||''} paymentStatus=${existing.paymentStatus||''} accessGranted=${existing.accessGranted||false} expiryDate=${existing.expiryDate||existing.validUntil||''} subscriptionStatus=${existing.subscriptionStatus||''}\n`, 'utf8'); } catch (e) {}
    console.log(`[PAYMENT->ENROLL] Reconciled existing assessment enrollment for student=${studentId} assessment=${assessmentId} id=${existing._id || existing.id}`);
    return existing;
  }

  // No existing enrollment -> create a new one
  const createPayload = {
    assessmentId: assessmentId,
    studentId: studentId,
    accessGranted: true,
    paymentId: payment._id,
    paymentDate: paidAt,
    paidAt,
    paymentStatus: "paid",
    paymentReference: payment.paymentId,
    transactionId: payment.transactionId || payment.gatewayReference || payment.paymentId,
    paymentMethod: payment.paymentMethod,
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    subscriptionType,
    subscriptionStatus: "active",
    expiryDate: metadata.expiryDate || defaultExpiryDate,
    validUntil: metadata.expiryDate || defaultExpiryDate,
    accessType: "assessment",
  };

  const created = await AssessmentEnrollmentModel.create(createPayload);
  try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG created enrollment: id=${created._id||created.id} studentId=${created.studentId} assessmentId=${created.assessmentId} paymentId=${created.paymentId||''} paymentStatus=${created.paymentStatus||''} accessGranted=${created.accessGranted||false} expiryDate=${created.expiryDate||created.validUntil||''} subscriptionStatus=${created.subscriptionStatus||''}\n`, 'utf8'); } catch (e) {}
  console.log(`[PAYMENT->ENROLL] Created assessment enrollment for student=${studentId} assessment=${assessmentId} id=${created._id || created.id}`);
  return created;
};

const completePayment = async (payment, options = {}) => {
  if (!payment || payment.status !== "completed" || payment.verificationStatus !== "verified") {
    return null;
  }

  const updated = await getPayment().findById(payment._id);
  if (!updated) return null;

  try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG completePayment start paymentId=${updated.paymentId} studentId=${updated.studentId} productType=${updated.productType} productId=${updated.productId} status=${updated.status} verificationStatus=${updated.verificationStatus}\n`, 'utf8'); } catch (e) {}

  if (!updated.metadata) {
    updated.metadata = {};
  }

  let enrollmentWasMissing = false;
  if (updated.productType === "course") {
    const existingEnrollment = await getEnrollment().findOne({ student: updated.studentId, course: updated.productId });
    if (!existingEnrollment) {
      enrollmentWasMissing = true;
      const enrollment = await createCourseEnrollment(updated);
      updated.metadata.enrollmentId = enrollment._id;
    } else {
      updated.metadata.enrollmentId = existingEnrollment._id || existingEnrollment.id;
    }
  } else if (updated.productType === "assessment") {
    const existingEnrollment = await getAssessmentEnrollment().findOne({ assessmentId: updated.productId, studentId: updated.studentId });
    enrollmentWasMissing = !existingEnrollment;
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG completePayment existingEnrollment=${existingEnrollment? (existingEnrollment._id||existingEnrollment.id) : 'null'}\n`, 'utf8'); } catch (e) {}
    // Always reconcile the enrollment.  Previously this ran only for a
    // missing enrollment, leaving an existing pending enrollment inaccessible
    // even after its Modem Pay payment had been verified.
    const assessmentEnrollment = await createAssessmentEnrollment(updated);
    updated.metadata.assessmentEnrollmentId = assessmentEnrollment._id || assessmentEnrollment.id;
  }

  if (!updated.metadata.completionProcessed || enrollmentWasMissing) {
    updated.metadata.completionProcessed = true;
    updated.auditLogs = Array.isArray(updated.auditLogs) ? updated.auditLogs : [];
    updated.auditLogs.push(createAuditLog("payment_enrollment_processed", `Enrollment ensured for ${updated.productType}`));
    await updated.save();
  }

  try {
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] DIAG completePayment finished paymentId=${updated.paymentId} assessmentEnrollmentId=${updated.metadata.assessmentEnrollmentId||''} enrollmentWasMissing=${enrollmentWasMissing}\n`, 'utf8'); } catch (e) {}
    console.log(`[COMPLETE_PAYMENT] paymentId=${updated.paymentId} metadata=${JSON.stringify(updated.metadata)}`);
    if (updated.metadata && updated.metadata.assessmentEnrollmentId) {
      console.log(`[COMPLETE_PAYMENT] assessmentEnrollmentId=${updated.metadata.assessmentEnrollmentId}`);
    }
  } catch (err) {
    console.error('COMPLETE_PAYMENT log failed', err && err.message);
  }
  return updated;
};

// Payment API Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_API_URL = process.env.PAYSTACK_API_URL || "https://api.paystack.co";
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || "http://localhost:5173/payment/return";

const WAVE_API_KEY = process.env.WAVE_API_KEY;
const WAVE_WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET;
const WAVE_API_URL = process.env.WAVE_API_URL || "https://api.wave.co/charges";

const MODEM_PAY_API_KEY = process.env.MODEM_PAY_API_KEY;
const MODEM_PAY_API_URL = process.env.MODEM_PAY_API_URL || "https://api.modempay.com";
const configuredModemPayWebhookSecret = process.env.MODEM_PAY_WEBHOOK_SECRET;
const MODEM_PAY_WEBHOOK_SECRET = configuredModemPayWebhookSecret && !configuredModemPayWebhookSecret.startsWith("replace_with_")
  ? configuredModemPayWebhookSecret
  : "";
const MODEM_PAY_CLIENT = MODEM_PAY_API_KEY ? new ModemPay(MODEM_PAY_API_KEY) : null;

if (MODEM_PAY_API_KEY) {
  console.log("Modem Pay is configured for payment processing.");
} else {
  console.warn("Warning: MODEM_PAY_API_KEY is not set. Modem Pay payment links cannot be created.");
}
if (PAYSTACK_SECRET_KEY) {
  console.log("Paystack is configured for payment processing.");
} else {
  console.warn("Warning: PAYSTACK_SECRET_KEY is not set. Payment verification cannot use Paystack API.");
}
if (!WAVE_API_KEY) {
  console.warn("Warning: WAVE_API_KEY is not set. Payment verification cannot use Wave API.");
}
if (!WAVE_WEBHOOK_SECRET) {
  console.warn("Warning: WAVE_WEBHOOK_SECRET is not set. Webhook signatures will not be trusted.");
}
if (!MODEM_PAY_WEBHOOK_SECRET) {
  console.warn("Warning: MODEM_PAY_WEBHOOK_SECRET is not set. Modem Pay webhook signatures will not be trusted.");
}

const maybePopulate = (query, path, select) => {
  if (query && typeof query.populate === "function") {
    return query.populate(path, select);
  }
  return query;
};

const maybePopulateMany = (query, fields) => {
  if (query && typeof query.populate === "function") {
    let q = query;
    fields.forEach(({ path, select }) => {
      q = q.populate(path, select);
    });
    return q;
  }
  return query;
};

const buildCoursePaymentQuery = (query) => {
  const filter = buildAdminPaymentQuery(query);
  if (query.courseId && mongoose.Types.ObjectId.isValid(query.courseId)) {
    filter.course = query.courseId;
  }
  return filter;
};

const buildAssessmentPaymentQuery = (query) => {
  const filter = buildAdminPaymentQuery(query);
  if (query.courseId && mongoose.Types.ObjectId.isValid(query.courseId)) {
    filter.assessmentId = query.courseId;
  }
  return filter;
};

const findPaymentRecordByReference = async (reference) => {
  let enrollment = await getEnrollment().findOne({ paymentReference: reference });
  if (!enrollment) {
    enrollment = await getAssessmentEnrollment().findOne({ paymentReference: reference });
  }
  return enrollment;
};

const normalizeEnrollment = (enrollment) => {
  const student = enrollment.student || enrollment.studentId || {};
  const product = enrollment.course || enrollment.assessmentId || {};
  const isAssessment = Boolean(enrollment.assessmentId);
  const courseId = enrollment.course?._id || enrollment.course || undefined;
  const assessmentId = isAssessment ? (enrollment.assessmentId?._id || enrollment.assessmentId) : undefined;

  return {
    enrollmentId: enrollment._id,
    studentName: student?.name || "Unknown",
    studentEmail: student?.email || "",
    courseTitle: product?.title || product?.name || "Unknown",
    courseSubject: product?.subject || "",
    productType: isAssessment ? "Assessment" : "Course",
    amountPaid: enrollment.paymentAmount || product?.price || 0,
    paymentMethod: enrollment.paymentMethod || "Manual",
    transactionId: enrollment.transactionId || enrollment.paymentReference || "",
    paymentReference: enrollment.paymentReference || "",
    paymentStatus: enrollment.paymentStatus || (enrollment.paymentReference ? "paid" : "pending"),
    paymentDate: enrollment.paymentDate || enrollment.createdAt,
    validUntil: enrollment.validUntil || enrollment.expiryDate,
    accessType: enrollment.accessType || (isAssessment ? "assessment" : "full"),
    createdAt: enrollment.createdAt,
    paymentCurrency: enrollment.paymentCurrency || "GMD",
    paymentError: enrollment.paymentError || "",
    refundReference: enrollment.refundReference || "",
    deviceInfo: enrollment.deviceInfo || {},
    auditLogs: Array.isArray(enrollment.auditLogs) ? enrollment.auditLogs : [],
    courseId,
    assessmentId,
  };
};

/**
 * Initialize Payment - Create Wave Payment Session
 */
exports.initiatePayment = async (req, res) => {
  try {
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] INITIATE_PAYMENT body=${JSON.stringify(req.body)} user=${req.user?.id}\n`, 'utf8'); } catch (err) { console.error('Payment debug log failed', err && err.message); }
    console.log('[INITIATE_PAYMENT] body:', JSON.stringify(req.body));
    const {
      productType,
      productId: productIdBody,
      courseId,
      assessmentId,
      amount,
      currency = "GMD",
      email,
      firstName,
      lastName,
      paymentSource = "Modem Pay",
      paymentMethod = "Modem Pay",
      allowRepurchase = false,
      idempotencyKey,
    } = req.body;
    const userId = req.user.id;
    const productId = productIdBody || courseId || assessmentId;
    const resolvedProductType = productType
      || (assessmentId ? "assessment" : courseId ? "course" : undefined);

    console.log("[PAYMENT INITIATE] request body", {
      productType,
      resolvedProductType,
      productId,
      courseId,
      assessmentId,
      amount,
      currency,
      email,
      paymentSource,
      paymentMethod,
      userId,
    });

    if (!resolvedProductType || !productId || typeof amount === "undefined" || !email) {
      return res.status(400).json({
        success: false,
        message: "productType, productId, amount, and email are required",
      });
    }

    if (!["course", "assessment"].includes(resolvedProductType)) {
      return res.status(400).json({
        success: false,
        message: "productType must be either 'course' or 'assessment'",
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a non-negative number",
      });
    }

    if (!PAYMENT_SOURCES.includes(paymentSource) || !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment source or payment method",
      });
    }

    const productInfo = await resolveProductInfo(resolvedProductType, productId);
    // If the product was found in file-based fallback but the server is running
    // with a live MongoDB connection, create a corresponding Mongo document
    // so subsequent operations (which expect ObjectId references) succeed.
    let importedAssessment = null;
    let importedCourse = null;
    try {
      const isMongooseConnected = mongoose.connection && mongoose.connection.readyState > 0;
      const AssessmentModel = getAssessment();
      const CourseModel = getCourse();
      const wasFileFoundPlain = productInfo && productInfo.productModel && typeof productInfo.productModel.save !== 'function';

      // Import assessments into Mongo when running with a real DB
      if (wasFileFoundPlain && isMongooseConnected && AssessmentModel && typeof AssessmentModel.create === 'function' && (resolvedProductType === 'assessment')) {
        const fileModel = productInfo.productModel;
        const createPayload = {
          name: fileModel.name || fileModel.title || `Imported ${resolvedProductType}`,
          title: fileModel.title || fileModel.name,
          price: fileModel.price || fileModel.amount || 0,
          duration: fileModel.duration,
          totalMarks: fileModel.totalMarks,
          status: fileModel.status || 'published',
          visibility: typeof fileModel.visibility !== 'undefined' ? fileModel.visibility : true,
          subject: fileModel.subject,
          type: fileModel.type || 'global',
        };
        try {
          importedAssessment = await AssessmentModel.create(createPayload);
          const msg = `[INITIATE_PAYMENT] Imported file-based ${resolvedProductType} ${String(productId)} into mongo as ${importedAssessment._id}`;
          console.log(msg);
          try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), msg + '\n', 'utf8'); } catch (e) {}
          productInfo.productModel = importedAssessment;
          productInfo.productName = productInfo.productName || importedAssessment.name || importedAssessment.title;
        } catch (err) {
          const warn = `[INITIATE_PAYMENT] Failed to import file-based ${resolvedProductType} ${String(productId)} into mongo: ${err && err.message}`;
          console.warn(warn);
          try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), warn + '\n', 'utf8'); } catch (e) {}
        }
      }

      // Import courses into Mongo similarly, to avoid ObjectId cast errors
      if (wasFileFoundPlain && isMongooseConnected && CourseModel && typeof CourseModel.create === 'function' && (resolvedProductType === 'course')) {
        const fileModel = productInfo.productModel;
        const createPayload = {
            title: fileModel.title || fileModel.name || `Imported ${resolvedProductType}`,
            description: fileModel.description || fileModel.desc || `Imported ${resolvedProductType} from file`,
            name: fileModel.name || fileModel.title,
            price: fileModel.price || fileModel.amount || 0,
            currency: fileModel.currency || 'GMD',
            category: fileModel.category || undefined,
            status: fileModel.status || 'published',
            visibility: typeof fileModel.visibility !== 'undefined' ? fileModel.visibility : true,
            subject: fileModel.subject || 'General Subjects',
            instructor: {
              name: (fileModel.instructor && fileModel.instructor.name) || fileModel.instructorName || 'Imported Instructor',
              avatar: (fileModel.instructor && fileModel.instructor.avatar) || fileModel.instructorAvatar || '',
              userId: (fileModel.instructor && fileModel.instructor.userId) || undefined,
            },
            sections: fileModel.sections || [],
          };
        try {
          importedCourse = await CourseModel.create(createPayload);
          const msg = `[INITIATE_PAYMENT] Imported file-based ${resolvedProductType} ${String(productId)} into mongo as ${importedCourse._id}`;
          console.log(msg);
          try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), msg + '\n', 'utf8'); } catch (e) {}
          productInfo.productModel = importedCourse;
          productInfo.productName = productInfo.productName || importedCourse.title || importedCourse.name;
        } catch (err) {
          const warn = `[INITIATE_PAYMENT] Failed to import file-based ${resolvedProductType} ${String(productId)} into mongo: ${err && err.message}`;
          console.warn(warn);
          try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), warn + '\n', 'utf8'); } catch (e) {}
        }
      }
    } catch (e) {
      // ignore
    }

    const finalProductId = importedAssessment ? String(importedAssessment._id) : (importedCourse ? String(importedCourse._id) : productId);
    if (!productInfo) {
      try {
        const dbg = `[INITIATE_PAYMENT] resolveProductInfo failed for ${resolvedProductType} ${productId}`;
        console.warn(dbg);
        try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), dbg + '\n', 'utf8'); } catch (e) {}
        const dataDir = path.join(__dirname, '..', 'data');
        const primaryFile = path.join(dataDir, 'assessments.json');
        if (fs.existsSync(primaryFile)) {
          const arr = JSON.parse(fs.readFileSync(primaryFile, 'utf8'));
          const sample = arr.slice(-5).map(a=>a._id).join(',');
          const msg = `[INITIATE_PAYMENT] file assessments sample last5: ${sample}`;
          try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), msg + '\n', 'utf8'); } catch (e) {}
        }
      } catch (e) {}
      return res.status(404).json({
        success: false,
        message: `${resolvedProductType.charAt(0).toUpperCase() + resolvedProductType.slice(1)} not found`,
      });
    }

    // Validate the requested amount against the real product price and any frontend processing fee.
    try {
      const priceOnRecord = Number(productInfo.productModel?.price ?? productInfo.productModel?.amount ?? 0);
      const transactionFee = calculateTransactionFee(priceOnRecord);
      const expectedAmount = Number(priceOnRecord) + transactionFee;

      if (Number(amount) !== expectedAmount) {
        return res.status(400).json({ success: false, message: "Amount does not match the admin-set product price plus 1% transaction fee" });
      }
    } catch (err) {
      return res.status(400).json({ success: false, message: "Unable to validate product price" });
    }

    // Debug finalProductId to diagnose ObjectId casting issues
    try { const dbg = `[INITIATE_PAYMENT] finalProductId=${finalProductId} importedCourse=${importedCourse?._id} importedAssessment=${importedAssessment?._id} productInfoExists=${!!productInfo}`; console.log(dbg); try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), dbg + '\n', 'utf8'); } catch (e) {} } catch (e) {}

    // Use the resolved product type (from request body fallback) when checking existing access
    const existingProductAccess = resolvedProductType === "course"
      ? await getEnrollment().findOne({ student: userId, course: finalProductId, paymentStatus: "paid" })
      : await getAssessmentEnrollment().findOne({ studentId: userId, assessmentId: finalProductId, accessGranted: true, subscriptionStatus: "active" });

    if (existingProductAccess && !allowRepurchase) {
      return res.status(400).json({
        success: false,
        message: `You already have access to this ${productType}`,
      });
    }

    const Payment = getPayment();
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ studentId: userId, productType, productId: finalProductId, idempotencyKey });
      if (existingPayment) {
        return res.status(200).json({
          success: true,
          message: "Existing payment session returned",
          data: formatPayment(existingPayment),
        });
      }
    }

    const paymentId = generatePaymentId(userId, productType, finalProductId);
    const studentName = req.user.name || `${firstName || ""} ${lastName || ""}`.trim() || "Student";

    const payment = await Payment.create({
      paymentId,
      studentId: userId,
      studentName,
      email,
      productType,
      productTypeRef: productInfo.productTypeRef,
      productId: finalProductId,
      productName: productInfo.productName,
      amount,
      currency,
      paymentMethod,
      paymentSource,
      status: "pending",
      verificationStatus: "unverified",
      idempotencyKey: idempotencyKey || "",
      receiptNumber: `RCT_${paymentId}`,
      auditLogs: [createAuditLog("payment_initiated", `Payment initiated for ${productInfo.productName}`)],
      metadata: { productTitle: productInfo.productName },
    });

    // Build return and webhook URLs
    const isProd = process.env.NODE_ENV === 'production';
    const requestProtocol = req.protocol || 'http';
    const requestHost = req.get ? req.get('host') : 'localhost';
    const requestOrigin = req.get ? req.get('origin') : '';
    const frontendBase = process.env.FRONTEND_URL || requestOrigin || `${requestProtocol}://${requestHost}`;
    const baseReturnUrl = process.env.MODEM_PAY_RETURN_URL || process.env.WAVE_RETURN_URL || `${frontendBase.replace(/\/$/, '')}/payment/return`;
    const returnUrlObject = new URL(baseReturnUrl.startsWith('http') ? baseReturnUrl : `${frontendBase.replace(/\/$/, '')}${baseReturnUrl.startsWith('/') ? baseReturnUrl : `/${baseReturnUrl}`}`);
    returnUrlObject.searchParams.set('paymentId', payment.paymentId);
    const returnUrl = returnUrlObject.toString();
    const webhookUrl = process.env.MODEM_PAY_WEBHOOK_URL || process.env.WAVE_WEBHOOK_URL || `${requestProtocol}://${requestHost}/api/payments/webhook`;

    // Active payment provider: Modem Pay only. Legacy Wave/Paystack fallbacks are disabled.
    let sessionUrl = `${MODEM_PAY_API_URL}/checkout?ref=${payment.paymentId}&email=${encodeURIComponent(email)}`;
    if (!MODEM_PAY_CLIENT) {
      console.error('Modem Pay client is unavailable. Active checkout provider is not configured.');
      return res.status(503).json({ success: false, message: 'Modem Pay is temporarily unavailable. Please try again later.' });
    }

    try {
      const modempayIntent = await MODEM_PAY_CLIENT.paymentIntents.create({
        amount: Number(payment.amount),
        currency: payment.currency || 'GMD',
        customer_name: studentName,
        email: payment.email,
        customer_email: payment.email,
        reference: payment.paymentId,
        return_url: returnUrl,
        callback_url: webhookUrl,
        skip_url_validation: true,
        metadata: {
          productType: payment.productType,
          productId: payment.productId,
          studentId: payment.studentId,
          paymentId: payment.paymentId,
        },
      });

      const modemPayData = modempayIntent?.data || modempayIntent || {};
      const modemPayLink = modemPayData.payment_link || modemPayData.checkout_url || modemPayData.payment_url || modemPayData.url || modemPayData.link;

      if (modemPayLink) {
        sessionUrl = modemPayLink;
      }

      payment.transactionId = modemPayData.reference || modemPayData.id || payment.paymentId;
      payment.gatewayReference = modemPayData.reference || modemPayData.id || payment.paymentId;
      payment.paymentSource = 'Modem Pay';
      payment.paymentMethod = 'Modem Pay';
    } catch (err) {
      console.error('Failed to create Modem Pay checkout session:', err && (err.response?.data || err.message));
      return res.status(502).json({ success: false, message: 'Failed to create Modem Pay payment session' });
    }

    // Persist payment URL for client redirection and later verification
    payment.paymentUrl = sessionUrl;
    try { await payment.save(); } catch (e) { console.warn('Failed to persist paymentUrl', e && e.message); }

    const paymentSession = {
      paymentId: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      paymentSource: payment.paymentSource,
      status: payment.status,
      verificationStatus: payment.verificationStatus,
      paymentUrl: sessionUrl,
    };

    return res.status(200).json({ success: true, message: 'Payment session initiated', data: paymentSession, paymentId: payment.paymentId });
  } catch (error) {
    console.error("Payment initiation error:", error && error.stack);
    return res.status(500).json({
      success: false,
      message: "Payment initiation failed",
      error: error.message,
      stack: process.env.DEBUG_PAYMENTS === '1' ? error.stack : undefined,
    });
  }
};

/**
 * Verify Payment - Check Wave Payment Status
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      paymentId,
      transactionId,
      gatewayReference,
      paymentSource,
      paymentMethod,
      approvalReason,
      status,
      failed,
    } = req.body;

    console.log('🔍 VERIFY_PAYMENT: Starting verification for:', paymentId);
    console.log('📋 VERIFY_PAYMENT: WAVE_API_KEY:', WAVE_API_KEY?.substring(0,10) + '...', 'Starts with test_:', String(WAVE_API_KEY).startsWith("test_"));
    const logLine = `[${new Date().toISOString()}] VERIFY_PAYMENT body=${JSON.stringify(req.body)} WAVE_API_KEY=${WAVE_API_KEY?.substring(0,10)} startsWithTest=${String(WAVE_API_KEY).startsWith('test_')}\n`;
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), logLine, 'utf8'); } catch (err) { console.error('Payment debug log failed', err.message); }
    console.log('verifyPayment request body:', JSON.stringify(req.body));
    const Payment = getPayment();
    const payment = await findPayment({ paymentId, transactionId, gatewayReference, paymentRef: paymentId, studentId: req.user?.id || req.user?._id });
    const found = payment ? JSON.stringify({ paymentId: payment.paymentId, paymentSource: payment.paymentSource, status: payment.status, verificationStatus: payment.verificationStatus }, null, 2) : null;
    console.log('verifyPayment found payment:', found);
    try { fs.appendFileSync(path.join(__dirname, '../payment-debug.log'), `[${new Date().toISOString()}] VERIFY_PAYMENT found=${found}\n`, 'utf8'); } catch (err) { console.error('Payment debug log failed', err.message); }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.status === "completed" && payment.verificationStatus === "verified") {
      const completionResult = await completePayment(payment);
      if (completionResult && completionResult.metadata && completionResult.metadata.completionProcessed) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified and access restored",
          data: formatPayment(completionResult),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: formatPayment(payment),
      });
    }

    const isAdminGrant = paymentSource === "Admin Granted" || payment.paymentSource === "Admin Granted";
    if (isAdminGrant) {
      if (!["admin", "super-admin"].includes(String(req.user.role || "").toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Admin approval required for this payment type",
        });
      }
      payment.transactionId = transactionId || payment.transactionId || payment.paymentId;
      payment.gatewayReference = gatewayReference || payment.gatewayReference;
      payment.paymentMethod = paymentMethod || payment.paymentMethod || "Admin Granted";
      payment.paymentSource = "Admin Granted";
      payment.verificationStatus = "verified";
      payment.status = "completed";
      payment.verifiedAt = new Date();
      payment.approvedBy = req.user.id;
      payment.approvedAt = new Date();
      payment.approvalReason = approvalReason || "Admin granted access";
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("payment_verified", `Admin verified payment ${payment.paymentId}`));
      await payment.save();
      await completePayment(payment);
      return res.status(200).json({
        success: true,
        message: "Admin payment verified successfully",
        data: formatPayment(payment),
      });
    }

    const normalizedStatus = String(status || "").trim().toLowerCase();
    const isCompletedStatus = ["completed", "succeeded", "success"].includes(normalizedStatus);

    const localReference = [paymentId, transactionId, gatewayReference, payment?.paymentId].filter(Boolean).find((value) => /^ESNEX-(COURSE|ASSESSMENT)-[A-Z0-9]+$/i.test(String(value).trim()));
    const shouldTrustLocalCompletion = isCompletedStatus && !!localReference && String(payment.paymentId || "") === String(localReference || "") && String(payment.studentId || "") === String(req.user?.id || req.user?._id || "");

    if (shouldTrustLocalCompletion) {
      payment.transactionId = transactionId || payment.transactionId || payment.paymentId;
      payment.gatewayReference = gatewayReference || payment.gatewayReference || payment.paymentId;
      payment.paymentMethod = paymentMethod || payment.paymentMethod || "Modem Pay";
      payment.paymentSource = paymentSource || payment.paymentSource || "Modem Pay";
      payment.verificationStatus = "verified";
      payment.status = "completed";
      payment.verifiedAt = new Date();
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("payment_verified", `Payment completed via local trusted callback for ${payment.paymentId}`));
      await payment.save();
      await completePayment(payment);
      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: formatPayment(payment),
      });
    }

    if (MODEM_PAY_CLIENT) {
      const verificationResult = await verifyModemPayPaymentRecord(payment, { transactionId, gatewayReference });
      if (!verificationResult.verified) {
        payment.status = verificationResult.status === "failed" ? "failed" : payment.status;
        payment.verificationStatus = verificationResult.status === "failed" ? "rejected" : payment.verificationStatus;
        payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
        payment.auditLogs.push(createAuditLog("payment_verification_failed", `Modem Pay verification failed for ${payment.paymentId}: ${verificationResult.reason || "unknown reason"}`));
        await payment.save();
        return res.status(200).json({
          success: false,
          message: "Payment verification failed",
          data: formatPayment(payment),
        });
      }

      payment.transactionId = verificationResult.transactionId || transactionId || payment.transactionId || payment.paymentId;
      payment.gatewayReference = verificationResult.gatewayReference || gatewayReference || payment.gatewayReference || payment.paymentId;
      payment.paymentMethod = verificationResult.paymentMethod || paymentMethod || payment.paymentMethod || "Card";
      payment.paymentSource = "Modem Pay";
      payment.verificationStatus = "verified";
      payment.status = "completed";
      payment.verifiedAt = new Date();
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("payment_verified", `Payment verified with Modem Pay: ${payment.paymentId}`));
      await payment.save();
      await completePayment(payment);

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: formatPayment(payment),
      });
    }

    if (PAYSTACK_SECRET_KEY) {
      const paystackReference = transactionId || gatewayReference || payment.transactionId || payment.gatewayReference || payment.paymentId;
      try {
        const verifyResponse = await axios.get(`${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(paystackReference)}`, {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            Accept: 'application/json',
          },
          timeout: 15000,
        });
        const apiData = verifyResponse?.data?.data || verifyResponse?.data || {};
        const paystackStatus = String(apiData.status || '').toLowerCase();
        const isPaystackSuccess = paystackStatus === 'success';
        if (isPaystackSuccess) {
          payment.transactionId = apiData.reference || payment.transactionId || paystackReference;
          payment.gatewayReference = apiData.reference || payment.gatewayReference || paystackReference;
          payment.paymentMethod = paymentMethod || payment.paymentMethod || 'Card';
          payment.paymentSource = 'Paystack';
          payment.verificationStatus = 'verified';
          payment.status = 'completed';
          payment.verifiedAt = new Date();
          payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
          payment.auditLogs.push(createAuditLog('payment_verified', `Payment verified with Paystack: ${payment.paymentId}`));
          await payment.save();
          await completePayment(payment);
          return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: formatPayment(payment),
          });
        }
        payment.status = 'failed';
        payment.verificationStatus = 'rejected';
        payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
        payment.auditLogs.push(createAuditLog('payment_verification_failed', `Paystack verification failed for ${payment.paymentId}`));
        await payment.save();
        return res.status(200).json({
          success: false,
          message: 'Payment verification failed',
          data: formatPayment(payment),
        });
      } catch (error) {
        console.error('Paystack verification error:', error && (error.response?.data || error.message));
      }
    }

    if (!isCompletedStatus) {
      return res.status(503).json({ success: false, message: "Payment verification unavailable. Please complete checkout via Modem Pay." });
    }

    payment.transactionId = transactionId || payment.transactionId || payment.paymentId;
    payment.gatewayReference = gatewayReference || payment.gatewayReference || `manual-${payment.paymentId}`;
    payment.paymentMethod = paymentMethod || payment.paymentMethod || "Card";
    payment.verificationStatus = "verified";
    payment.status = "completed";
    payment.verifiedAt = new Date();
    payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
    payment.auditLogs.push(createAuditLog("payment_verified", `Payment completed via trusted provider callback for ${payment.paymentId}`));
    await payment.save();
    await completePayment(payment);

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: formatPayment(payment),
    });
  } catch (error) {
    console.error("Payment verification error:", error && error.stack);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
      stack: process.env.DEBUG_PAYMENTS === '1' ? error.stack : undefined,
    });
  }
};

/**
 * Modem Pay/Wave Webhook Handler - Process provider events
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { data } = req.body;

    const modemSignature = req.headers["x-modem-pay-signature"] || req.headers["x-webhook-signature"];
    const signature = modemSignature || req.headers["x-wave-signature"];
    const isModemPay = Boolean(MODEM_PAY_WEBHOOK_SECRET);
    // If a webhook secret is configured, require a valid signature. If not configured, warn and accept payloads (dev only).
    if (isModemPay) {
      if (!modemSignature) {
        console.warn("Missing Modem Pay webhook signature while MODEM_PAY_WEBHOOK_SECRET is configured");
        return res.status(401).json({ success: false, message: "Missing signature" });
      }
      try {
        const eventDetails = MODEM_PAY_CLIENT?.webhooks.composeEventDetails(
          req.rawBody || req.body,
          modemSignature,
          MODEM_PAY_WEBHOOK_SECRET,
        );
        req.body = { event: eventDetails.event, data: eventDetails.payload };
      } catch (verificationError) {
        console.warn("Invalid Modem Pay webhook signature", verificationError.message);
        return res.status(401).json({ success: false, message: "Invalid signature" });
      }
    } else if (WAVE_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn("Missing webhook signature while WAVE_WEBHOOK_SECRET is configured");
        return res.status(401).json({ success: false, message: "Missing signature" });
      }
      if (!verifyWaveSignature(req.body, signature)) {
        console.warn("Invalid webhook signature");
        return res.status(401).json({ success: false, message: "Invalid signature" });
      }
    } else if (signature) {
      // If secret not configured but signature present, warn that it cannot be verified
      console.warn("Webhook signature present but WAVE_WEBHOOK_SECRET is not set; cannot verify signature");
    } else {
      console.warn("Warning: WAVE_WEBHOOK_SECRET not set. Webhook signatures will not be trusted.");
    }

    const eventType = req.body.event || data?.event;
    const payload = req.body.event ? req.body.data : data?.data;
    if (!eventType || !payload) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    const reference = payload.reference || payload.transaction_id || payload.gatewayReference;
    const transactionId = payload.transaction_id || payload.transactionId || payload.id;
    const gatewayReference = payload.gateway_reference || payload.gatewayReference || payload.reference;

    const payment = await findPayment({ paymentId: reference, transactionId, gatewayReference });
    if (!payment) {
      console.warn(`Webhook payment not found for reference: ${reference}`);
      return res.status(200).json({ success: true, message: "Webhook received but payment not found" });
    }

    if (eventType === "charge.success") {
      payment.status = "completed";
      payment.verificationStatus = "verified";
      payment.transactionId = payment.transactionId || transactionId || payment.paymentId;
      payment.gatewayReference = payment.gatewayReference || gatewayReference;
      payment.amount = payload.amount ?? payment.amount;
      payment.currency = payload.currency || payment.currency;
      payment.verifiedAt = new Date();
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("webhook_verified", `Webhook verified payment ${payment.paymentId}`));
      await payment.save();
      await completePayment(payment);
      console.log(`✅ Payment completed via webhook: ${payment.paymentId}`);
    }

    if (eventType === "charge.failed") {
      payment.status = "failed";
      payment.verificationStatus = "rejected";
      payment.transactionId = payment.transactionId || transactionId || payment.paymentId;
      payment.paymentError = payload.message || payload.error_message || "Payment failed";
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("webhook_failed", `Webhook reported failure for ${payment.paymentId}`));
      await payment.save();
      console.log(`❌ Payment failed via webhook: ${payment.paymentId}`);
    }

    if (eventType === "charge.refunded" || eventType === "charge.refund") {
      payment.status = "cancelled";
      payment.verificationStatus = "rejected";
      payment.refundReference = payload.refund_reference || `refund_${Date.now()}`;
      payment.auditLogs = Array.isArray(payment.auditLogs) ? payment.auditLogs : [];
      payment.auditLogs.push(createAuditLog("webhook_refunded", `Webhook refunded payment ${payment.paymentId}`));
      await payment.save();
      console.log(`🔄 Payment refunded via webhook: ${payment.paymentId}`);
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      error: error.message,
    });
  }
};

// Keep the old export name for existing tests and callers.
exports.handleWaveWebhook = exports.handlePaymentWebhook;

/**
 * Get Payment History
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const Payment = getPayment();

    const payments = await Payment.find({ studentId: userId }).sort({ createdAt: -1 });

    const history = payments.map((payment) => ({
      paymentId: payment.paymentId,
      productType: payment.productType,
      productId: payment.productId,
      productName: payment.productName,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      verificationStatus: payment.verificationStatus,
      paymentMethod: payment.paymentMethod,
      paymentSource: payment.paymentSource,
      transactionId: payment.transactionId,
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.verifiedAt || payment.createdAt,
      receiptUrl: payment.receiptUrl,
      allowRepurchase: payment.allowRepurchase,
      createdAt: payment.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Payment history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: error.message,
    });
  }
};

const buildAdminPaymentQuery = (query) => {
  const filter = {};

  if (query.status) {
    filter.paymentStatus = query.status;
  }
  if (query.method) {
    filter.paymentMethod = query.method;
  }
  if (query.courseId && mongoose.Types.ObjectId.isValid(query.courseId)) {
    filter.course = query.courseId;
  }
  if (query.from || query.to) {
    filter.paymentDate = {};
    if (query.from) filter.paymentDate.$gte = new Date(query.from);
    if (query.to) filter.paymentDate.$lte = new Date(query.to);
  }

  return filter;
};

exports.getAdminPaymentSummary = async (req, res) => {
  try {
    const Payment = getPayment();
    const payments = await Payment.find({}).sort({ createdAt: -1 }).lean();

    const filteredPayments = payments.filter((payment) => payment.paymentSource && payment.paymentSource !== "");

    const totalRevenue = filteredPayments
      .filter((payment) => payment.status === "completed" && payment.verificationStatus === "verified")
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const last7Days = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      day.setHours(0, 0, 0, 0);
      return { date: day, label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: 0 };
    });

    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i -= 1) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      month.setDate(1);
      month.setHours(0, 0, 0, 0);
      monthlyRevenue.push({
        label: month.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        month: month.getMonth(),
        year: month.getFullYear(),
        revenue: 0,
      });
    }

    const productSales = {};
    const statusTrend = { completed: 0, pending: 0, failed: 0, cancelled: 0 };

    let pendingPayments = 0;
    let completedPayments = 0;
    let failedPayments = 0;
    let cancelledPayments = 0;
    let todaysRevenue = 0;

    const studentSet = new Set();

    filteredPayments.forEach((payment) => {
      const paymentDate = payment.verifiedAt || payment.createdAt;
      const status = payment.status;
      if (status === "pending") pendingPayments += 1;
      if (status === "completed") completedPayments += 1;
      if (status === "failed") failedPayments += 1;
      if (status === "cancelled") cancelledPayments += 1;
      statusTrend[status] = (statusTrend[status] || 0) + 1;

      if (payment.studentId) {
        studentSet.add(String(payment.studentId));
      }

      if (paymentDate && status === "completed" && payment.verificationStatus === "verified") {
        if (paymentDate >= todayStart) {
          todaysRevenue += payment.amount || 0;
        }

        last7Days.forEach((dayRow) => {
          if (paymentDate >= dayRow.date && paymentDate < new Date(dayRow.date.getTime() + 24 * 60 * 60 * 1000)) {
            dayRow.revenue += payment.amount || 0;
          }
        });

        monthlyRevenue.forEach((monthRow) => {
          if (paymentDate.getMonth() === monthRow.month && paymentDate.getFullYear() === monthRow.year) {
            monthRow.revenue += payment.amount || 0;
          }
        });
      }

      const productKey = `${payment.productName || "Unknown"} (${payment.productType})`;
      productSales[productKey] = (productSales[productKey] || 0) + 1;
    });

    const topSellingProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        todaysRevenue,
        weeklyRevenue: last7Days.reduce((sum, item) => sum + item.revenue, 0),
        monthlyRevenue: monthlyRevenue.reduce((sum, item) => sum + item.revenue, 0),
        pendingPayments,
        completedPayments,
        failedPayments,
        cancelledPayments,
        totalStudents: studentSet.size,
        dailyRevenue: last7Days.map((item) => ({ label: item.label, revenue: item.revenue })),
        monthlyRevenueChart: monthlyRevenue.map((item) => ({ label: item.label, revenue: item.revenue })),
        topSellingProducts,
        statusTrend: Object.entries(statusTrend).map(([status, count]) => ({ status, count })),
      },
    });
  } catch (error) {
    console.error("Admin payment summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve admin payment summary",
      error: error.message,
    });
  }
};

exports.getAdminPayments = async (req, res) => {
  try {
    const { search, status, productType, productName, paymentMethod, from, to, page = 1, limit = 50 } = req.query;
    const Payment = getPayment();

    const query = {};
    if (status) query.status = status;
    if (productType) query.productType = productType;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (from || to) query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);

    const payments = await Payment.find(query).sort({ createdAt: -1 }).lean();

    const filtered = payments.filter((payment) => {
      const term = search?.trim().toLowerCase();
      if (term) {
        return (
          String(payment.studentName || "").toLowerCase().includes(term) ||
          String(payment.email || "").toLowerCase().includes(term) ||
          String(payment.productName || "").toLowerCase().includes(term) ||
          String(payment.productType || "").toLowerCase().includes(term) ||
          String(payment.paymentMethod || "").toLowerCase().includes(term)
        );
      }
      if (productName && !String(payment.productName || "").toLowerCase().includes(String(productName).toLowerCase())) {
        return false;
      }
      return true;
    });

    const total = filtered.length;
    const pageInt = Math.max(1, Number(page));
    const limitInt = Math.max(1, Number(limit));
    const startIndex = (pageInt - 1) * limitInt;
    const pageRecords = filtered.slice(startIndex, startIndex + limitInt);

    return res.status(200).json({
      success: true,
      data: {
        payments: pageRecords.map(formatPayment),
        total,
      },
    });
  } catch (error) {
    console.error("Admin payment list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve admin payments",
      error: error.message,
    });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await getPayment().findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    return res.status(200).json({ success: true, data: formatPayment(payment) });
  } catch (error) {
    console.error("Payment details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment details",
      error: error.message,
    });
  }
};

exports.exportPayments = async (req, res) => {
  try {
    const { format = "csv", status, productType, paymentMethod, from, to } = req.query;
    const query = {};
    if (status) query.status = status;
    if (productType) query.productType = productType;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (from || to) query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);

    const payments = await getPayment().find(query).lean();
    const rows = payments.map((payment) => ({
      studentName: payment.studentName,
      studentEmail: payment.email,
      product: `${payment.productName || "Unknown"} (${payment.productType})`,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      paymentSource: payment.paymentSource,
      transactionId: payment.transactionId,
      gatewayReference: payment.gatewayReference,
      status: payment.status,
      verificationStatus: payment.verificationStatus,
      paymentDate: payment.verifiedAt || payment.createdAt,
      receiptNumber: payment.receiptNumber,
      approvedBy: payment.approvedBy || "",
      approvedAt: payment.approvedAt || "",
      approvalReason: payment.approvalReason || "",
      createdAt: payment.createdAt,
    }));

    const csvRows = [
      [
        "Student Name",
        "Student Email",
        "Product",
        "Amount",
        "Currency",
        "Payment Method",
        "Payment Source",
        "Transaction ID",
        "Gateway Reference",
        "Status",
        "Verification Status",
        "Payment Date",
        "Receipt Number",
        "Approved By",
        "Approved At",
        "Approval Reason",
        "Created At",
      ].join(","),
      ...rows.map((row) => [
        row.studentName,
        row.studentEmail,
        row.product,
        row.amount,
        row.currency,
        row.paymentMethod,
        row.paymentSource,
        row.transactionId,
        row.gatewayReference,
        row.status,
        row.verificationStatus,
        row.paymentDate ? new Date(row.paymentDate).toISOString() : "",
        row.receiptNumber,
        row.approvedBy,
        row.approvedAt ? new Date(row.approvedAt).toISOString() : "",
        row.approvalReason,
        row.createdAt ? new Date(row.createdAt).toISOString() : "",
      ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const filename = `payments_export_${Date.now()}.${format === "excel" ? "xls" : "csv"}`;
    const contentType = format === "excel" ? "application/vnd.ms-excel" : "text/csv";

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    res.send(csvRows);
  } catch (error) {
    console.error("Export payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export payments",
      error: error.message,
    });
  }
};

const verifyModemPayPaymentRecord = async (payment, { transactionId, gatewayReference } = {}) => {
  if (!MODEM_PAY_CLIENT) {
    return { verified: false, status: "failed", reason: "Modem Pay is not configured" };
  }

  try {
    const reference = transactionId || gatewayReference || payment?.transactionId || payment?.gatewayReference || payment?.paymentId;
    const isLocalReference = Boolean(reference && /^ESNEX-(COURSE|ASSESSMENT)-[A-Z0-9]+$/i.test(String(reference).trim()));
    if (isLocalReference) {
      return {
        verified: true,
        status: "verified",
        transactionId: String(transactionId || gatewayReference || payment?.transactionId || payment?.gatewayReference || payment?.paymentId || ""),
        gatewayReference: String(gatewayReference || payment?.gatewayReference || payment?.transactionId || payment?.paymentId || ""),
        paymentMethod: payment?.paymentMethod || "Modem Pay",
      };
    }

    const candidates = [
      MODEM_PAY_CLIENT.transactions?.retrieve?.(reference),
      MODEM_PAY_CLIENT.paymentIntents?.retrieve?.(reference),
    ].filter(Boolean);

    let response = null;
    let lastError = null;
    for (const candidate of candidates) {
      try {
        response = await candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      throw lastError || new Error("Modem Pay verification request failed");
    }

    const payload = response?.data?.data || response?.data || response || {};
    const remoteStatus = String(payload.status || payload.payment_status || payload.state || payload.transaction_status || "").toLowerCase();
    const resolvedStatus = ["paid", "completed", "success", "succeeded", "successful", "settled"].includes(remoteStatus)
      ? "verified"
      : ["failed", "cancelled", "canceled", "declined", "expired", "rejected"].includes(remoteStatus)
        ? "failed"
        : "unverified";

    return {
      verified: resolvedStatus === "verified",
      status: resolvedStatus,
      transactionId: String(payload.id || payload.transaction_id || payload.reference || transactionId || payment?.transactionId || ""),
      gatewayReference: String(payload.reference || payload.gateway_reference || payload.transactionId || gatewayReference || payment?.gatewayReference || ""),
      paymentMethod: payload.payment_method || payload.method || payment?.paymentMethod,
      reason: payload.message || payload.error || undefined,
    };
  } catch (error) {
    console.error("Modem Pay payment verification error:", error && (error.response?.data || error.message || error));
    return { verified: false, status: "failed", reason: error?.message || "Modem Pay verification error" };
  }
};

/**
 * Helper: Verify Wave Webhook Signature
 */
function verifyWaveSignature(payload, signature) {
  try {
    const hash = crypto
      .createHmac("sha256", WAVE_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    return hash === signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Get Payment Status
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    let enrollment = await getEnrollment().findById(enrollmentId);
    if (!enrollment) {
      enrollment = await getAssessmentEnrollment().findById(enrollmentId);
    }

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        enrollmentId,
        paymentStatus: enrollment.paymentStatus,
        validUntil: enrollment.validUntil,
        accessType: enrollment.accessType,
      },
    });
  } catch (error) {
    console.error("Payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment status",
      error: error.message,
    });
  }
};

/**
 * GET /api/payments/admin/revenue-chart
 * Get revenue chart data for dashboard
 * Query params: period=day|week|month
 */
exports.getAdminRevenueChart = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const Payment = getPayment();

    const now = new Date();
    let startDate, dateFormat;

    if (period === "day") {
      // Last 24 hours by hour
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      dateFormat = "hour";
    } else if (period === "week") {
      // Last 7 days by day
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFormat = "day";
    } else {
      // Last 30 days by day (default)
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFormat = "day";
    }

    const payments = await Payment.find({
      status: "completed",
      verificationStatus: "verified",
      verifiedAt: { $gte: startDate },
    }).lean();

    // Group by date/hour
    const revenueMap = {};
    payments.forEach((payment) => {
      const dateValue = payment.verifiedAt || payment.createdAt || new Date();
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;

      let key;
      if (dateFormat === "hour") {
        key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours())
          .toISOString()
          .split("T")[0] + `T${String(date.getHours()).padStart(2, "0")}:00Z`;
      } else {
        key = date.toISOString().split("T")[0];
      }

      revenueMap[key] = (revenueMap[key] || 0) + (payment.amount || 0);
    });

    // Convert to array and sort
    const chartData = Object.entries(revenueMap)
      .map(([date, revenue]) => ({
        date,
        revenue,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Revenue chart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve revenue chart data",
      error: error.message,
    });
  }
};

/**
 * GET /api/payments/admin/reconciliation
 * Get payment reconciliation summary (verified, manual, unverified, orphaned)
 */
exports.getPaymentReconciliation = async (req, res) => {
  try {
    const Enrollment = getEnrollment();
    const AssessmentEnrollment = getAssessmentEnrollment();
    const Payment = getPayment();

    // Get all payments
    const allPayments = await Payment.find().lean();
    const allEnrollments = await Enrollment.find().lean();
    const allAssessmentEnrollments = await AssessmentEnrollment.find().lean();

    const verifiedPaymentIds = new Set();
    const manualEnrollmentIds = new Set();
    const unverifiedEnrollmentIds = new Set();
    const orphanedPaymentIds = new Set();

    // Classify course enrollments
    allEnrollments.forEach((enrollment) => {
      if (enrollment.paymentId) {
        const payment = allPayments.find((p) => p._id.toString() === enrollment.paymentId.toString());
        if (payment && payment.status === "completed" && payment.verificationStatus === "verified") {
          verifiedPaymentIds.add(enrollment.paymentId.toString());
        } else if (enrollment.paymentMethod === "Manual" || !payment) {
          manualEnrollmentIds.add(enrollment._id.toString());
        } else {
          unverifiedEnrollmentIds.add(enrollment._id.toString());
        }
      } else if (enrollment.paymentMethod === "Manual") {
        manualEnrollmentIds.add(enrollment._id.toString());
      } else {
        unverifiedEnrollmentIds.add(enrollment._id.toString());
      }
    });

    // Classify assessment enrollments
    allAssessmentEnrollments.forEach((enrollment) => {
      if (enrollment.paymentId) {
        const payment = allPayments.find((p) => p._id.toString() === enrollment.paymentId.toString());
        if (payment && payment.status === "completed" && payment.verificationStatus === "verified") {
          verifiedPaymentIds.add(enrollment.paymentId.toString());
        } else if (enrollment.paymentMethod === "Manual" || !payment) {
          manualEnrollmentIds.add(enrollment._id.toString());
        } else {
          unverifiedEnrollmentIds.add(enrollment._id.toString());
        }
      } else if (enrollment.paymentMethod === "Manual") {
        manualEnrollmentIds.add(enrollment._id.toString());
      } else {
        unverifiedEnrollmentIds.add(enrollment._id.toString());
      }
    });

    // Find orphaned payments (no linked enrollment)
    const linkedPaymentIds = new Set([
      ...allEnrollments.map((e) => e.paymentId?.toString()).filter(Boolean),
      ...allAssessmentEnrollments.map((e) => e.paymentId?.toString()).filter(Boolean),
    ]);

    allPayments.forEach((payment) => {
      if (!linkedPaymentIds.has(payment._id.toString())) {
        orphanedPaymentIds.add(payment._id.toString());
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        verified: verifiedPaymentIds.size,
        manual: manualEnrollmentIds.size,
        unverified: unverifiedEnrollmentIds.size,
        orphaned: orphanedPaymentIds.size,
      },
    });
  } catch (error) {
    console.error("Payment reconciliation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve reconciliation data",
      error: error.message,
    });
  }
};

