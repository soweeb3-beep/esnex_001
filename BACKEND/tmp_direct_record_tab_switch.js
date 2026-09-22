const mongoose = require('mongoose');
const { getModel } = require('./config/adapter');
const controller = require('./controllers/assessmentController');

(async () => {
  try {
    const Attempt = getModel('AssessmentAttempt');
    const attempt = await Attempt.create({
      assessmentType: 'standard',
      assessmentTypeRef: 'StandardAssessment',
      studentId: new mongoose.Types.ObjectId(),
      assessmentId: new mongoose.Types.ObjectId(),
      status: 'in-progress',
      questions: [],
      totalMarks: 100,
      duration: 60,
      tabSwitches: 0,
      warnings: 0,
    });
    console.log('ATTEMPT_ID', attempt._id.toString());
    const req = { params: { attemptId: attempt._id.toString() }, user: { id: 'admin', _id: 'admin', role: 'admin' } };
    let resBody = null;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(obj) { resBody = obj; return obj; },
    };

    await controller.recordTabSwitch(req, res);
    console.log('RESPONSE_STATUS', res.statusCode);
    console.log('RESPONSE_BODY', JSON.stringify(resBody));
  } catch (err) {
    console.error('DIRECT_CALL_ERROR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
