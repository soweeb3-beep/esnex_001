(
  async () => {
    try {
      const controller = require('../controllers/assessmentController');
      const invalidAttemptId = 'not_a_valid_object_id';
      const reqBase = { params: { attemptId: invalidAttemptId }, user: { id: 'u1', _id: 'u1', role: 'student' }, body: {} };

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
        { name: 'recordTabSwitch', fn: controller.recordTabSwitch },
        { name: 'getAttempt', fn: controller.getAttempt },
        { name: 'getAttemptResume', fn: controller.getAttemptResume },
        { name: 'updateAttemptTimeLeft', fn: controller.updateAttemptTimeLeft },
      ];

      for (const test of tests) {
        const req = { ...reqBase };
        const res = resTemplate();
        await test.fn(req, res);

        if (res.getStatus() !== 400) {
          console.error(`FAILED: Expected 400 for invalid attemptId in ${test.name}`);
          process.exit(3);
        }
        if (!res.getBody() || res.getBody().message !== 'Invalid attemptId') {
          console.error(`FAILED: Unexpected body for invalid attemptId in ${test.name}`, res.getBody());
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
