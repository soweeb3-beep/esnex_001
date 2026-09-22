const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'esnex';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const TOKEN = process.env.STUDENT_TOKEN || '';
const STUDENT_ID = process.env.STUDENT_ID || '';
const COURSE_ID = process.env.COURSE_ID || '';

if (!TOKEN || !STUDENT_ID || !COURSE_ID) {
  console.error('Please set STUDENT_TOKEN, STUDENT_ID, and COURSE_ID environment variables');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  try {
    // Create a verified payment
    const payments = db.collection('payments');
    const paymentId = `PAY_CONFIRM_${Date.now()}`;
    const paymentDoc = {
      paymentId,
      studentId: ObjectId.isValid(STUDENT_ID) ? ObjectId(STUDENT_ID) : STUDENT_ID,
      productType: 'course',
      productId: ObjectId.isValid(COURSE_ID) ? ObjectId(COURSE_ID) : COURSE_ID,
      amount: 2000,
      status: 'completed',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      metadata: { test: true }
    };

    const pRes = await payments.insertOne(paymentDoc);
    console.log('Inserted payment:', paymentId, pRes.insertedId);

    // Create or update enrollment
    const enrollments = db.collection('enrollments');
    const filter = { student: ObjectId.isValid(STUDENT_ID) ? ObjectId(STUDENT_ID) : STUDENT_ID, course: ObjectId.isValid(COURSE_ID) ? ObjectId(COURSE_ID) : COURSE_ID };
    const update = {
      $set: {
        student: filter.student,
        course: filter.course,
        accessType: 'full',
        paymentId: pRes.insertedId,
        paymentReference: paymentId,
        paymentStatus: 'paid',
        enrolledDate: new Date(),
        accessGranted: true
      }
    };

    const upsertRes = await enrollments.updateOne(filter, update, { upsert: true });
    console.log('Enrollment upsert result:', upsertRes.result || upsertRes);

    // Call protected endpoint
    const res = await axios.get(`${API_BASE}/courses/${COURSE_ID}/content`, { headers: { Authorization: `Bearer ${TOKEN}` }, validateStatus: () => true });
    console.log('Protected endpoint status:', res.status);
    console.log('Response body:', JSON.stringify(res.data, null, 2));

    // cleanup: optional - leave data for inspection
  } catch (err) {
    console.error('Error during confirm script:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
}

run();
