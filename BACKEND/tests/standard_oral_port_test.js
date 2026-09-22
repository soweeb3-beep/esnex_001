(async () => {
  try {
    const controller = require('../controllers/standardAssessmentController');
    console.log('startOralAssessment exported:', typeof controller.startOralAssessment === 'function');
  } catch (err) {
    console.error('Error loading controller:', err && err.message);
    process.exit(2);
  }
})();
