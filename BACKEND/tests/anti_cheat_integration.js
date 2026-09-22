const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
    const token = login.data.token;

    const createResp = await axios.post('http://localhost:5000/api/assessments', {
      name: 'Integration AntiCheat Test',
      type: 'global',
      subject: 'Test',
      duration: 5,
      totalMarks: 10,
      passingScore: 1,
      totalQuestions: 10,
      antiCheat: { enabled: true, maxWarnings: 2, exitAction: 'auto-submit', tabSwitchDetection: true },
      parts: [{ partName: 'A', partType: 'Objective', duration: 5, totalQuestions: 10, totalMarks: 10 }],
    }, { headers: { Authorization: `Bearer ${token}` } });

    const assessment = createResp.data.assessment || createResp.data;
    const assessmentId = assessment._id || assessment.id || assessment;

    const startResp = await axios.post(`${base}/${assessmentId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startResp.data.attempt || startResp.data;
    const attemptId = attempt._id || attempt.id || attempt.attemptId;

    // send two tab-switch events
    await axios.post(`${base}/${attemptId}/tab-switch`, { event: 'tab-switch' }, { headers: { Authorization: `Bearer ${token}` } });
    const second = await axios.post(`${base}/${attemptId}/tab-switch`, { event: 'tab-switch' }, { headers: { Authorization: `Bearer ${token}` } });

    // fetch attempt
    const getResp = await axios.get(`${base}/attempt/${attemptId}`, { headers: { Authorization: `Bearer ${token}` } });
    const finalAttempt = getResp.data.attempt || getResp.data;

    if (finalAttempt.status === 'submitted' && finalAttempt.submittedAt) {
      console.log('ANTI-CHEAT TEST: PASS');
      process.exit(0);
    }
    console.error('ANTI-CHEAT TEST: FAIL - attempt not auto-submitted', finalAttempt.status);
    process.exit(2);
  } catch (err) {
    console.error('ANTI-CHEAT TEST ERROR', err.response ? err.response.data : err.message);
    process.exit(3);
  }
})();
