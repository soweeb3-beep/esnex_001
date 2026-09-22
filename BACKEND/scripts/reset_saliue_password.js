require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const email = 'saliue@gmail.com';
  const password = 'Saliue123';
  const hash = await bcrypt.hash(password, 10);
  const updateRes = await db.collection('users').updateOne(
    { email },
    { $set: { password: hash, updatedAt: new Date() } }
  );
  if (!updateRes || updateRes.matchedCount === 0) {
    console.error('User not found or not updated:', email);
    process.exit(1);
  }
  const u = await db.collection('users').findOne({ email });
  console.log('Password updated for', email, 'userId=', u._id.toString());
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
