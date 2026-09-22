const { getModel } = require("../config/adapter");

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const idsEqual = (left, right) => {
  if (left == null || right == null) return false;
  return String(left) === String(right);
};

const getExpiryValue = (enrollment) =>
  enrollment?.expiresAt || enrollment?.expiryDate || enrollment?.validUntil || null;

const isActiveAssessmentEnrollment = (enrollment) => {
  if (!enrollment) return false;
  if (enrollment.accessGranted === false) return false;

  const status = String(enrollment.subscriptionStatus || enrollment.status || "active").toLowerCase();
  if (["expired", "cancelled", "canceled"].includes(status)) return false;

  const expiry = getExpiryValue(enrollment);
  if (expiry && new Date() > new Date(expiry)) return false;

  const paymentStatus = String(enrollment.paymentStatus || "").toLowerCase();
  return (
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    Boolean(enrollment.paymentReference) ||
    status === "active"
  );
};

const markEnrollmentExpired = async (enrollment) => {
  if (!enrollment) return null;
  const AssessmentEnrollment = getModel("AssessmentEnrollment");
  const update = {
    accessGranted: false,
    subscriptionStatus: "expired",
    status: "expired",
  };
  if (enrollment._id && typeof AssessmentEnrollment.findByIdAndUpdate === "function") {
    await AssessmentEnrollment.findByIdAndUpdate(enrollment._id, update).catch(() => null);
  }
  Object.assign(enrollment, update);
  return enrollment;
};

const listStudentEnrollments = async (studentId) => {
  const AssessmentEnrollment = getModel("AssessmentEnrollment");
  const result = await AssessmentEnrollment.find({ studentId });
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?._result)) return result._result;
  return [];
};

const findActiveAssessmentEnrollment = async ({ studentId, assessmentId, subject } = {}) => {
  if (!studentId) return null;
  const enrollments = await listStudentEnrollments(studentId);
  const Assessment = getModel("Assessment");

  const candidates = [];
  for (const enrollment of enrollments) {
    if (!enrollment) continue;
    const expiry = getExpiryValue(enrollment);
    if (expiry && new Date() > new Date(expiry)) {
      await markEnrollmentExpired(enrollment);
      continue;
    }
    if (!isActiveAssessmentEnrollment(enrollment)) continue;
    candidates.push(enrollment);
  }

  const exact = candidates.find((enrollment) => idsEqual(enrollment.assessmentId?._id || enrollment.assessmentId, assessmentId));
  if (exact) return exact;

  const subjectKey = String(subject || "").trim().toLowerCase();
  if (!subjectKey) return null;

  for (const enrollment of candidates) {
    const enrolledAssessmentId = enrollment.assessmentId?._id || enrollment.assessmentId;
    let assessment = enrollment.assessmentId && typeof enrollment.assessmentId === "object" && enrollment.assessmentId.subject
      ? enrollment.assessmentId
      : null;
    if (!assessment && enrolledAssessmentId) {
      try {
        assessment = await Assessment.findById(enrolledAssessmentId);
      } catch (error) {
        assessment = null;
      }
    }
    const enrolledSubject = String(assessment?.subject || assessment?.name || "").trim().toLowerCase();
    if (enrolledSubject && enrolledSubject === subjectKey) {
      return enrollment;
    }
  }

  return null;
};

const buildAssessmentEnrollmentPayload = (payment) => {
  const paidAt = payment.paidAt || payment.verifiedAt || new Date();
  const expiresAt = payment.expiresAt || payment.metadata?.expiresAt || payment.metadata?.expiryDate || new Date(new Date(paidAt).getTime() + MONTH_MS);
  return {
    assessmentId: payment.productId,
    studentId: payment.studentId,
    accessGranted: true,
    status: "active",
    paymentId: payment._id,
    paidAt,
    expiresAt,
    paymentDate: paidAt,
    expiryDate: expiresAt,
    validUntil: expiresAt,
    paymentStatus: "paid",
    paymentReference: payment.paymentId,
    transactionId: payment.transactionId || payment.gatewayReference || payment.paymentId,
    paymentMethod: payment.paymentMethod || "Modem Pay",
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency || "GMD",
    subscriptionType: payment.paymentSource === "Admin Granted" || Number(payment.amount) === 0 ? "free" : "monthly",
    subscriptionStatus: "active",
    accessType: "assessment",
  };
};

const upsertAssessmentEnrollmentFromPayment = async (payment) => {
  const AssessmentEnrollment = getModel("AssessmentEnrollment");
  const payload = buildAssessmentEnrollmentPayload(payment);

  if (typeof AssessmentEnrollment.findOneAndUpdate === "function") {
    const updated = await AssessmentEnrollment.findOneAndUpdate(
      { assessmentId: payment.productId, studentId: payment.studentId },
      { $set: payload, $setOnInsert: { enrolledDate: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (updated) {
      console.log(`[PAYMENT->ENROLL] Upserted assessment enrollment student=${payment.studentId} assessment=${payment.productId} id=${updated._id || updated.id}`);
      return updated;
    }
  }

  const existing = await AssessmentEnrollment.findOne({ assessmentId: payment.productId, studentId: payment.studentId });
  if (existing) {
    Object.assign(existing, payload);
    if (typeof existing.save === "function") {
      await existing.save();
    } else {
      await AssessmentEnrollment.findByIdAndUpdate(existing._id || existing.id, payload);
    }
    return existing;
  }

  return AssessmentEnrollment.create({ ...payload, enrolledDate: new Date() });
};

module.exports = {
  MONTH_MS,
  idsEqual,
  getExpiryValue,
  isActiveAssessmentEnrollment,
  markEnrollmentExpired,
  findActiveAssessmentEnrollment,
  buildAssessmentEnrollmentPayload,
  upsertAssessmentEnrollmentFromPayment,
};
