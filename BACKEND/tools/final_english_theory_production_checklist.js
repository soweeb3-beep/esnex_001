require('dotenv').config();
const connectDB = require('../config/db');
const { getModel } = require('../config/adapter');
const { startAssessmentBySubject, submitAssessment, aiMarkAttempt } = require('../controllers/assessmentController');

const makeRes = () => {
  let payload = null;
  return {
    status(code) {
      this._status = code;
      return this;
    },
    json(obj) {
      payload = obj;
      this._payload = obj;
      return this;
    },
    get payload() {
      return payload;
    },
  };
};

const callController = async (fn, req) => {
  const res = makeRes();
  await fn(req, res);
  return res.payload;
};

const buildSampleAnswer = (question, index) => {
  const questionType = String((question.questionType || question.type || question.question?.questionType || question.question?.type || '')).toLowerCase();
  const essayTypes = ['essay', 'letter', 'article', 'debate', 'story', 'composition', 'narrative'];
  if (essayTypes.some((type) => questionType.includes(type))) {
    return Array(200).fill('This is a formal English essay response demonstrating structure, clarity, and correct language use.').join(' ');
  }
  if (questionType.includes('comprehension')) {
    return 'The passage teaches a clear lesson about perseverance and careful planning, and the reader should identify the author’s main message from each paragraph.';
  }
  if (questionType.includes('summary')) {
    return 'The summary captures the passage’s headline idea, the key supporting detail, and the writer’s concluding point in a concise form.';
  }
  return `Sample answer for question index ${index}.`;
};

const normalizeQuestionType = (question) => {
  const raw = String((question.questionType || question.type || question.question?.questionType || question.question?.type || '')).toLowerCase();
  const essayTypes = ['essay', 'letter', 'article', 'debate', 'story', 'composition', 'narrative'];
  if (essayTypes.some((type) => raw.includes(type))) return 'essay';
  if (raw.includes('comprehension')) return 'comprehension';
  if (raw.includes('summary')) return 'summary';
  return raw || 'unknown';
};

const summarizeAiProviders = (attempt) => {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const providers = answers.map((ans) => ans.aiReport?.provider || (ans.aiReport?.rawResponse?.local ? 'local' : 'unknown'));
  const counts = providers.reduce((acc, provider) => {
    const key = provider || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return { providers, counts };
};

const hasRealAiProvider = (attempt) => {
  const { providers } = summarizeAiProviders(attempt);
  return providers.length > 0 && providers.every((p) => p === 'gemini' || p === 'openai');
};

const run = async () => {
  console.log('=== English Theory Production Checklist Validation ===');

  const env = {
    MONGO_URI_SET: Boolean(process.env.MONGO_URI),
    AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
    GEMINI_API_KEY_SET: Boolean(process.env.GEMINI_API_KEY),
    OPENAI_API_KEY_SET: Boolean(process.env.OPENAI_API_KEY),
  };
  console.log('Environment:');
  console.log(`  MONGO_URI set: ${env.MONGO_URI_SET}`);
  console.log(`  AI_PROVIDER=${env.AI_PROVIDER}`);
  console.log(`  GEMINI_API_KEY set: ${env.GEMINI_API_KEY_SET}`);
  console.log(`  OPENAI_API_KEY set: ${env.OPENAI_API_KEY_SET}`);

  const missing = [];
  if (!env.GEMINI_API_KEY_SET && !env.OPENAI_API_KEY_SET) {
    missing.push('No AI provider key set (GEMINI_API_KEY or OPENAI_API_KEY required for real AI grading)');
  }

  await connectDB();
  const dbConnected = require('../config/db').isMongoConnected();
  console.log(`Database mode: ${dbConnected ? 'MongoDB connected' : 'Mock DB fallback'}`);

  const Enrollment = getModel('AssessmentEnrollment');
  const AssessmentAttempt = getModel('AssessmentAttempt');

  const fakeUser = { id: '000000000000000000000000', _id: '000000000000000000000000' };
  const startReq = {
    params: { subject: 'english' },
    headers: { authorization: 'Bearer test' },
    body: { selectedPart: 'B' },
    user: fakeUser,
  };

  let startPayload = await callController(startAssessmentBySubject, startReq);

  if (!startPayload) {
    throw new Error('Start payload was empty');
  }

  if (startPayload.requiresPayment && startPayload.assessmentId) {
    console.log('Assessment requires payment. Creating a mock enrollment and retrying...');
    await Enrollment.create({
      assessmentId: startPayload.assessmentId,
      studentId: fakeUser.id,
      enrolledDate: new Date(),
      accessGranted: true,
      subscriptionType: 'free',
      subscriptionStatus: 'active',
      attempts: 0,
    });
    startPayload = await callController(startAssessmentBySubject, startReq);
  }

  if (!startPayload.attemptId && !startPayload.attempt) {
    throw new Error(`Unable to start English theory assessment: ${JSON.stringify(startPayload)}`);
  }

  const attemptId = String(startPayload.attemptId || startPayload.attempt?._id || startPayload.attempt?._id);
  const questions = startPayload.questions || startPayload.attempt?.questions || [];

  console.log(`Started English theory attempt ${attemptId} with ${questions.length} questions`);

  const typeCounts = questions.reduce((counts, question) => {
    const questionType = normalizeQuestionType(question);
    counts[questionType] = (counts[questionType] || 0) + 1;
    return counts;
  }, {});

  console.log('Question type counts:', typeCounts);
  if (!typeCounts.essay) missing.push('Essay question not present in the started attempt');
  if (!typeCounts.comprehension) missing.push('Comprehension question not present in the started attempt');
  if (!typeCounts.summary) missing.push('Summary question not present in the started attempt');

  const answers = questions.map((question, index) => ({
    questionIndex: index,
    studentAnswer: buildSampleAnswer(question, index),
  }));

  const submitReq = {
    params: { attemptId },
    body: { answers },
    user: fakeUser,
  };
  const submitPayload = await callController(submitAssessment, submitReq);

  if (!submitPayload || !submitPayload.attempt) {
    throw new Error(`Submit failed: ${JSON.stringify(submitPayload)}`);
  }

  const submittedAttempt = submitPayload.attempt;
  console.log('Submit response:');
  console.log(`  totalMarks=${submittedAttempt.totalMarks}`);
  console.log(`  obtainedMarks=${submittedAttempt.obtainedMarks}`);
  console.log(`  percentage=${submittedAttempt.percentage}`);

  if (Number(submittedAttempt.totalMarks) !== 100) {
    missing.push(`Expected totalMarks 100, got ${submittedAttempt.totalMarks}`);
  }

  const aiReq = {
    params: { attemptId },
    user: fakeUser,
  };
  let aiPayload;
  try {
    aiPayload = await callController(aiMarkAttempt, aiReq);
  } catch (err) {
    if (missing.length === 0 && err.message.includes('No AI provider configured')) {
      missing.push('AI provider key missing; AI marking could not run with real provider');
    }
    throw err;
  }

  const finalAttempt = aiPayload.attempt;
  console.log('After AI marking:');
  console.log(`  attempt.status=${finalAttempt.status}`);
  console.log(`  attempt.totalMarks=${finalAttempt.totalMarks}`);
  console.log(`  attempt.obtainedMarks=${finalAttempt.obtainedMarks}`);
  console.log(`  attempt.percentage=${finalAttempt.percentage}`);
  console.log(`  aiReport present=${Boolean(finalAttempt.aiReport)}`);
  const aiProviderSummary = summarizeAiProviders(finalAttempt);
  console.log(`  ai provider counts=${JSON.stringify(aiProviderSummary.counts)}`);

  if (finalAttempt.status !== 'marked') {
    missing.push(`Attempt status expected 'marked' after AI marking, got '${finalAttempt.status}'`);
  }
  if (!finalAttempt.aiReport) {
    missing.push('AI report not persisted on the attempt');
  }
  if (!hasRealAiProvider(finalAttempt)) {
    missing.push('AI marking did not use a real Gemini/OpenAI provider for all answers; local fallback or unknown provider was used');
  }

  const savedAttempt = await AssessmentAttempt.findById(attemptId).lean();
  const attemptPersisted = Boolean(savedAttempt);
  console.log(`Attempt persisted in DB: ${attemptPersisted}`);
  if (!attemptPersisted) missing.push('Attempt not found in database after AI marking');

  console.log('\n=== Checklist Summary ===');
  if (missing.length === 0) {
    console.log('✅ All production checklist items passed.');
  } else {
    console.log('⚠️  Checklist found issues:');
    missing.forEach((item) => console.log(` - ${item}`));
  }

  if (missing.length > 0) {
    process.exit(1);
  }
  process.exit(0);
};

run().catch((err) => {
  console.error('Final checklist validation failed:', err.message || err);
  if (err.response) {
    console.error('Response error:', err.response.status, err.response.data);
  }
  process.exit(1);
});
