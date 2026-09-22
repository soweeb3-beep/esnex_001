(
  async () => {
    try {
      const periodicController = require('../controllers/periodicQuizController');
      const sectionController = require('../controllers/sectionQuizController');
      const standardController = require('../controllers/standardAssessmentController');

      const invalidAttemptId = 'invalid_object_id';
      const baseReq = {
        params: { attemptId: invalidAttemptId },
        body: { attemptId: invalidAttemptId },
        user: { _id: 'u1', id: 'u1' },
      };

      const resTemplate = () => {
        let resStatus = null;
        let resBody = null;
        return {
          status(code) { resStatus = code; return this; },
          json(obj) { resBody = obj; return obj; },
          getStatus() { return resStatus; },
          getBody() { return resBody; },
        };
      };

      const tests = [
        {
          name: 'submitPeriodicQuizAnswer',
          fn: periodicController.submitPeriodicQuizAnswer,
          req: { ...baseReq, body: { attemptId: invalidAttemptId, questionId: 'q1', studentAnswer: 'a' } },
          expectedKey: 'error',
        },
        {
          name: 'submitPeriodicQuiz',
          fn: periodicController.submitPeriodicQuiz,
          req: { ...baseReq, body: { attemptId: invalidAttemptId } },
          expectedKey: 'error',
        },
        {
          name: 'getPeriodicQuizResults',
          fn: periodicController.getPeriodicQuizResults,
          req: { ...baseReq, params: { attemptId: invalidAttemptId } },
          expectedKey: 'error',
        },
        {
          name: 'submitSectionQuizAnswer',
          fn: sectionController.submitSectionQuizAnswer,
          req: { ...baseReq, body: { attemptId: invalidAttemptId, questionId: 'q1', studentAnswer: 'a' } },
          expectedKey: 'error',
        },
        {
          name: 'submitSectionQuiz',
          fn: sectionController.submitSectionQuiz,
          req: { ...baseReq, body: { attemptId: invalidAttemptId } },
          expectedKey: 'error',
        },
        {
          name: 'getSectionQuizResults',
          fn: sectionController.getSectionQuizResults,
          req: { ...baseReq, params: { attemptId: invalidAttemptId } },
          expectedKey: 'error',
        },
        {
          name: 'submitAnswer',
          fn: standardController.submitAnswer,
          req: { ...baseReq, body: { attemptId: invalidAttemptId, questionId: 'q1', studentAnswer: 'a' } },
          expectedKey: 'error',
        },
        {
          name: 'submitPart',
          fn: standardController.submitPart,
          req: { ...baseReq, body: { attemptId: invalidAttemptId } },
          expectedKey: 'error',
        },
      ];

      for (const test of tests) {
        const req = { params: { ...(test.req.params || {}) }, body: { ...(test.req.body || {}) }, user: test.req.user };
        const res = resTemplate();
        await test.fn(req, res);

        if (res.getStatus() !== 400) {
          console.error(`FAILED: Expected 400 for invalid attemptId in ${test.name}`);
          process.exit(3);
        }
        const body = res.getBody();
        if (!body || body[test.expectedKey] !== 'Invalid attemptId') {
          console.error(`FAILED: Unexpected body for invalid attemptId in ${test.name}`, body);
          process.exit(4);
        }
        console.log(`PASS: ${test.name} returns 400 for invalid attemptId`);
      }

      process.exit(0);
    } catch (err) {
      console.error('Test error', err && err.stack ? err.stack : err);
      process.exit(2);
    }
  }
)();
