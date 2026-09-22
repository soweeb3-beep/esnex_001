const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getModel } = require('./config/adapter');

(async () => {
  try {
    await connectDB();
    const User = getModel('User');
    const AssessmentEnrollment = getModel('AssessmentEnrollment');
    const Assessment = getModel('Assessment');

    const user = await User.findOne({ email: 'alpha@gmail.com' }).lean();
    console.log('USER', user ? { id: user._id?.toString?.(), email: user.email, role: user.roleString || user.role, createdAt: user.createdAt } : 'NOT_FOUND');
    if (!user) return;

    const enrollments = await AssessmentEnrollment.find({ studentId: user._id }).lean();
    console.log('ENROLLMENTS_COUNT', enrollments.length);
    for (const enrollment of enrollments) {
      console.log('--- ENROLLMENT ---');
      console.log('id:', enrollment._id?.toString());
      console.log('assessmentId:', enrollment.assessmentId, 'type:', typeof enrollment.assessmentId);
      console.log('raw assessmentId JSON:', JSON.stringify(enrollment.assessmentId));
      console.log('accessGranted:', enrollment.accessGranted, 'status:', enrollment.status, 'subscriptionStatus:', enrollment.subscriptionStatus, 'paymentStatus:', enrollment.paymentStatus);
      console.log('assessmentId instance of Buffer', Buffer.isBuffer(enrollment.assessmentId));
      console.log('assessmentId instance of ObjectId', enrollment.assessmentId && enrollment.assessmentId._bsontype ? enrollment.assessmentId._bsontype : null);
      if (enrollment.assessmentId) {
        const assessment = await Assessment.findById(enrollment.assessmentId).lean();
        console.log('fetched assessment', assessment ? { id: assessment._id?.toString(), name: assessment.name, subject: assessment.subject, type: assessment.type, price: assessment.price } : 'NOT_FOUND');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();