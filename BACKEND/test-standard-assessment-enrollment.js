const mongoose = require('mongoose');
const StandardAssessmentEnrollment = require('./models/StandardAssessmentEnrollment');

(async () => {
  try {
    const doc = new StandardAssessmentEnrollment({
      assessmentId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      paymentStatus: 'paid',
      amountPaid: 10,
      currency: 'USD',
      attempts: { total: 1, used: 0, remaining: 1 },
    });

    await doc.save();
    console.log('SAVE_OK');
    process.exit(0);
  } catch (error) {
    console.error('SAVE_FAIL', error.message);
    process.exit(1);
  }
})();
