const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api/assessments';
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@esnex.com',
      password: 'Admin1234',
    });
    const token = login.data.token;
    console.log('Logged in, token length:', token && token.length);

    // fetch available global assessments
    const list = await axios.get(`${base}/global`, { headers: { Authorization: `Bearer ${token}` } });
    const assessments = list.data && list.data.assessments ? list.data.assessments : [];
    if (!assessments.length) throw new Error('No assessments found');
    const assessment = assessments[0];
    console.log('Using assessment id:', assessment._id || assessment.id || assessment.id);

    // start assessment
    const startResp = await axios.post(`${base}/${assessment._id || assessment.id}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Start response status', startResp.status);
    const attempt = startResp.data.attempt || startResp.data || {};
    const attemptId = attempt._id || attempt.id || startResp.data.attemptId || attempt.id;
    console.log('Started attempt id:', attemptId);

    // Post tab-switch events up to threshold
    for (let i = 0; i < 4; i++) {
      try {
        const resp = await axios.post(`${base}/${attemptId}/tab-switch`, { event: 'tab-switch' }, { headers: { Authorization: `Bearer ${token}` } });
        console.log('Tab-switch resp', i + 1, resp.status, JSON.stringify(resp.data));
      } catch (err) {
        if (err.response) {
          console.error('Tab-switch error', err.response.status, err.response.data);
        } else {
          console.error('Tab-switch error', err.message);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('ERROR', err.response ? err.response.data : err.message);
    process.exit(1);
  }
})();
