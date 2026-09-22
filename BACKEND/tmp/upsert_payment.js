require('dotenv').config();
const connectDB = require('../config/db');
const { getModel } = require('../config/adapter');

async function upsert() {
  await connectDB();
  const Payment = getModel('Payment');
  const doc = {
    paymentId: 'PAY-PROD-1',
    studentId: 'stu3',
    productType: 'assessment',
    productId: 'a1',
    amount: 200,
    currency: 'GMD',
    status: 'pending',
    verificationStatus: 'unverified',
    email: 'prod@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const res = await Payment.findOneAndUpdate({ paymentId: doc.paymentId }, { $set: doc }, { upsert: true, new: true, setDefaultsOnInsert: true });
  console.log('Upserted payment:', res && res.paymentId);
  process.exit(0);
}

upsert().catch(err => { console.error('Upsert failed:', err); process.exit(1); });
