const axios = require('axios');
(async () => {
  try {
    const base = 'http://localhost:5000/api';
    const ts = Date.now();
    const email = `testpay${ts}@example.com`;
    console.log('registering', email);
    const reg = await axios.post(base + '/auth/register', { name: 'Test Pay', email, password: 'Password123!' });
    console.log('register ok', reg.data.message);
    const login = await axios.post(base + '/auth/login', { email, password: 'Password123!' });
    console.log('login ok', login.data.message);
    const token = login.data.token;
    const courses = await axios.get(base + '/courses', { headers: { Authorization: `Bearer ${token}` } });
    console.log('courses count', courses.data?.courses?.length || courses.data?.length || 'unknown');
    const courseId = courses.data?.courses?.[0]?._id || courses.data?.courses?.[0]?.id || courses.data?.[0]?._id || courses.data?.[0]?.id;
    console.log('courseId', courseId);
    const init = await axios.post(base + '/payments/initiate', {
      productType: 'course', productId: courseId, amount: 10, currency: 'USD', email, firstName: 'Test', lastName: 'Pay', paymentSource: 'Wave', paymentMethod: 'Wave'
    }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('initiate', init.data?.data);
    const verify = await axios.post(base + '/payments/verify', {
      paymentId: init.data.data.paymentId,
      transactionId: init.data.data.paymentId,
      gatewayReference: init.data.data.paymentId,
      paymentMethod: 'Wave',
      paymentSource: 'Wave',
      status: 'completed'
    }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('verify', verify.data?.message, verify.data?.data?.paymentId);
    const myCourses = await axios.get(base + '/enrollments/my-courses', { headers: { Authorization: `Bearer ${token}` } });
    console.log('my-courses length', Array.isArray(myCourses.data) ? myCourses.data.length : JSON.stringify(myCourses.data));
  } catch (err) {
    console.error('ERR', err.response?.data || err.message);
    process.exit(1);
  }
})();
