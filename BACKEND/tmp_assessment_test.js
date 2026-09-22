const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const token = jwt.sign({ id: 'alpha_user_001', email: 'alpha@gmail.com', role: 'student', name: 'Alpha Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const urls = [
  '/api/assessments',
  '/api/assessments/enrolled',
  '/api/assessments/global/start/y034ucr5g',
];

(async () => {
  for (const url of urls) {
    try {
      const method = url === '/api/assessments/global/start/y034ucr5g' ? 'post' : 'get';
      const res = await axios({ method, url: 'http://localhost:5000' + url, headers: { Authorization: 'Bearer ' + token }, data: method === 'post' ? {} : undefined });
      console.log(url, res.status, res.data);
    } catch (error) {
      console.log(url, error.response ? error.response.status : 'ERR', error.response ? error.response.data : error.message);
    }
  }
})();
