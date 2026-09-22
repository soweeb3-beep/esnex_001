const axios = require('axios');

(async () => {
  try {
    const base = 'http://localhost:5000/api';
    const email = 'alpha@gmail.com';
    const password = 'Alpha123';

    console.log('Logging in...');
    const loginRes = await axios.post(base + '/auth/login', { email, password });
    const token = loginRes.data.token;
    console.log('LOGIN_OK', { token: !!token });

    console.log('Fetching public global assessments...');
    const all = await axios.get(base + '/assessments/global');
    let list = all.data;
    if (list && list.assessments) list = list.assessments;
    if (!Array.isArray(list)) {
      console.log('Unexpected /assessments/global response:', JSON.stringify(all.data, null, 2));
      return;
    }

    const physics = list.find(a => String(a.subject).toLowerCase() === 'physics' && Number(a.price) > 0) || list.find(a => String(a.subject).toLowerCase() === 'physics');
    if (!physics) {
      console.log('No Physics assessment found. Listing available subjects:');
      console.log(JSON.stringify(list.map(a=>({id:a._id,name:a.name,subject:a.subject,price:a.price})),null,2));
      return;
    }

    console.log('Selected Physics assessment:', { id: physics._id, name: physics.name, price: physics.price });

    // Initiate payment
    console.log('Initiating payment...');
    const initRes = await axios.post(base + '/payments/initiate', {
      productType: 'assessment',
      productId: physics._id,
      amount: physics.price || 0,
      currency: 'GMD',
      email,
      firstName: 'Alpha',
      lastName: 'Test',
      paymentSource: 'Wave',
      paymentMethod: 'Wave'
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('INITIATE_STATUS', initRes.status, JSON.stringify(initRes.data, null, 2));
    const paymentId = initRes.data?.data?.paymentId || initRes.data?.paymentId || initRes.data?.data?.paymentId || initRes.data?.paymentId;
    if (!paymentId) {
      console.log('No paymentId returned, aborting.');
      return;
    }

    // Verify payment (dev mode auto-approves)
    console.log('Verifying payment (dev/test auto-approve)...');
    const verifyRes = await axios.post(base + '/payments/verify', { paymentId }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('VERIFY_STATUS', verifyRes.status, JSON.stringify(verifyRes.data, null, 2));

    // Check enrolled assessments
    console.log('Getting enrolled assessments...');
    const enrolled = await axios.get(base + '/assessments/enrolled', { headers: { Authorization: `Bearer ${token}` } });
    console.log('ENROLLED', JSON.stringify(enrolled.data, null, 2));

    // Start assessment
    console.log('Starting assessment...');
    const startRes = await axios.post(`${base}/assessments/${physics._id}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('START_STATUS', startRes.status, JSON.stringify(startRes.data, null, 2));

  } catch (err) {
    if (err.response) {
      console.error('HTTP ERROR', err.response.status, err.response.data);
    } else {
      console.error('ERROR', err.message);
    }
  }
})();