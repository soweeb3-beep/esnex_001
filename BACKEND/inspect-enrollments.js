const { getModel } = require('./config/adapter');
const mongoose = require('mongoose');

(async () => {
  try {
    const AssessmentEnrollment = getModel('AssessmentEnrollment');
    const Assessment = getModel('Assessment');
    const Payment = getModel('Payment');
    const userId = '6a14599e48d9114de54e63b0';
    const enrollments = await AssessmentEnrollment.find({ studentId: userId }).lean();
    console.log('ENROLLMENT_COUNT', enrollments.length);
    for (const enrollment of enrollments) {
      console.log('---');
      console.log('id:', enrollment._id);
      console.log('assessmentId:', enrollment.assessmentId, 'type:', typeof enrollment.assessmentId);
      console.log('assessmentId is Object:', enrollment.assessmentId && enrollment.assessmentId._bsontype);
      console.log('status:', enrollment.status, 'accessGranted:', enrollment.accessGranted, 'paymentStatus:', enrollment.paymentStatus);
      console.log('source:', enrollment.source, 'subscriptionStatus:', enrollment.subscriptionStatus);
      console.log('createdAt:', enrollment.createdAt);
      console.log('raw assessmentId JSON:', JSON.stringify(enrollment.assessmentId));
      if (enrollment.assessmentId) {
        const assess = await Assessment.findById(enrollment.assessmentId).lean();
        console.log('found assessment:', assess ? { id: assess._id, name: assess.name, subject: assess.subject } : 'NOT FOUND');
      }
    }
    const latestPayment = await Payment.find({ studentId: userId, productType: 'assessment' }).sort({ createdAt: -1 }).limit(5).lean();
    console.log('LATEST_PAYMENTS', JSON.stringify(latestPayment, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();