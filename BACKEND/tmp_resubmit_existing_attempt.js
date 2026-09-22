const axios = require('axios');

(async () => {
  try {
    const attemptId = '6a77e15ef7255c0a94906066';
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
    const token = login.data.token;
    console.log('token length', token && token.length);

    const resp = await axios.post(`http://localhost:5000/api/assessments/${attemptId}/submit`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('submit status', resp.status);
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERR_STATUS', err.response.status);
      console.error('ERR_DATA', JSON.stringify(err.response.data, null, 2));
    } else console.error('ERR', err.message);
  }
})();
