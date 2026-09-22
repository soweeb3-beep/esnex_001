(async () => {
  try {
    const proxyquire = require('proxyquire').noPreserveCache();
    const examLoaderMock = require('./__mocks__/examLoaderMock');

    const standardController = proxyquire('../controllers/standardAssessmentController', {
      '../utils/examLoader': {
        ...require('../utils/examLoader'),
        getSubjectConfig: examLoaderMock.getSubjectConfig,
      },
    });

    const req = { body: { subject: 'physics', name: 'Physics Auto' }, user: { id: 'admin', _id: 'admin' } };
    let resPayload = null;
    const res = { status(code) { this._status = code; return this; }, json(obj) { resPayload = obj; console.log('Template response keys:', Object.keys(obj)); return obj; } };

    await standardController.getAssessmentTemplate(req, res);

    if (!resPayload || !resPayload.template) {
      console.error('FAILED: no template returned');
      process.exit(3);
    }

    const template = resPayload.template;
    const partCount = Array.isArray(template.parts) ? template.parts.length : 0;
    const totalQuestions = Number(template.totalQuestions || 0);

    if (partCount === 0) {
      console.error('FAILED: template returned but contains no parts');
      console.error('Template payload:', JSON.stringify(template, null, 2));
      process.exit(4);
    }

    if (totalQuestions <= 0) {
      console.error('FAILED: template returned but totalQuestions is not positive');
      console.error('Template payload:', JSON.stringify(template, null, 2));
      process.exit(5);
    }

    const emptySections = template.parts.filter((part) => !Array.isArray(part.sections) || part.sections.length === 0);
    if (emptySections.length > 0) {
      console.error('FAILED: template contains a part with no sections');
      console.error('Template payload:', JSON.stringify(template, null, 2));
      process.exit(6);
    }

    console.log('Template parts:', partCount);
    console.log('Template totalQuestions:', totalQuestions);
    console.log('PASS: template built with valid content');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
