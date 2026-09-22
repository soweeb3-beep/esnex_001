(async () => {
  try {
    const standardController = require('../controllers/standardAssessmentController');

    // Call the loader directly to avoid extra parameter parsing complexity
    const questions = await standardController.loadQuestionsFromNewPath('physics', 'objective', 0, ['objective/questions.json']);
    console.log('loader returned count:', Array.isArray(questions) ? questions.length : 0);
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('Loader did not return questions');
      process.exit(3);
    }
    console.log('PASS: Loader returned', questions.length, 'questions');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
