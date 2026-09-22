const axios = require('axios');
const fs = require('fs');
const path = require('path');

(async () => {
  const base = 'http://localhost:5000/api';
  const user = { email: 'alpha@gmail.com', password: 'Alpha123' };
  try {
    const loginRes = await axios.post(`${base}/auth/login`, user, { headers: { 'Content-Type': 'application/json' } });
    const token = loginRes.data.token || loginRes.data.accessToken || (loginRes.data.data && loginRes.data.data.token);
    if (!token) throw new Error('No token from login');
    console.log('LOGIN OK');

    let assessmentId = '6a0b63cefb919523d032d6ca';
    try {
      const meta = await axios.get(`${base}/assessments/global/subject/english`, { headers: { Authorization: `Bearer ${token}` } });
      assessmentId = meta.data.assessment?._id || (meta.data.assessment && meta.data.assessment._id) || assessmentId;
      console.log('Assessment id:', assessmentId);
    } catch (metaErr) {
      console.warn('META FETCH FAILED - using fallback assessment id', metaErr.response ? JSON.stringify(metaErr.response.data) : metaErr.message);
    }

    try {
      await axios.post(`${base}/assessments/${assessmentId}/enroll`, {}, { headers: { Authorization: `Bearer ${token}` } });
      console.log('ENROLLED');
    } catch (enrollErr) {
      console.warn('ENROLL FAILED', enrollErr.response ? JSON.stringify(enrollErr.response.data) : enrollErr.message);
    }

    const startRes = await axios.post(`${base}/assessments/global/assessment/start-part`, { subject: 'english', partName: 'Theory' }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('STARTED', 'attemptId=', startRes.data.attemptId, 'questions=', (startRes.data.questions || []).length);

    const attemptId = startRes.data.attemptId;
    const answers = [
      {
        questionIndex: 0,
        studentAnswer: `Dear Honourable Minister,\n\nI write to draw your attention to the deteriorating state of public transport in our city. The main causes include chronic underfunding, ageing vehicle fleets, and poor route planning that fails to match commuters' needs. Additionally, inadequate maintenance and weak regulatory oversight have led to frequent breakdowns and unsafe travel conditions.\n\nTo address these challenges, I recommend prioritizing budget allocations for public transport modernization, investing in a mixed fleet of buses with low-emission engines, and establishing a reliable maintenance schedule. Implementing data-driven route optimization and strengthening public-private partnerships will improve coverage and punctuality. Finally, training for drivers and enforcement of safety standards will restore passenger confidence.\n\nYours faithfully,\nA Concerned Citizen`,
      },
      {
        questionIndex: 1,
        studentAnswer: `The people were drawn to the prayer house because they answered a call to worship and sought communal solace following a recent troubling event. The passage shows they gathered for spiritual guidance and mutual support, which the prayer house provided as a central meeting place.`,
      },
      {
        questionIndex: 2,
        studentAnswer: `Karimu’s family were happy because the bungalow offered him improved living conditions and opportunities. The passage suggests the bungalow represented a safer, more resourceful environment where he could thrive, giving the family hope and relief.`,
      },
    ];

    const submitRes = await axios.post(`${base}/assessments/${attemptId}/submit`, { answers }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('SUBMIT OK', submitRes.data.status || submitRes.data.score || 'no-score', JSON.stringify(submitRes.data.result?.questions || submitRes.data, null, 2).slice(0,2000));

    const aiRes = await axios.post(`${base}/assessments/${attemptId}/ai-mark`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('AI MARK', aiRes.data.success, JSON.stringify(aiRes.data.attempt || aiRes.data, null, 2).slice(0,2000));

    try {
      const attemptData = aiRes.data.attempt || aiRes.data;
      const out = { loginUser: user.email, attempt: attemptData, submit: submitRes.data };
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Theory Assessment Result</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:20px}pre{background:#f4f4f4;padding:12px;border-radius:6px}</style>
</head><body>
<h2>Theory Assessment Result — ${user.email}</h2>
<p><strong>Attempt ID:</strong> ${attemptData._id || attemptId} — <strong>Status:</strong> ${attemptData.status || 'unknown'}</p>
<h3>Essay / Story Question Review</h3>
${(attemptData.answers||[]).map(a=>{
  const wc = (a.studentAnswer||'').split(/\s+/).filter(Boolean).length;
  const cats = a.aiReport && a.aiReport.categoryScores ? a.aiReport.categoryScores : a.categoryScores || {};
  return `<div style="margin-bottom:16px"><strong>Q:</strong> ${a.questionText||a.questionId||''}<br><strong>Words:</strong> ${wc}<br><strong>Marks:</strong> ${a.marks||a.score||cats.total||''}<br><strong>Category Scores:</strong> ${Object.entries(cats).map(([k,v])=>`${k}: ${v}`).join(', ')}<pre>${(a.studentAnswer||'').replace(/</g,'&lt;')}</pre></div>`;
}).join('')}
<h3>Raw JSON</h3>
<pre>${JSON.stringify(out,null,2)}</pre>
</body></html>`;

      const outPath = path.join(__dirname, 'latest_result.html');
      fs.writeFileSync(outPath, html, 'utf8');
      console.log('WROTE HTML', outPath);
    } catch (writeErr) {
      console.warn('WRITE FAILED', writeErr.message);
    }
  } catch (err) {
    if (err.response) {
      console.error('ERROR STATUS', err.response.status);
      console.error('ERROR DATA', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
