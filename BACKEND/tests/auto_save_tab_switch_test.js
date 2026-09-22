(async () => {
  try {
    const { getModel } = require('../config/adapter');
    const controller = require('../controllers/assessmentController');

    const Assessment = getModel('Assessment');
    const User = getModel('User');
    const Attempt = getModel('AssessmentAttempt');

    // Create user and assessment
    const user = await User.create({ _id: 'u_test_autosave', name: 'Autosave User', email: 'autosave@example.com' });
    const assessment = await Assessment.create({ _id: 'a_test_autosave', name: 'AutoSave Assessment', antiCheat: { maxWarnings: 3, exitAction: 'warning' } });

    // Create an attempt
    const attempt = await Attempt.create({ _id: 'att_test_autosave', assessmentId: assessment._id, studentId: user._id, status: 'in-progress', questions: [{ questionId: 'q1', text: 'Q1' }] });

    const req = { params: { attemptId: attempt._id }, body: { answer: { studentAnswer: 'Test answer' }, questionId: 'q1', questionIndex: 0 }, user: { id: user._id, _id: user._id } };
    let resData;
    const res = { status(code) { this._status = code; return this; }, json(obj) { resData = obj; return obj; } };

    // Call autoSaveAnswer
    await controller.autoSaveAnswer(req, res);

    const savedAttempt = await Attempt.findById(attempt._id);
    if (!savedAttempt || !savedAttempt.answers || savedAttempt.answers.length === 0) {
      console.error('FAILED: autoSaveAnswer did not save answer');
      process.exit(3);
    }

    console.log('autoSaveAnswer saved answers count:', savedAttempt.answers.length);

    // Call recordTabSwitch
    const req2 = { params: { attemptId: attempt._id }, user: { id: user._id, _id: user._id } };
    let res2Data;
    const res2 = { status(code) { this._status = code; return this; }, json(obj) { res2Data = obj; return obj; } };

    await controller.recordTabSwitch(req2, res2);

    const afterAttempt = await Attempt.findById(attempt._id);
    console.log('Tab switches:', afterAttempt.tabSwitches, 'Warnings:', afterAttempt.warnings);

    if (!afterAttempt.warnings || afterAttempt.warnings < 1) {
      console.error('FAILED: recordTabSwitch did not increment warnings');
      process.exit(4);
    }

    console.log('recordTabSwitch response:', res2Data);
    console.log('PASS: autoSaveAnswer and recordTabSwitch behaved as expected');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
