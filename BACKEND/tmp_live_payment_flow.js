const axios = require('axios');

(async () => {
  const base = 'http://localhost:5000';

  try {
    const loginRes = await axios.post(`${base}/api/auth/login`, {
      email: 'alpha@gmail.com',
      password: 'Alpha123',
    });

    const token = loginRes.data.token;
    console.log('LOGIN_OK', !!token);

    const initiateRes = await axios.post(
      `${base}/api/payments/initiate`,
      {
        productType: 'course',
        productId: '76oos1loq',
        amount: 1515,
        currency: 'GMD',
        email: 'alpha@gmail.com',
        firstName: 'Alpha',
        lastName: 'Test',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('INIT_OK', JSON.stringify(initiateRes.data, null, 2));

    const paymentId = initiateRes.data?.paymentId || initiateRes.data?.data?.paymentId;
    if (!paymentId) {
      throw new Error('No paymentId returned from init');
    }

    const verifyRes = await axios.post(
      `${base}/api/payments/verify`,
      {
        paymentId,
        status: 'completed',
        paymentSource: 'Modem Pay',
        paymentMethod: 'Modem Pay',
        transactionId: paymentId,
        gatewayReference: paymentId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('VERIFY_OK', JSON.stringify(verifyRes.data, null, 2));

    const myCoursesRes = await axios.get(`${base}/api/enrollments/my-courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('MY_COURSES_OK', JSON.stringify(myCoursesRes.data, null, 2));
  } catch (err) {
    console.error('FLOW_ERROR', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    process.exitCode = 1;
  }
})();
