require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Enrollment = require('./models/Enrollment');
const { AssessmentEnrollment } = require('./models/Assessment');

const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI_ATLAS || 'mongodb://127.0.0.1:27017/esnex_learning';

(async () => {
  try {
    await mongoose.connect(mongoUri);

    console.log('Connected to', mongoUri);

    const deleteUsersResult = await User.deleteMany({ roleString: { $nin: ['admin', 'super-admin'] } });
    const deleteEnrollmentsResult = await Enrollment.deleteMany({});
    const deleteAssessmentEnrollmentsResult = await AssessmentEnrollment.deleteMany({});

    console.log('Deleted users:', deleteUsersResult.deletedCount);
    console.log('Deleted enrollments:', deleteEnrollmentsResult.deletedCount);
    console.log('Deleted assessment enrollments:', deleteAssessmentEnrollmentsResult.deletedCount);
  } catch (error) {
    console.error('Deletion failed:', error.message || error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
