require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db;
  const email = 'saliue@gmail.com';
  const targetAssessmentId = '6a4d2dd7a1c69f62486c7606';

  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const assessment = await db.collection('assessments').findOne({ _id: new mongoose.Types.ObjectId(targetAssessmentId) });
  if (!assessment) {
    console.error('Assessment not found for id:', targetAssessmentId);
    process.exit(1);
  }

  const enrollmentData = {
    assessmentId: assessment._id,
    studentId: user._id,
    enrolledDate: new Date(),
    accessGranted: true,
    subscriptionType: 'monthly',
    subscriptionStatus: 'active',
    paymentStatus: 'paid',
    paymentAmount: assessment.price || 0,
    paymentCurrency: 'GMD',
    paymentDate: new Date(),
    transactionId: `manual-${Date.now()}`,
    accessType: 'assessment',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('assessmentenrollments').findOneAndUpdate(
    { assessmentId: assessment._id, studentId: user._id },
    { $set: enrollmentData },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Enrollment upserted for paid assessment:', targetAssessmentId);
  console.log('User:', { email: user.email, id: user._id.toString() });
  console.log('Assessment:', { subject: assessment.subject, id: assessment._id.toString(), price: assessment.price });
  console.log('Enrollment:', result.value || result);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});