const axios = require('axios');
(async () => {
  try {
    const base = 'http://localhost:5000';
    const login = await axios.post(`${base}/api/auth/login`, { email: 'alpha@gmail.com', password: 'Alpha123' });
    const token = login.data.token;
    console.log('TOKEN:', token ? token.slice(0,20) + '...' : 'NO');

    const assessmentsRes = await axios.get(`${base}/api/assessments/global`, { headers: { Authorization: `Bearer ${token}` } });
    const assessments = Array.isArray(assessmentsRes.data?.assessments) ? assessmentsRes.data.assessments : (Array.isArray(assessmentsRes.data?.data) ? assessmentsRes.data.data : []);
    const physics = assessments.find(a => String(a.subject||'').toLowerCase().includes('physics')) || assessments[0];
    console.log('Selected assessment id:', physics?._id || physics?.id);

    const initRes = await axios.post(`${base}/api/payments/initiate`, {
      productType: 'assessment',
      productId: physics._id,
      amount: physics.price || 10,
      currency: 'USD',
      email: 'alpha@gmail.com',
      paymentMethod: 'Wave',
      paymentSource: 'Wave'
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('Initiate response status:', initRes.status);
    console.log('Initiate response headers:', initRes.headers['content-type']);
    console.log('Initiate full response data:', JSON.stringify(initRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERR STATUS', err.response.status);
      console.error('ERR DATA', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERR', err.message);
    }
    process.exit(1);
  }
})();
