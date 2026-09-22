const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Assessment } = require('./models/Assessment');
(async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/esnex_learning';
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
    const docs = await Assessment.find({ subject: { $regex: /^physics$/i } }).lean();
    console.log('COUNT', docs.length);
    docs.forEach((doc) => {
      console.log('ID', doc._id);
      console.log('SUBJECT', doc.subject);
      console.log('NAME', doc.name);
      console.log('PARTS LEN', Array.isArray(doc.parts) ? doc.parts.length : 'no parts');
      console.log('PARTS SAMPLE', JSON.stringify((doc.parts || []).slice(0, 1), null, 2));
      console.log('TOTALQ', doc.totalQuestions, 'TOTALMARKS', doc.totalMarks, 'ALLOWED', JSON.stringify(doc.allowedParts));
      console.log('---');
    });
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await mongoose.disconnect();
  }
})();
