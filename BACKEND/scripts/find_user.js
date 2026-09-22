require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const email = 'saliue@gmail.com';
  const u = await db.collection('users').findOne({ email });
  console.log('found:', !!u);
  if (u) console.log({ _id: u._id, email: u.email, password: !!u.password });
  await mongoose.disconnect();
}

run().catch(e=>{ console.error(e); process.exit(1); });
