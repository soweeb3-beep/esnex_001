const axios = require('axios');
(async () => {
  try {
    const base = 'http://localhost:5000';
    const loginRes = await axios.post(`${base}/api/auth/login`, { email: 'alpha@gmail.com', password: 'Alpha123' });
    const token = loginRes.data.token;
    console.log('Logged in, token length:', token ? token.length : 'NO');
    const paymentsRes = await axios.get(`${base}/api/payments/history`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Payments count:', (paymentsRes.data?.data || []).length);
    console.log(JSON.stringify(paymentsRes.data, null, 2));
  } catch (err) {
    console.error('ERROR', err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }
})();
