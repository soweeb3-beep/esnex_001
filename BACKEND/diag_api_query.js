const axios = require("axios");
(async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { email: 'alpha@gmail.com', password: 'Alpha123' });
    console.log('LOGIN', loginRes.status, loginRes.data?.token ? 'TOKEN_OK' : 'NO_TOKEN');
    const token = loginRes.data.token;
    const enrolledRes = await axios.get('http://localhost:5000/api/assessments/enrolled', { headers: { Authorization: `Bearer ${token}` } });
    console.log('/api/assessments/enrolled', JSON.stringify(enrolledRes.data, null, 2));
    const assessmentRes = await axios.get('http://localhost:5000/api/assessments/6a0b63cefb919523d032d6ca', { headers: { Authorization: `Bearer ${token}` } });
    console.log('/api/assessments/6a0b63cefb919523d032d6ca', JSON.stringify(assessmentRes.data, null, 2));
    const subjectRes = await axios.get('http://localhost:5000/api/assessments/global/subject/english', { headers: { Authorization: `Bearer ${token}` } });
    console.log('/api/assessments/global/subject/english', JSON.stringify(subjectRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('HTTP', err.response.status, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERROR', err.message);
    }
  }
})();
