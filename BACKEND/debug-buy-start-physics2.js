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
    const allRes = await axios.get(base + '/assessments/global', { headers: { Authorization: `Bearer ${token}` } }).catch(e=>e.response?e.response.data:e);
    let list = [];
    if (Array.isArray(allRes)) list = allRes;
    else if (Array.isArray(allRes.data)) list = allRes.data;
    else if (Array.isArray(allRes.data?.assessments)) list = allRes.data.assessments;
    else if (Array.isArray(allRes.assessments)) list = allRes.assessments;
    else if (allRes && typeof allRes === 'object' && Array.isArray(allRes.assessments)) list = allRes.assessments;

    if (!Array.isArray(list)) list = [];

    const physics = list.find(a => String(a.subject).toLowerCase() === 'physics' && Number(a.price) > 0) || list.find(a => String(a.subject).toLowerCase() === 'physics');
    if (!physics) {
      console.log('No Physics assessment found in public list. Dumping response for debugging.');
      console.log(JSON.stringify(allRes, null, 2));
      return;
    }

    console.log('Selected assessment:', { id: physics._id, name: physics.name, price: physics.price });

    // Initiate payment
    console.log('Initiating payment...');
    const initRes = await axios.post(base + '/payments/initiate', {
      productType: 'assessment',
      productId: physics._id,
      amount: physics.price || 0,
      currency: physics.currency || 'GMD',
      email,
      firstName: 'Alpha',
      lastName: 'Test',
      paymentSource: 'Wave',
      paymentMethod: 'Wave'
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('INITIATE', initRes.status, initRes.data?.message || JSON.stringify(initRes.data?.data || initRes.data));
    const paymentId = initRes.data?.data?.paymentId || initRes.data?.paymentId || initRes.data?.data?.paymentId || initRes.data?.data?.paymentId;
    if (!paymentId) {
      console.log('No paymentId returned; response:', JSON.stringify(initRes.data, null, 2));
      return;
    }

    // Verify payment (dev mode auto-approves)
    console.log('Verifying payment...');
    const verifyRes = await axios.post(base + '/payments/verify', { paymentId }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('VERIFY', verifyRes.status, verifyRes.data?.message || JSON.stringify(verifyRes.data?.data || verifyRes.data));

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
      console.error('ERROR', err.message, err.stack);
    }
  }
})();