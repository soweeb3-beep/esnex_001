const axios = require('axios');

(async () => {
  try {
    const base = process.env.API_BASE || 'http://localhost:5000';
    console.log('Using API base:', base);

    const login = await axios.post(`${base}/api/auth/login`, { email: 'alpha@gmail.com', password: 'Alpha123' });
    const token = login.data.token;
    if (!token) return console.error('Login failed', login.data);
    console.log('Logged in, token preview:', token.slice(0,20) + '...');

    const assessmentsRes = await axios.get(`${base}/api/assessments/global`, { headers: { Authorization: `Bearer ${token}` } });
    const assessments = Array.isArray(assessmentsRes.data?.assessments) ? assessmentsRes.data.assessments : (Array.isArray(assessmentsRes.data?.data) ? assessmentsRes.data.data : []);
    const physics = assessments.find(a => String(a.subject||'').toLowerCase().includes('physics')) || assessments[0];
    if (!physics) return console.error('No assessments found');
    console.log('Selected assessment id:', physics._id || physics.id);

    // attempt to start
    const startRes = await axios.post(`${base}/api/assessments/global/start/${physics._id}`, {}, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true });
    console.log('Start status:', startRes.status);
    console.log('Start response:', JSON.stringify(startRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERR STATUS', err.response.status);
      console.error('ERR DATA', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERR', err && err.message);
    }
    process.exit(1);
  }
})();
