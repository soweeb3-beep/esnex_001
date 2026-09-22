require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI, {
  });

  const db = mongoose.connection.db;
  const email = 'saliue@gmail.com';
  const subject = 'physics';

  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const assessment = await db.collection('assessments').findOne({ subject: { $regex: new RegExp('^' + subject + '$', 'i') }, type: 'global', status: 'published' });
  if (!assessment) {
    console.error('Assessment not found for subject:', subject);
    process.exit(1);
  }

  const enrollmentData = {
    assessmentId: assessment._id,
    studentId: user._id,
    enrolledDate: new Date(),
    accessGranted: true,
    subscriptionType: assessment.price > 0 ? 'monthly' : 'free',
    subscriptionStatus: 'active',
    paymentStatus: assessment.price > 0 ? 'completed' : 'paid',
    paymentAmount: assessment.price || 0,
    paymentCurrency: 'GMD',
    paymentDate: new Date(),
    transactionId: assessment.price > 0 ? `manual-${Date.now()}` : undefined,
    accessType: 'assessment',
    validUntil: assessment.price > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
    expiryDate: assessment.price > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('assessmentenrollments').findOneAndUpdate(
    { assessmentId: assessment._id, studentId: user._id },
    { $set: enrollmentData },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Enrollment upserted:', result.lastErrorObject ? result.lastErrorObject : result.value);
  console.log('User:', { email: user.email, id: user._id.toString() });
  console.log('Assessment:', { subject: assessment.subject, id: assessment._id.toString(), price: assessment.price });
  console.log('Enrollment:', result.value || result);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});