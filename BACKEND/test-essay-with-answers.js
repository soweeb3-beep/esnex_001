const http = require('http');
const loginData = JSON.stringify({ email: 'alpha@gmail.com', password: 'Alpha123' });
const request = (opts, data) => new Promise((resolve, reject) => {
  const req = http.request(opts, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers })); });
  req.on('error', reject);
  if (data) req.write(data);
  req.end();
});

(async () => {
  try {
    const login = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) } }, loginData);
    if (login.status !== 200) { console.error('Login failed', login); return; }
    const token = JSON.parse(login.body).token;
    console.log('✓ Logged in');

    // Get essay types
    const essayTypesRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/essay-types', method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const essayTypes = essayTypesRes.status === 200 ? JSON.parse(essayTypesRes.body).essayTypes || [] : [];
    const chosenType = essayTypes[0] || 'letter';
    console.log('✓ Essay types:', essayTypes);

    // Get questions for chosen type
    const qRes = await request({ hostname: '127.0.0.1', port: 5000, path: `/api/assessments/global/subject/english/essay-types/${chosenType}/questions`, method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const qdata = JSON.parse(qRes.body);
    const q = qdata.questions[0];
    console.log('✓ Question selected:', q.id, q.text.substring(0, 50));

    // Start assessment with essay selection
    const startBody = JSON.stringify({ selectedPart: 'B', essayType: chosenType, essayQuestionId: q.id });
    const startRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/start', method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, startBody);
    const attemptData = JSON.parse(startRes.body);
    const attemptId = attemptData.attemptId || (attemptData.attempt && attemptData.attempt._id);
    console.log('✓ Attempt started:', attemptId);

    // Submit with properly formatted answers
    const sampleAnswer = `Environmental protection is vital to ensure sustainable development. Individuals, communities, and governments must work together to reduce pollution, protect wildlife habitats, and promote renewable energy. Education and policy are key drivers of environmental awareness and conservation efforts worldwide.`;
    
    // Submit with answers in the correct format expected by the backend
    const submitBody = JSON.stringify({ 
      answers: [ 
        { 
          questionIndex: 0, 
          studentAnswer: sampleAnswer,
          questionId: q.id,
          questionText: q.text
        } 
      ] 
    });
    
    console.log('Submitting with answer...');
    const submitRes = await request({ hostname: '127.0.0.1', port: 5000, path: `/api/assessments/${attemptId}/submit`, method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(submitBody) } }, submitBody);
    console.log('✓ Submit status:', submitRes.status);
    const submitResult = JSON.parse(submitRes.body);
    if (submitResult.result && submitResult.result.answers) {
      console.log('Answers in submit response:', submitResult.result.answers.length, 'answer(s)');
    }

    // Trigger AI mark endpoint
    const aiMarkRes = await request({ hostname: '127.0.0.1', port: 5000, path: `/api/assessments/${attemptId}/ai-mark`, method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    console.log('✓ AI mark status:', aiMarkRes.status);
    
    if (aiMarkRes.status === 200) {
      const r = JSON.parse(aiMarkRes.body);
      console.log('✓ AI mark response - attempt status:', r.attempt.status);
      if (r.attempt.answers && r.attempt.answers[0]) {
        const ans = r.attempt.answers[0];
        console.log('Answer 0 - aiMarked:', ans.aiMarked, 'marks:', ans.marks);
        if (ans.aiReport) {
          console.log('AI Report score:', ans.aiReport.score);
          console.log('AI Feedback:', ans.aiReport.feedback ? ans.aiReport.feedback.substring(0, 150) : 'N/A');
        }
      } else {
        console.log('⚠ No answers found in attempt after AI mark');
      }
    } else {
      console.log('AI mark error:', aiMarkRes.body);
    }
  } catch (err) {
    console.error('ERROR', err.message);
  }
})();
