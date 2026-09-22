const axios = require('axios');

async function login() {
  const res = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'admin@esnex.com',
    password: 'Admin1234',
  });
  return res.data.token;
}

(async () => {
  try {
    const token = await login();
    const response = await axios.get('http://localhost:5000/api/assessments/student/progress', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = response.data || {};
    const progress = Array.isArray(payload.progress) ? payload.progress : [];
    const assessmentSummaries = Array.isArray(payload.assessmentSummaries) ? payload.assessmentSummaries : [];
    const summary = payload.summary || {};

    if (!payload.success || !summary || typeof summary.inProgressCount !== 'number') {
      console.error('STUDENT DASHBOARD PROGRESS TEST FAIL: missing success payload', payload);
      process.exit(2);
    }

    if (!Array.isArray(progress) || !Array.isArray(assessmentSummaries)) {
      console.error('STUDENT DASHBOARD PROGRESS TEST FAIL: progress and assessmentSummaries must be arrays');
      process.exit(2);
    }

    if (assessmentSummaries.length > 0) {
      const first = assessmentSummaries[0];
      if (!first.assessmentName || typeof first.attemptCount !== 'number' || typeof first.averageScore !== 'number') {
        console.error('STUDENT DASHBOARD PROGRESS TEST FAIL: assessment summary missing required fields', first);
        process.exit(2);
      }
    }

    console.log('STUDENT DASHBOARD PROGRESS TEST: PASS');
    process.exit(0);
  } catch (err) {
    console.error('STUDENT DASHBOARD PROGRESS TEST ERROR', err.response ? err.response.data : err.message);
    process.exit(3);
  }
})();
