const axios = require('axios');
(async () => {
  try {
    const base = 'http://localhost:5000/api';
    const login = await axios.post(`${base}/auth/login`, { email: 'saliue@gmail.com', password: 'Saliue123' });
    const token = login.data.token;
    console.log('TOKEN', token ? token.slice(0,20) + '...' : 'NONE');
    const subjectMeta = await axios.get(`${base}/assessments/global/subject/physics`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('META', JSON.stringify(subjectMeta.data, null, 2));
    const startRes = await axios.post(`${base}/assessments/global/subject/physics/start`, { selectedPart: 'A' }, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true });
    console.log('START_STATUS', startRes.status);
    console.log(JSON.stringify(startRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERR_STATUS', err.response.status);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
})();
