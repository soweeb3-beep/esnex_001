const fs = require('fs');
const axios = require('axios');
const logFile = 'verify_saliue_physics_log.txt';
const log = (msg) => {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
};
try {
  fs.writeFileSync(logFile, 'START\n');
  log('require ok');
  const base = 'http://localhost:5000/api';
  axios.post(`${base}/auth/login`, { email: 'saliue@gmail.com', password: 'Saliue123' })
    .then((login) => {
      log('login status ' + login.status);
      const token = login.data.token;
      log('token ' + (!!token));
      return axios.get(`${base}/assessments/global/subject/physics`, { headers: { Authorization: `Bearer ${token}` } });
    })
    .then((subjectMeta) => {
      log('subjectMeta status ' + subjectMeta.status);
      log('subjectMeta data ' + JSON.stringify(subjectMeta.data));
      return axios.post('http://localhost:5000/api/assessments/global/subject/physics/start', { selectedPart: 'A' }, { headers: { Authorization: `Bearer ${subjectMeta.config.headers.Authorization}` }, validateStatus: () => true });
    })
    .then((startRes) => {
      log('start status ' + startRes.status);
      log('start data ' + JSON.stringify(startRes.data));
    })
    .catch((err) => {
      log('ERROR ' + (err && err.message));
      if (err && err.response) {
        log('ERR_STATUS ' + err.response.status);
        try { log('ERR_DATA ' + JSON.stringify(err.response.data)); } catch (e) { log('ERR_DATA_PARSE_FAILED ' + e.message); }
      }
    })
    .finally(() => { log('DONE'); });
} catch (err) {
  log('FATAL ' + err.message);
}
