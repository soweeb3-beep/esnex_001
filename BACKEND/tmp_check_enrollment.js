const { getModel } = require('./config/adapter');
const connectDB = require('./config/db');
(async () => {
  try {
    await connectDB();
    const User = getModel('User');
    const Assessment = getModel('Assessment');
    const AssessmentEnrollment = getModel('AssessmentEnrollment');
    const user = await User.findOne({ email: 'alpha@gmail.com' }).lean();
    console.log('user', user ? { id: user._id.toString(), email: user.email, role: user.role } : null);
    const assessment = await Assessment.findOne({ subject: { $regex: /^physics$/i }, type: 'global', status: 'published' }).lean();
    console.log('assessment', assessment ? { id: assessment._id.toString(), subject: assessment.subject, price: assessment.price, status: assessment.status } : null);
    if (user && assessment) {
      const enrollment = await AssessmentEnrollment.findOne({ assessmentId: assessment._id, studentId: user._id }).lean();
      console.log('enrollment', enrollment ? { id: enrollment._id.toString(), accessGranted: enrollment.accessGranted, subscriptionStatus: enrollment.subscriptionStatus, paymentStatus: enrollment.paymentStatus, expiryDate: enrollment.expiryDate, paymentAmount: enrollment.paymentAmount } : null);
    }
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
})();