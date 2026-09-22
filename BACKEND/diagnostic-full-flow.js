const http = require('http');

const request = (opts, data) => new Promise((resolve, reject) => {
  const req = http.request(opts, res => { 
    let body = ''; 
    res.on('data', c => body += c); 
    res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers })); 
  });
  req.on('error', reject);
  if (data) req.write(data);
  req.end();
});

(async () => {
  try {
    // Login
    const loginRes = await request(
      { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify({ email: 'alpha@gmail.com', password: 'Alpha123' })
    );
    const token = JSON.parse(loginRes.body).token;
    console.log('✓ Logged in');

    // Get questions
    const qRes = await request(
      { hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/essay-types/article/questions', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
    );
    const q = JSON.parse(qRes.body).questions[0];

    // Start attempt
    const startRes = await request(
      { hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/start', method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
      JSON.stringify({ selectedPart: 'B', essayType: 'article', essayQuestionId: q.id })
    );
    const attemptData = JSON.parse(startRes.body);
    const attemptId = attemptData.attemptId;
    
    console.log('✓ Attempt started:', attemptId);
    console.log('  Questions in start response:', attemptData.questions?.length || 0);
    if (attemptData.questions && attemptData.questions[0]) {
      const q0 = attemptData.questions[0];
      console.log('  Question 0 all fields:', Object.keys(q0));
      console.log('  Question 0:', q0);
    }

    // Fetch attempt to see what's stored
    const fetchRes = await request(
      { hostname: '127.0.0.1', port: 5000, path: `/api/assessments/attempt/${attemptId}`, method: 'GET', headers: { Authorization: 'Bearer ' + token } }
    );
    
    if (fetchRes.status === 200) {
      const fetchedAttempt = JSON.parse(fetchRes.body);
      console.log('✓ Fetched attempt after start');
      console.log('  Stored questions count:', fetchedAttempt.questions?.length || 0);
      if (fetchedAttempt.questions && fetchedAttempt.questions[0]) {
        const q0 = fetchedAttempt.questions[0];
        console.log('  Stored Question 0:', q0);
      }
    } else {
      console.log('✗ Fetch attempt failed:', fetchRes.status, fetchRes.body);
    }

    // Submit with answer
    const submitRes = await request(
      { hostname: '127.0.0.1', port: 5000, path: `/api/assessments/${attemptId}/submit`, method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
      JSON.stringify({ 
        answers: [{ 
          questionIndex: 0, 
          studentAnswer: 'Technology is transforming education in profound ways...'
        }] 
      })
    );
    
    console.log('✓ Submit status:', submitRes.status);
    const submitResult = JSON.parse(submitRes.body);
    console.log('  Answers in response:', submitResult.attempt?.answers?.length || 0);
    if (submitResult.attempt?.answers && submitResult.attempt.answers[0]) {
      const ans = submitResult.attempt.answers[0];
      console.log('  Answer 0:', {
        questionIndex: ans.questionIndex,
        studentAnswer: ans.studentAnswer?.substring(0, 50),
        marks: ans.marks,
        isCorrect: ans.isCorrect
      });
    }

    // Fetch after submit
    const fetchRes2 = await request(
      { hostname: '127.0.0.1', port: 5000, path: `/api/assessments/attempt/${attemptId}`, method: 'GET', headers: { Authorization: 'Bearer ' + token } }
    );
    
    if (fetchRes2.status === 200) {
      const attempt2 = JSON.parse(fetchRes2.body);
      console.log('✓ Fetched attempt after submit');
      console.log('  Answers count:', attempt2.answers?.length || 0);
      if (attempt2.answers && attempt2.answers[0]) {
        const ans = attempt2.answers[0];
        console.log('  Answer 0:', {
          studentAnswer: ans.studentAnswer?.substring(0, 50),
          marks: ans.marks
        });
      }
    } else {
      console.log('✗ Fetch after submit failed:', fetchRes2.status);
    }
  } catch (err) {
    console.error('ERROR', err.message);
  }
})();
