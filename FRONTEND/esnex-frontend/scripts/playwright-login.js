const axios = require('axios');
(async () => {
  const base = 'http://localhost:5000';
  try {
    console.log('Logging in as alpha@gmail.com');
    const loginRes = await axios.post(`${base}/api/auth/login`, { email: 'alpha@gmail.com', password: 'Alpha123' });
    const token = loginRes.data.token;
    console.log('Login OK, token length:', token ? token.length : 'NO');

    const assessmentsRes = await axios.get(`${base}/api/assessments/global`, { headers: { Authorization: `Bearer ${token}` } });
    const assessments = Array.isArray(assessmentsRes.data?.assessments)
      ? assessmentsRes.data.assessments
      : Array.isArray(assessmentsRes.data?.data)
      ? assessmentsRes.data.data
      : [];
    console.log('Found assessments:', assessments.length);
    const physics = assessments.find(a => String(a.subject||'').toLowerCase().includes('physics')) || assessments[0];
    if (!physics || !physics._id) {
      console.error('No assessment found');
      process.exit(1);
    }
    console.log('Selected assessment:', physics._id, physics.name || physics.title || physics.subject || 'Unnamed');

    const initRes = await axios.post(`${base}/api/payments/initiate`, {
      productType: 'assessment',
      productId: physics._id,
      amount: physics.price || 100,
      currency: 'GMD',
      email: 'alpha@gmail.com',
      paymentMethod: 'Wave',
      paymentSource: 'Wave',
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('Initiate payment status:', initRes.status, initRes.data?.message || initRes.data?.data?.message || '');
    const paymentId = initRes.data?.data?.paymentId || initRes.data?.payment?.paymentId || initRes.data?.paymentId;
    console.log('PaymentId:', paymentId);

    const verifyRes = await axios.post(`${base}/api/payments/verify`, { paymentId, transactionId: `test-${Date.now()}` }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Verify status:', verifyRes.status, verifyRes.data?.message || '');

    const enrolledRes = await axios.get(`${base}/api/assessments/enrolled`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Enrolled count:', (enrolledRes.data?.assessments || []).length);

    console.log('Attempting to start assessment via API');
    const startRes = await axios.post(`${base}/api/assessments/${physics._id}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Start status:', startRes.status, startRes.data);
  } catch (err) {
    if (err.response) {
      console.error('ERROR STATUS', err.response.status);
      console.error('ERROR DATA', err.response.data);
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
