require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('./models/user');
  const u = await User.findOne({ email: 'alpha@gmail.com' });
  if (!u) {
    console.error('USER NOT FOUND');
    process.exit(1);
  }
  u.resetPasswordPin = '654321';
  u.resetPasswordPinExpiry = new Date(Date.now() + 15 * 60 * 1000);
  await u.save();
  console.log('SET PIN', u.email, u.resetPasswordPin, u.resetPasswordPinExpiry);
  process.exit(0);
})();
