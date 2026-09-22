const { previewStartBySubject } = require('../controllers/assessmentController');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

(async () => {
  try {
    await connectDB();
    // Helper to run preview and capture response
    const runPreview = (subject, selectedPart) => new Promise((resolve) => {
      const req = { query: { subject, selectedPart } };
      const res = {
        json: (obj) => resolve({ status: 200, body: obj }),
        status: (code) => ({ json: (obj) => resolve({ status: code, body: obj }) }),
      };
      previewStartBySubject(req, res).catch((e) => resolve({ status: 500, error: e.message }));
    });

    console.log('Running preview twice to compare outputs...');
    const r1 = await runPreview('physics', 'A');
    console.log('Preview 1:', JSON.stringify(r1, null, 2));
    const r2 = await runPreview('physics', 'A');
    console.log('Preview 2:', JSON.stringify(r2, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Run preview direct error', e);
    process.exit(1);
  }
})();
