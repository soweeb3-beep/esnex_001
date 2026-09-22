require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const axios = require('axios');
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('./models/user');
    const email = 'alpha@gmail.com';
    const baseUrl = 'http://localhost:5000/api/auth';

    console.log('Requesting forgot-password for', email);
    const forgotRes = await axios.post(`${baseUrl}/forgot-password`, { email });
    console.log('FORGOT RESPONSE', forgotRes.status, forgotRes.data);

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found after forgot-password');
    }
    console.log('DB PIN', user.resetPasswordPin, 'expiry', user.resetPasswordPinExpiry);
    if (!user.resetPasswordPin) {
      throw new Error('No PIN stored in DB');
    }

    const pin = user.resetPasswordPin;
    const newPassword = 'NewPass123!';
    console.log('Calling reset-password with PIN', pin);
    const resetRes = await axios.post(`${baseUrl}/reset-password`, { email, pin, newPassword });
    console.log('RESET RESPONSE', resetRes.status, resetRes.data);

    console.log('Attempting login with new password');
    const loginRes = await axios.post(`${baseUrl}/login`, { email, password: newPassword });
    console.log('LOGIN RESPONSE', loginRes.status, loginRes.data);

    process.exit(0);
  } catch (err) {
    console.error('ERROR', err.response ? err.response.data : err.message);
    process.exit(1);
  }
})();
