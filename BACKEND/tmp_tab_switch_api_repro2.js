const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
    const token = login.data.token;
    console.log('Logged in, token length:', token && token.length);

    // create assessment with antiCheat.maxWarnings = 2
    const createResp = await axios.post('http://localhost:5000/api/assessments', {
      name: 'TabSwitch AutoSubmit Test',
      type: 'global',
      subject: 'Physics',
      duration: 10,
      totalMarks: 10,
      passingScore: 1,
      totalQuestions: 10,
      antiCheat: { enabled: true, maxWarnings: 2, exitAction: 'auto-submit', tabSwitchDetection: true },
      parts: [{ partName: 'A', partType: 'Objective', duration: 10, totalQuestions: 10, totalMarks: 10 }],
    }, { headers: { Authorization: `Bearer ${token}` } });

    const assessment = createResp.data.assessment || createResp.data;
    const assessmentId = assessment._id || assessment.id || assessment;
    console.log('Created assessment via API:', assessmentId);

    // start assessment via API
    const startResp = await axios.post(`${base}/${assessmentId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startResp.data.attempt || startResp.data;
    const attemptId = attempt._id || attempt.id || attempt.attemptId;
    console.log('Started attempt via API:', attemptId);

    // send tab-switch events up to 3 times
    for (let i = 1; i <= 3; i++) {
      try {
        const resp = await axios.post(`${base}/${attemptId}/tab-switch`, { event: 'tab-switch' }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`Tab-switch #${i} response status:`, resp.status);
        console.log(JSON.stringify(resp.data, null, 2));
        if (resp.data && (resp.data.action === 'auto-submit' || resp.data.status === 'submitted' || resp.data.attempt)) {
          console.log('Auto-submit triggered, stopping further events.');
          break;
        }
      } catch (err) {
        if (err.response) {
          console.error('Tab-switch error status', err.response.status);
          console.error('Tab-switch error body', JSON.stringify(err.response.data, null, 2));
          if (err.response.status >= 400 && err.response.data && err.response.data.message && err.response.data.message.toLowerCase().includes('submitted')) break;
        } else {
          console.error('Tab-switch network error', err.message);
        }
      }
    }

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
