const axios = require('axios');
const mongoose = require('mongoose');
const { getModel } = require('./config/adapter');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    // login
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@esnex.com',
      password: 'Admin1234',
    });
    const token = login.data.token;
    console.log('Logged in, token length:', token && token.length);

    // create an assessment
    const Assessment = getModel('Assessment');
    const assessment = await Assessment.create({
      name: 'Percent Repro Test',
      type: 'global',
      subject: 'Physics',
      duration: 60,
      totalMarks: 10,
      totalQuestions: 10,
      parts: [{ partName: 'A', partType: 'Objective', duration: 60, totalQuestions: 10, totalMarks: 10 }],
    });
    console.log('Created assessment', assessment._id.toString());

    // create attempt directly
    const Attempt = getModel('AssessmentAttempt');
    const questions = Array.from({ length: 10 }).map((_, i) => ({
      questionId: `q${i+1}`,
      text: `Question ${i+1}`,
      correctAnswer: 'Correct',
      totalMarks: 1,
    }));

    const attempt = await Attempt.create({
      assessmentType: 'standard',
      assessmentTypeRef: 'StandardAssessment',
      studentId: new mongoose.Types.ObjectId(),
      assessmentId: assessment._id,
      status: 'in-progress',
      questions,
      totalMarks: 10,
      duration: 60,
      tabSwitches: 0,
      warnings: 0,
      startedAt: new Date(),
    });

    console.log('Created attempt', attempt._id.toString());

    // prepare wrong answers
    const payloadAnswers = questions.map((q, idx) => ({ questionIndex: idx, questionId: q.questionId, studentAnswer: 'Wrong' }));

    // post submit
    const resp = await axios.post(`${base}/${attempt._id}/submit`, { answers: payloadAnswers }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Submit status', resp.status);
    console.log('Submit body', JSON.stringify(resp.data, null, 2));
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('ERR_STATUS', err.response.status);
      console.error('ERR_DATA', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERR', err.message);
    }
    process.exit(1);
  }
})();
