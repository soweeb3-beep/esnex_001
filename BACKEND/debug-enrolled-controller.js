const controller = require('./controllers/assessmentController');

(async () => {
  const req = {
    user: { id: '6a14599e48d9114de54e63b0' },
  };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      console.log('STATUS', this.statusCode);
      console.log(JSON.stringify(payload, null, 2));
    },
  };

  try {
    await controller.getEnrolledAssessments(req, res);
  } catch (err) {
    console.error(err);
  }
})();
