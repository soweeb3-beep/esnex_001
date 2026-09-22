const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const ASSESSMENTS_FILE = path.join(DATA_DIR, 'assessments.json');

const resetFile = (filePath, initial) => {
  fs.writeFileSync(filePath, JSON.stringify(initial, null, 2));
};

const computeSignature = (payload, secret) => {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
};

const clearModule = (modulePath) => {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
};

const run = async () => {
  // Ensure data dir exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Start with clean files
  resetFile(PAYMENTS_FILE, []);
  resetFile(ASSESSMENTS_FILE, []);

  console.log('\n[TEST] 1) Webhook rejected when signature missing (WAVE_WEBHOOK_SECRET set)');
  process.env.WAVE_WEBHOOK_SECRET = 'testsecret123';
  delete process.env.WAVE_API_KEY; // ensure not set for webhook tests
  delete process.env.NODE_ENV;
  clearModule('../controllers/paymentController');
  const pc1 = require('../controllers/paymentController');
  const adapter = require('../config/adapter');
  const Payment = adapter.getModel('Payment');

  // Create a payment record to reference
  const paymentRec = await Payment.create({ paymentId: 'PAY-TEST-1', studentId: 'stu1', productType: 'assessment', productId: 'a1', amount: 100, currency: 'GMD', status: 'pending', verificationStatus: 'unverified', email: 'test@example.com' });

  // Build webhook payload shape expected by handler
  const body = { data: { event: 'charge.success', data: { reference: paymentRec.paymentId, transaction_id: 'tx1', gateway_reference: 'gw1', amount: 100, currency: 'GMD' } } };
  const req = { body, headers: {} };
  let res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };

  await pc1.handleWaveWebhook(req, res);
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
  if (res.statusCode !== 401) throw new Error('Expected 401 when signature missing');

  console.log('[OK] Missing signature correctly rejected');

  console.log('\n[TEST] 2) Webhook rejected when signature wrong');
  // Provide wrong signature
  const req2 = { body, headers: { 'x-wave-signature': 'bad-sig' } };
  res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
  await pc1.handleWaveWebhook(req2, res);
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
  if (res.statusCode !== 401) throw new Error('Expected 401 when signature invalid');
  console.log('[OK] Invalid signature correctly rejected');

  console.log('\n[TEST] 3) Webhook accepted with valid signature and completes payment');
  // Compute correct signature
  const sig = computeSignature(body, process.env.WAVE_WEBHOOK_SECRET);
  const req3 = { body, headers: { 'x-wave-signature': sig } };
  res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
  await pc1.handleWaveWebhook(req3, res);
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
  if (res.statusCode !== 200) throw new Error('Expected 200 on valid webhook');

  // Reload payment record and verify completed
  const found = await Payment.findOne({ paymentId: paymentRec.paymentId });
  const foundRec = Array.isArray(found._result) ? found._result[0] : found._result || found;
  if (!foundRec || (foundRec.status !== 'completed' && foundRec.verificationStatus !== 'verified')) {
    throw new Error('Payment not marked completed after valid webhook');
  }
  console.log('[OK] Valid webhook completed payment');

  console.log('\n[TEST] 4) initiatePayment rejects when amount mismatches product price');
  // Prepare an assessment with price
  const Assessment = adapter.getModel('Assessment');
  const assessment = await Assessment.create({ _id: 'a-price-1', name: 'PriceTest', price: 500, subject: 'test' });
  clearModule('../controllers/paymentController');
  const pc2 = require('../controllers/paymentController');

  const reqInit = { body: { productType: 'assessment', productId: assessment._id, amount: 400, currency: 'GMD', email: 'buyer@example.com' }, user: { id: 'stu2', name: 'Buyer' } };
  res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
  await pc2.initiatePayment(reqInit, res);
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
  if (res.statusCode !== 400) throw new Error('Expected 400 when amount mismatches');
  console.log('[OK] initiatePayment correctly rejected mismatched amount');

  if (!process.env.MODEM_PAY_API_KEY) {
    console.log('\n[TEST] 4b) SKIPPED: Modem Pay not configured in this environment, so the provider checkout session cannot be created.');
  } else {
    console.log('\n[TEST] 4b) course payment accepts the admin price with the 1% transaction fee');
    const Course = adapter.getModel('Course');
    const course = await Course.create({ title: 'Course Price Test', name: 'Course Price Test', price: 500, currency: 'GMD', category: 'test' });
    clearModule('../controllers/paymentController');
    const pcCourse = require('../controllers/paymentController');
    const reqCourse = { body: { productType: 'course', productId: course._id, amount: 505, currency: 'GMD', email: 'coursebuyer@example.com' }, user: { id: 'stu3', name: 'Course Buyer' } };
    res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
    await pcCourse.initiatePayment(reqCourse, res);
    console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
    if (res.statusCode !== 200) throw new Error('Expected 200 when course amount matches the admin price plus 1% transaction fee');
    console.log('[OK] course amount correctly accepted with 1% transaction fee');
  }

  console.log('\n[TEST] 5) verifyPayment replays enrollment creation for already-verified payments');
  const User = adapter.getModel('User');
  const AssessmentModel = adapter.getModel('Assessment');
  const AssessmentEnrollment = adapter.getModel('AssessmentEnrollment');

  const student = await User.create({ name: 'Verified Student', email: 'verified@example.com', password: 'secret', role: 'student' });
  const assessmentCreated = await AssessmentModel.create({
    _id: 'verified-assessment-1',
    name: 'Verified Access Test',
    type: 'global',
    subject: 'Chemistry',
    price: 200,
    duration: 60,
    totalMarks: 50,
    status: 'published',
    visibility: true,
  });
  const paymentCompleted = await Payment.create({
    paymentId: 'PAY-ALREADY-VERIFIED-1',
    studentId: student._id,
    studentName: student.name,
    email: student.email,
    productType: 'assessment',
    productTypeRef: 'Assessment',
    productId: assessmentCreated._id,
    productName: assessmentCreated.name,
    amount: 202,
    currency: 'GMD',
    paymentMethod: 'Modem Pay',
    paymentSource: 'Modem Pay',
    status: 'completed',
    verificationStatus: 'verified',
    transactionId: 'tx-already-verified',
    gatewayReference: 'gw-already-verified',
    metadata: { productTitle: assessmentCreated.name },
    auditLogs: [],
  });

  clearModule('../controllers/paymentController');
  const pc4 = require('../controllers/paymentController');
  const reqAlreadyVerified = { body: { paymentId: paymentCompleted.paymentId }, user: { id: String(student._id), role: 'student' } };
  res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
  await pc4.verifyPayment(reqAlreadyVerified, res);
  const enrollmentAfterVerified = await AssessmentEnrollment.findOne({ assessmentId: assessmentCreated._id, studentId: student._id });
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message, 'enrollment:', !!enrollmentAfterVerified, enrollmentAfterVerified && { accessGranted: enrollmentAfterVerified.accessGranted, paymentStatus: enrollmentAfterVerified.paymentStatus });
  if (res.statusCode !== 200) throw new Error('Expected 200 when verifying an already-correct payment');
  if (!enrollmentAfterVerified || enrollmentAfterVerified.accessGranted !== true || enrollmentAfterVerified.paymentStatus !== 'paid') {
    throw new Error('Expected already-verified payment to create an access-granted assessment enrollment');
  }
  console.log('[OK] verified payment replayed enrollment creation');

  console.log('\n[TEST] 6) verifyPayment in production with missing WAVE_API_KEY fails closed (503)');
  // Create a payment for verify test
  resetFile(PAYMENTS_FILE, []);
  delete process.env.WAVE_API_KEY;
  process.env.NODE_ENV = 'production';
  clearModule('../controllers/paymentController');
  const pc3 = require('../controllers/paymentController');
  const Payment2 = require('../config/adapter').getModel('Payment');
  const p2 = await Payment2.create({ paymentId: 'PAY-PROD-1', studentId: 'stu3', productType: 'assessment', productId: 'a1', amount: 200, currency: 'GMD', status: 'pending', verificationStatus: 'unverified', email: 'prod@example.com' });

  const reqVerify = { body: { paymentId: p2.paymentId }, user: { id: 'stu3', role: 'student' } };
  res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(obj) { this.body = obj; } };
  await pc3.verifyPayment(reqVerify, res);
  console.log(' -> status:', res.statusCode, 'body:', res.body && res.body.message);
  if (res.statusCode !== 503) throw new Error('Expected 503 when WAVE_API_KEY missing in production');
  console.log('[OK] verifyPayment failed closed in production when WAVE_API_KEY missing');

  console.log('\nALL TESTS PASSED');
};

run().catch((err) => {
  console.error('\nTEST FAILURE:', err && err.message);
  process.exit(1);
});
