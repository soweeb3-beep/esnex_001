/*
 * Stage 1 payment/access regression tests.
 *
 * These tests replace the model adapter with an in-memory implementation so
 * they do not alter BACKEND/data or a configured MongoDB database.
 */
const assert = require("node:assert/strict");

const rows = { payments: [], enrollments: [], assessments: [] };
const id = (() => { let n = 1; return () => `id-${n++}`; })();

const matches = (row, query = {}) => Object.entries(query).every(([key, value]) => String(row[key]) === String(value));
const makeDoc = (row, collection) => {
  if (!row) return null;
  row.save = async () => row;
  return row;
};
const model = (collection) => ({
  async findById(value) { return makeDoc(rows[collection].find((row) => String(row._id) === String(value)), collection); },
  async findOne(query) { return makeDoc(rows[collection].find((row) => matches(row, query)), collection); },
  async create(data) {
    const row = { _id: data._id || id(), ...data };
    rows[collection].push(row);
    return makeDoc(row, collection);
  },
  async findByIdAndUpdate(value, update) {
    const row = rows[collection].find((item) => String(item._id) === String(value));
    if (!row) return null;
    Object.assign(row, update);
    return makeDoc(row, collection);
  },
  find(query = {}) {
    const result = rows[collection].filter((row) => matches(row, query)).map((row) => makeDoc(row, collection));
    return {
      then: (resolve) => Promise.resolve(result).then(resolve),
      lean: async () => result,
      sort: () => ({ lean: async () => result }),
    };
  },
});

const adapter = require("../config/adapter");
adapter.getModel = (name) => ({
  Payment: model("payments"),
  AssessmentEnrollment: model("enrollments"),
  Assessment: model("assessments"),
  AssessmentAttempt: { async deleteMany() { return { deletedCount: 0 }; } },
  Enrollment: model("enrollments"),
  Course: model("assessments"),
  User: model("assessments"),
}[name]);

delete require.cache[require.resolve("../controllers/paymentController")];
delete require.cache[require.resolve("../middleware/accessMiddleware")];
const payments = require("../controllers/paymentController");
const { checkAssessmentAccess } = require("../middleware/accessMiddleware");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const verifiedPayment = async ({ studentId = "student-1", assessmentId = "assessment-1", paymentId = id() } = {}) => {
  const payment = await model("payments").create({
    _id: paymentId,
    paymentId: `ESNEX-ASSESSMENT-${paymentId.toUpperCase()}`,
    studentId,
    productType: "assessment",
    productId: assessmentId,
    amount: 101,
    currency: "GMD",
    paymentMethod: "Modem Pay",
    paymentSource: "Modem Pay",
    status: "completed",
    verificationStatus: "verified",
    verifiedAt: new Date("2026-09-18T00:00:00.000Z"),
    metadata: {},
    auditLogs: [],
  });
  return payment;
};

const verify = async (payment, userId = payment.studentId) => {
  const res = response();
  await payments.verifyPayment({ body: { paymentId: payment.paymentId }, user: { id: userId, role: "student" } }, res);
  return res;
};

const access = async (studentId, assessmentId) => {
  const res = response();
  let allowed = false;
  await checkAssessmentAccess({ user: { id: studentId }, params: { assessmentId }, body: {}, query: {}, originalUrl: "/test" }, res, () => { allowed = true; });
  return { allowed, res };
};

(async () => {
  await model("assessments").create({ _id: "assessment-1", type: "global", status: "published", visibility: true, price: 100 });

  // 1. New student + successful payment: API success and one active enrollment.
  const newPayment = await verifiedPayment({ studentId: "new-student" });
  let res = await verify(newPayment);
  assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
  let newEnrollment = rows.enrollments.find((item) => item.studentId === "new-student");
  assert.deepEqual({ accessGranted: newEnrollment.accessGranted, paymentStatus: newEnrollment.paymentStatus, subscriptionStatus: newEnrollment.subscriptionStatus }, { accessGranted: true, paymentStatus: "paid", subscriptionStatus: "active" });

  // 2. Existing pending enrollment is repaired, including its payment link.
  const pending = await model("enrollments").create({ assessmentId: "assessment-1", studentId: "pending-student", accessGranted: false, paymentStatus: "pending", subscriptionStatus: "active", paymentId: "wrong-payment" });
  const pendingPayment = await verifiedPayment({ studentId: "pending-student" });
  res = await verify(pendingPayment);
  assert.equal(res.body.success, true);
  assert.equal(pending.accessGranted, true); assert.equal(pending.paymentStatus, "paid"); assert.equal(String(pending.paymentId), String(pendingPayment._id));

  // 3. Repeated verification leaves exactly one enrollment and does not
  // extend the original monthly expiry.
  const firstExpiry = new Date(pending.expiryDate).toISOString();
  res = await verify(pendingPayment);
  assert.equal(res.body.success, true);
  assert.equal(rows.enrollments.filter((item) => item.studentId === "pending-student").length, 1);
  assert.equal(new Date(pending.expiryDate).toISOString(), firstExpiry);

  // 6. A duplicate success webhook takes the same idempotent reconciliation
  // path and also leaves exactly one enrollment.
  res = response();
  await payments.handleWaveWebhook({
    body: { data: { event: "charge.success", data: { reference: pendingPayment.paymentId, transaction_id: "txn-duplicate", gateway_reference: "gateway-duplicate", amount: 101, currency: "GMD" } } },
    headers: {},
  }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
  assert.equal(rows.enrollments.filter((item) => item.studentId === "pending-student").length, 1);
  assert.equal(new Date(pending.expiryDate).toISOString(), firstExpiry);

  // 4 and 5. Failed/cancelled payments never create access; verify returns a
  // non-success response when no provider confirms them.
  for (const status of ["failed", "cancelled"]) {
    const payment = await model("payments").create({ _id: id(), paymentId: `ESNEX-ASSESSMENT-${status}`, studentId: `${status}-student`, productType: "assessment", productId: "assessment-1", amount: 101, currency: "GMD", status, verificationStatus: "rejected", metadata: {}, auditLogs: [] });
    res = await verify(payment);
    assert.notEqual(res.body.success, true);
    assert.equal(rows.enrollments.some((item) => item.studentId === `${status}-student`), false);
  }

  // 7. Expired monthly access is denied and remains inactive.
  const expiredPayment = await verifiedPayment({ studentId: "expired-student" });
  const expiredEnrollment = await model("enrollments").create({ assessmentId: "assessment-1", studentId: "expired-student", accessGranted: true, paymentStatus: "paid", paymentId: expiredPayment._id, expiryDate: new Date("2020-01-01"), subscriptionStatus: "active" });
  let accessResult = await access("expired-student", "assessment-1");
  assert.equal(accessResult.allowed, false); assert.equal(accessResult.res.statusCode, 403); assert.equal(expiredEnrollment.accessGranted, false);

  // 8. A student without a valid enrollment receives the payment-required API response.
  accessResult = await access("no-access-student", "assessment-1");
  assert.equal(accessResult.allowed, false); assert.equal(accessResult.res.statusCode, 402);

  // 9. An enrollment cannot be used by a different student.
  accessResult = await access("other-student", "assessment-1");
  assert.equal(accessResult.allowed, false); assert.equal(accessResult.res.statusCode, 402);

  // The newly paid student can access the assessment through the same middleware.
  accessResult = await access("new-student", "assessment-1");
  assert.equal(accessResult.allowed, true);

  console.log("Stage 1 payment/access tests: PASS");
})().catch((error) => { console.error(error); process.exit(1); });
