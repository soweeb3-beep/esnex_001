const path = require('path');
const { getModel } = require('../config/adapter');

async function run() {
  try {
    const [,, assessmentId, studentEmail] = process.argv;
    if (!assessmentId || !studentEmail) {
      console.error('Usage: node clear_user_inprogress.js <assessmentId> <studentEmail>');
      process.exit(1);
    }

    const User = getModel('User');
    const Attempt = getModel('AssessmentAttempt');

    const user = await User.findOne({ email: studentEmail });
    if (!user) {
      console.error('User not found:', studentEmail);
      process.exit(1);
    }

    const userId = user._id ? user._id.toString() : (user.id || user._id || user);
    const res = await Attempt.deleteMany({ assessmentId, studentId: userId, status: 'in-progress' });
    console.log('Deleted count:', res.deletedCount || 0);
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(2);
  }
}

run();
