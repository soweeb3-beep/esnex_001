const axios = require('axios');
const base = 'http://localhost:5000';

(async () => {
  try {
    const loginRes = await axios.post(`${base}/api/auth/login`, {
      email: 'alpha@gmail.com',
      password: 'Alpha123',
    });
    const token = loginRes.data.token;
    console.log('LOGIN_OK', loginRes.status);

    const assessmentsRes = await axios.get(`${base}/api/assessments/global`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const assessments = Array.isArray(assessmentsRes.data?.assessments)
      ? assessmentsRes.data.assessments
      : Array.isArray(assessmentsRes.data?.data)
        ? assessmentsRes.data.data
        : [];

    console.log('ASSESSMENTS_COUNT', assessments.length);
    const assessment = assessments.find((a) => a && a._id);
    console.log('FIRST_ASSESSMENT_ID', assessment?._id || 'NONE');

    if (!assessment?._id) {
      process.exit(0);
    }

    const initRes = await axios.post(
      `${base}/api/payments/initiate`,
      {
        productType: 'assessment',
        productId: assessment._id,
        amount: 100,
        currency: 'USD',
        email: 'alpha@gmail.com',
        paymentMethod: 'Wave',
        paymentSource: 'Wave',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('INITIATE_STATUS', initRes.status, initRes.data?.message || initRes.data?.payment?.status);

    const paymentId = initRes.data?.payment?.paymentId || initRes.data?.paymentId || initRes.data?.data?.paymentId;
    const verifyRes = await axios.post(
      `${base}/api/payments/verify`,
      { paymentId, transactionId: 'test-transaction-123' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('VERIFY_STATUS', verifyRes.status, verifyRes.data?.message || verifyRes.data?.payment?.status);

    const enrolledRes = await axios.get(`${base}/api/assessments/enrolled`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('ENROLLED_STATUS', enrolledRes.status);
    console.log('ENROLLED_IDS', (enrolledRes.data?.assessments || []).map((a) => a._id || a.id));
  } catch (err) {
    console.error('ERROR', err.response?.status, err.response?.data);
    process.exit(1);
  }
})();
