(async () => {
  try {
    const { getModel } = require('../config/adapter');
    const controller = require('../controllers/assessmentController');

    const Assessment = getModel('Assessment');
    const User = getModel('User');
    const Attempt = getModel('AssessmentAttempt');

    // Create user and assessment with low maxWarnings
    const user = await User.create({ _id: 'u_test_threshold', name: 'Threshold User', email: 'threshold@example.com' });
    const assessment = await Assessment.create({ _id: 'a_test_threshold', name: 'Threshold Assessment', antiCheat: { maxWarnings: 2, exitAction: 'auto-submit' } });

    // Create an attempt
    const attempt = await Attempt.create({ _id: 'att_test_threshold', assessmentId: assessment._id, studentId: user._id, status: 'in-progress', questions: [] });

    const req = { params: { attemptId: attempt._id }, user: { id: user._id, _id: user._id } };
    const res = { status(code) { this._status = code; return this; }, json(obj) { this._data = obj; return obj; } };

    // Trigger tab switch twice -> should auto-submit on second
    await controller.recordTabSwitch(req, res);
    const after1 = await Attempt.findById(attempt._id);
    console.log('After 1 warnings:', after1.warnings, 'status:', after1.status);
    if (after1.status === 'submitted') {
      console.error('FAILED: should not auto-submit after 1 warning');
      process.exit(3);
    }

    await controller.recordTabSwitch(req, res);
    const after2 = await Attempt.findById(attempt._id);
    console.log('After 2 warnings:', after2.warnings, 'status:', after2.status);
    if (after2.status !== 'submitted') {
      console.error('FAILED: should have auto-submitted after reaching threshold');
      process.exit(4);
    }

    console.log('PASS: threshold auto-submit behavior works');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
