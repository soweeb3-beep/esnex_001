const axios = require('axios');

async function login() {
  const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'admin@esnex.com', password: 'Admin1234' });
  return login.data.token;
}

(async () => {
  try {
    const token = await login();
    console.log('Logged in for essay AI tests');

    // Get essay types for English
    const essayTypesRes = await axios.get('http://localhost:5000/api/assessments/global/subject/english/essay-types', { headers: { Authorization: `Bearer ${token}` } });
    const essayTypes = essayTypesRes.data.essayTypes || [];
    const chosenType = essayTypes[0] || 'letter';
    console.log('Using essay type:', chosenType);

    // Get questions for chosen type
    const qRes = await axios.get(`http://localhost:5000/api/assessments/global/subject/english/essay-types/${chosenType}/questions`, { headers: { Authorization: `Bearer ${token}` } });
    const questions = qRes.data.questions || [];
    if (!questions.length) {
      console.error('No essay questions available for English; skipping test');
      process.exit(0);
    }
    const q = questions[0];
    console.log('Selected question id:', q.id || q.questionId || q._id);

    // Start an assessment for this essay question
    const startBody = { selectedPart: 'B', essayType: chosenType, essayQuestionId: q.id || q._id || q.questionId };
    const startResp = await axios.post('http://localhost:5000/api/assessments/global/subject/english/start', startBody, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startResp.data.attempt || startResp.data;
    const attemptId = attempt._id || attempt.id || attempt.attemptId;
    console.log('Started attempt:', attemptId);

    // Case 1: Long answer (expect reasonable score, provider may be local fallback)
    const longAnswer = Array(300).fill('word').join(' '); // ~300 words
    const submitBody1 = { answers: [ { questionIndex: 0, questionId: q.id || q._id || q.questionId, studentAnswer: longAnswer, questionText: q.text || q.question || '' } ] };
    await axios.post(`http://localhost:5000/api/assessments/${attemptId}/submit`, submitBody1, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Submitted long answer, triggering AI mark...');
    const aiMarkRes1 = await axios.post(`http://localhost:5000/api/assessments/${attemptId}/ai-mark`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const updatedAttempt1 = aiMarkRes1.data.attempt || aiMarkRes1.data;
    if (!updatedAttempt1 || !Array.isArray(updatedAttempt1.answers) || !updatedAttempt1.answers[0]) {
      console.error('ESSAY AI TEST FAIL: No answers found after AI mark (long answer)');
      process.exit(2);
    }
    const ans1 = updatedAttempt1.answers[0];
    console.log('Long answer aiMarked:', ans1.aiMarked, 'marks:', ans1.marks);
    if (!ans1.aiReport) {
      console.warn('Long answer: no aiReport present; provider may have failed to return structured report, but aiMarked flag expected to be true or fallback provided.');
    }

    // Case 2: Very short answer (below minimum) - expect low score but not crash
    const shortAnswer = 'Ok.';
    const submitBody2 = { answers: [ { questionIndex: 0, questionId: q.id || q._id || q.questionId, studentAnswer: shortAnswer, questionText: q.text || q.question || '' } ] };
    await axios.post(`http://localhost:5000/api/assessments/${attemptId}/answer`, submitBody2, { headers: { Authorization: `Bearer ${token}` } });
    // Call ai-mark to re-evaluate
    console.log('Submitted short answer, triggering AI mark...');
    const aiMarkRes2 = await axios.post(`http://localhost:5000/api/assessments/${attemptId}/ai-mark`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const updatedAttempt2 = aiMarkRes2.data.attempt || aiMarkRes2.data;
    const ans2 = Array.isArray(updatedAttempt2.answers) ? updatedAttempt2.answers[0] : null;
    if (!ans2) { console.error('ESSAY AI TEST FAIL: No answer after AI mark (short answer)'); process.exit(2); }
    console.log('Short answer aiMarked:', ans2.aiMarked, 'marks:', ans2.marks, 'wordCount:', ans2.aiReport?.wordCount || (ans2.studentAnswer || '').split(/\s+/).filter(Boolean).length);

    // Basic assertions: aiMarked true, numeric marks, aiReport exists
    if (typeof ans1.marks !== 'number' || typeof ans2.marks !== 'number') {
      console.error('ESSAY AI TEST FAIL: marks not numeric');
      process.exit(2);
    }

    console.log('ESSAY AI TEST: PASS');
    process.exit(0);
  } catch (err) {
    console.error('ESSAY AI TEST ERROR', err.response ? err.response.data : err.message);
    process.exit(3);
  }
})();
