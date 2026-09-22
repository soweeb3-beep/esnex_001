const mongoose = require('mongoose');
const http = require('http');

const request = (opts, data) => new Promise((resolve, reject) => {
  const req = http.request(opts, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body })); });
  req.on('error', reject);
  if (data) req.write(data);
  req.end();
});

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/esnex_learning');
    const db = mongoose.connection.db;
    const attemptsCollection = db.collection('assessmentattempts');

    // Login and get token
    const loginData = JSON.stringify({ email: 'alpha@gmail.com', password: 'Alpha123' });
    const login = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) } }, loginData);
    if (login.status !== 200) { console.error('Login failed'); return; }
    const token = JSON.parse(login.body).token;
    console.log('✓ Logged in');

    // Get essay types and question
    const essayTypesRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/essay-types', method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const essayTypes = JSON.parse(essayTypesRes.body).essayTypes || [];
    const chosenType = essayTypes[0] || 'letter';
    
    const qRes = await request({ hostname: '127.0.0.1', port: 5000, path: `/api/assessments/global/subject/english/essay-types/${chosenType}/questions`, method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const qdata = JSON.parse(qRes.body);
    const q = qdata.questions[0];

    // Start assessment
    const startBody = JSON.stringify({ selectedPart: 'B', essayType: chosenType, essayQuestionId: q.id });
    const startRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/assessments/global/subject/english/start', method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, startBody);
    const attemptData = JSON.parse(startRes.body);
    const attemptId = attemptData.attemptId || (attemptData.attempt && attemptData.attempt._id);
    console.log('✓ Attempt started:', attemptId);

    // Check DB BEFORE submit
    const beforeSubmit = await attemptsCollection.findOne({ _id: mongoose.Types.ObjectId.createFromHexString(attemptId) });
    console.log('\n📋 BEFORE SUBMIT:');
    console.log('  - answers array:', beforeSubmit.answers ? `${beforeSubmit.answers.length} items` : 'empty/null');
    console.log('  - questions array:', beforeSubmit.questions ? `${beforeSubmit.questions.length} items` : 'empty/null');
    if (beforeSubmit.questions && beforeSubmit.questions[0]) {
      console.log('  - First question fields:', Object.keys(beforeSubmit.questions[0]));
      console.log('  - Has correctAnswer?', beforeSubmit.questions[0].correctAnswer !== undefined);
    }

    // Submit with answer
    const sampleAnswer = `Environmental protection is vital...`;
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
    
    console.log('\n📤 SUBMITTING with answer...');
    const submitRes = await request({ hostname: '127.0.0.1', port: 5000, path: `/api/assessments/${attemptId}/submit`, method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(submitBody) } }, submitBody);
    console.log('Submit status:', submitRes.status);

    // Check DB AFTER submit
    const afterSubmit = await attemptsCollection.findOne({ _id: mongoose.Types.ObjectId.createFromHexString(attemptId) });
    console.log('\n📋 AFTER SUBMIT:');
    console.log('  - answers array:', afterSubmit.answers ? `${afterSubmit.answers.length} items` : 'empty/null');
    if (afterSubmit.answers && afterSubmit.answers[0]) {
      console.log('  - Answer 0 studentAnswer:', afterSubmit.answers[0].studentAnswer ? afterSubmit.answers[0].studentAnswer.substring(0, 50) : 'N/A');
      console.log('  - Answer 0 marks:', afterSubmit.answers[0].marks);
    }

    console.log('\n✓ Diagnostic complete');
    await mongoose.disconnect();
  } catch (err) {
    console.error('ERROR', err.message);
  }
})();
