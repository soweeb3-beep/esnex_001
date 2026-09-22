const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
    const token = login.data.token;

    const createResp = await axios.post('http://localhost:5000/api/assessments', {
      name: 'Integration Percentage Test',
      type: 'global',
      subject: 'Test',
      duration: 5,
      totalMarks: 10,
      passingScore: 1,
      totalQuestions: 10,
      parts: [{ partName: 'A', partType: 'Objective', duration: 5, totalQuestions: 10, totalMarks: 10 }],
    }, { headers: { Authorization: `Bearer ${token}` } });

    const assessment = createResp.data.assessment || createResp.data;
    const assessmentId = assessment._id || assessment.id || assessment;

    const startResp = await axios.post(`${base}/${assessmentId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startResp.data.attempt || startResp.data;
    const attemptId = attempt._id || attempt.id || attempt.attemptId;

    const payloadAnswers = Array.from({ length: 10 }).map((_, idx) => ({ questionIndex: idx, questionId: `q${idx+1}`, studentAnswer: 'Wrong' }));

    const submitResp = await axios.post(`${base}/${attemptId}/submit`, { answers: payloadAnswers }, { headers: { Authorization: `Bearer ${token}` } });
    const body = submitResp.data;

    if (Number(body.percentage) === 0 && Number(body.score) === 0) {
      console.log('PERCENTAGE TEST: PASS');
      process.exit(0);
    }
    console.error('PERCENTAGE TEST: FAIL', JSON.stringify(body, null, 2));
    process.exit(2);
  } catch (err) {
    console.error('PERCENTAGE TEST ERROR', err.response ? err.response.data : err.message);
    process.exit(3);
  }
})();
