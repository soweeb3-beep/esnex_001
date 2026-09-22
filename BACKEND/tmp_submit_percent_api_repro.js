const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    // login
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
    const token = login.data.token;
    console.log('Logged in, token length:', token && token.length);

    // create assessment via API
    const createResp = await axios.post('http://localhost:5000/api/assessments', {
      name: 'Percent Repro API Test',
      type: 'global',
      subject: 'Physics',
      duration: 60,
      totalMarks: 10,
      passingScore: 5,
      totalQuestions: 10,
      parts: [{ partName: 'A', partType: 'Objective', duration: 60, totalQuestions: 10, totalMarks: 10 }],
    }, { headers: { Authorization: `Bearer ${token}` } });

    const assessment = createResp.data.assessment || createResp.data;
    const assessmentId = assessment._id || assessment.id || assessment;
    console.log('Created assessment via API:', assessmentId);

    // start assessment via API
    const startResp = await axios.post(`${base}/${assessmentId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startResp.data.attempt || startResp.data;
    const attemptId = attempt._id || attempt.id || attempt.attemptId;
    console.log('Started attempt via API:', attemptId);

    const payloadAnswers = Array.from({ length: 10 }).map((_, idx) => ({ questionIndex: idx, questionId: `q${idx+1}`, studentAnswer: 'Wrong' }));

    const submitResp = await axios.post(`${base}/${attemptId}/submit`, { answers: payloadAnswers }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Submit status', submitResp.status);
    console.log(JSON.stringify(submitResp.data, null, 2));
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
