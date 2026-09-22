const axios = require('axios');
const { getModel } = require('./config/adapter');
const mongoose = require('mongoose');

(async () => {
  try {
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@esnex.com',
      password: 'Admin1234',
    });
    console.log('LOGIN_STATUS', login.status);
    console.log('LOGIN_BODY', JSON.stringify(login.data));

    const token = login.data.token;
    const Attempt = getModel('AssessmentAttempt');
    const attempt = await Attempt.create({
      assessmentType: 'standard',
      assessmentTypeRef: 'StandardAssessment',
      studentId: new mongoose.Types.ObjectId(),
      assessmentId: new mongoose.Types.ObjectId(),
      status: 'in-progress',
      questions: [],
      totalMarks: 100,
      duration: 60,
      tabSwitches: 0,
      warnings: 0,
    });
    console.log('ATTEMPT_ID', attempt._id.toString());

    const resp = await axios.post(
      `http://localhost:5000/api/assessments/${attempt._id}/tab-switch`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('TAB_SWITCH_STATUS', resp.status);
    console.log('TAB_SWITCH_BODY', JSON.stringify(resp.data));
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('ERR_STATUS', err.response.status);
      console.error('ERR_DATA', JSON.stringify(err.response.data));
    } else {
      console.error('ERR', err.message);
    }
    process.exit(1);
  }
})();
