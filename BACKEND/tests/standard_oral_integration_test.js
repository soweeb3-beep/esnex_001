(async () => {
  try {
    const { getModel } = require('../config/adapter');
    const standardController = require('../controllers/standardAssessmentController');

    const StandardAssessment = getModel('StandardAssessment');
    const User = getModel('User');
    const AssessmentAttempt = getModel('AssessmentAttempt');

    // Clean up any existing test data
    // Create a test user
    const user = await User.create({ _id: 'stu_test_1', name: 'Test Student', email: 'teststudent@example.com' });

    // Create a StandardAssessment
    const assessment = await StandardAssessment.create({ _id: 'sa_test_1', name: 'Physics Standard', subject: 'physics' });

    // Prepare req/res
    const req = {
      params: { assessmentId: assessment._id },
      body: { oralType: 'wassce' },
      user: { id: user._id, _id: user._id },
      ip: '127.0.0.1',
    };

    let resPayload = null;
    const res = {
      status(code) { this._status = code; return this; },
      json(obj) { resPayload = obj; console.log('Controller response:', JSON.stringify(obj, null, 2)); return obj; }
    };

    // Invoke the oral start through the standard controller
    await standardController.startOralAssessment(req, res);

    // Query attempts for this assessment and student
    const attemptsQuery = AssessmentAttempt.find({ assessmentId: assessment._id, studentId: user._id });
    const attempts = Array.isArray(attemptsQuery._result) ? attemptsQuery._result : await attemptsQuery.exec();

    console.log('Attempts found count:', Array.isArray(attempts) ? attempts.length : (attempts && attempts._id ? 1 : 0));
    if (!attempts || (Array.isArray(attempts) && attempts.length === 0)) {
      console.error('No attempt created');
      process.exit(3);
    }

    const attempt = Array.isArray(attempts) ? attempts[0] : attempts;
    console.log('Attempt record:', JSON.stringify(attempt, null, 2));

    // Assertions
    const okTypeRef = attempt.assessmentTypeRef === 'StandardAssessment';
    const okAssessmentId = String(attempt.assessmentId) === String(assessment._id);

    console.log('assessmentTypeRef is StandardAssessment:', okTypeRef);
    console.log('attempt.assessmentId matches StandardAssessment id:', okAssessmentId);

    if (!okTypeRef || !okAssessmentId) {
      console.error('FAILED: Oral attempt did not link to StandardAssessment as required');
      process.exit(4);
    }

    console.log('PASS: Oral attempt created and linked to StandardAssessment');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
