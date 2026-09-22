const axios = require('axios');
const base = 'http://127.0.0.1:5000/api';

(async () => {
  try {
    const loginRes = await axios.post(`${base}/auth/login`, {
      email: 'alpha@gmail.com',
      password: 'Alpha123',
    });
    console.log('LOGIN', loginRes.status, loginRes.data?.message || loginRes.data?.success);
    const token = loginRes.data.token;

    const enrolledRes = await axios.get(`${base}/assessments/enrolled`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('ENROLLED', enrolledRes.status, JSON.stringify(enrolledRes.data, null, 2));
  } catch (err) {
    console.error('ERROR_STATUS', err.response?.status);
    console.error('ERROR_DATA', JSON.stringify(err.response?.data, null, 2));
    console.error('ERROR_MESSAGE', err.message);
    if (err.response?.headers) {
      console.error('ERROR_HEADERS', JSON.stringify(err.response.headers, null, 2));
    }
  }
})();
