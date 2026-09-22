(async () => {
  try {
    const { getModel } = require('../config/adapter');
    const standardController = require('../controllers/standardAssessmentController');

    const StandardAssessment = getModel('StandardAssessment');
    const User = getModel('User');
    const Question = getModel('Question');

    // Create a test user and assessment
    const user = await User.create({ _id: 'admin_test_1', name: 'Admin', email: 'admin@example.com', role: 'admin' });
    const assessment = await StandardAssessment.create({ _id: 'sa_q_test_1', name: 'Physics Standard', subject: 'physics' });

    // 1) Create question via controller
    const createReq = {
      body: {
        assessmentId: assessment._id,
        partName: 'Objective',
        sectionName: 'A',
        questionData: { text: 'What is force?', totalMarks: 5 }
      },
      user: { id: user._id, _id: user._id }
    };

    let createResPayload = null;
    const createRes = { status(code) { this._status = code; return this; }, json(obj) { createResPayload = obj; console.log('createQuestion response:', JSON.stringify(obj, null, 2)); return obj; } };

    await standardController.createQuestion(createReq, createRes);

    if (!createResPayload || !createResPayload.question) {
      console.error('Question creation failed'); process.exit(3);
    }

    const qId = createResPayload.question._id || createResPayload.question.id || createResPayload.question.questionId;

    // 2) Verify question is linked to StandardAssessment
    const found = await Question.find({ assessmentId: assessment._id }).exec ? (await Question.find({ assessmentId: assessment._id }).exec()) : Question.find({ assessmentId: assessment._id })._result;

    if (!found || (Array.isArray(found) && found.length === 0)) {
      console.error('No question found linked to StandardAssessment'); process.exit(4);
    }

    console.log('Found questions count:', Array.isArray(found) ? found.length : 1);

    // Pick the created question
    const created = Array.isArray(found) ? found[0] : found;
    console.log('Created question record:', JSON.stringify(created, null, 2));

    // 3) Update question via controller
    const updateReq = { params: { id: created._id || created.id || qId }, body: { text: 'What is force in physics?' }, user: { id: user._id, _id: user._id } };
    let updateResPayload = null;
    const updateRes = { status(code) { this._status = code; return this; }, json(obj) { updateResPayload = obj; console.log('updateQuestion response:', JSON.stringify(obj, null, 2)); return obj; } };

    await standardController.updateQuestion(updateReq, updateRes);
    if (!updateResPayload || !updateResPayload.question) { console.error('Update failed'); process.exit(5); }
    if (updateResPayload.question.text !== 'What is force in physics?') { console.error('Update did not persist'); process.exit(6); }

    // 4) Delete question via controller
    const deleteReq = { params: { id: created._id || created.id || qId }, user: { id: user._id, _id: user._id } };
    let deleteResPayload = null;
    const deleteRes = { status(code) { this._status = code; return this; }, json(obj) { deleteResPayload = obj; console.log('deleteQuestion response:', JSON.stringify(obj, null, 2)); return obj; } };

    await standardController.deleteQuestion(deleteReq, deleteRes);

    // Verify deletion of the specific question
    const deletedCheck = await Question.findById(created._id).exec ? (await Question.findById(created._id).exec()) : Question.findById(created._id)._result;
    if (deletedCheck) { console.error('Question was not deleted'); process.exit(7); }

    console.log('PASS: CRUD operations via standardAssessmentController linked to StandardAssessment model');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
