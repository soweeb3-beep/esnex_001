const connectDB = require('../config/db');
const { getModel } = require('../config/adapter');

const id = process.argv[2] || '6a3b427960b8fe7674d5486e';

(async () => {
  try {
    await connectDB();
    const Course = getModel('Course');
    const doc = await Course.findById(id).lean ? await Course.findById(id).lean() : await Course.findById(id);
    console.log('Raw course document:');
    console.log(JSON.stringify(doc, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Inspect error:', err);
    process.exit(1);
  }
})();
