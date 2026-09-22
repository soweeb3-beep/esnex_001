const axios = require('axios');
const { getModel } = require('./config/adapter');

(async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { email: 'alpha@gmail.com', password: 'Alpha123' });
    const token = loginRes.data.token;
    const decoded = require('jsonwebtoken').decode(token);
    console.log('LOGIN_OK', decoded);

    const response = await axios.get('http://localhost:5000/api/assessments/enrolled', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('ENROLLED_RESPONSE', JSON.stringify(response.data, null, 2));

    const AssessmentEnrollment = getModel('AssessmentEnrollment');
    const User = getModel('User');
    const userId = decoded.id;
    const user = await User.findById(userId).lean();
    console.log('USER', { id: user?._id, email: user?.email, role: user?.roleString || user?.role });

    const enrollments = await AssessmentEnrollment.find({ studentId: userId }).lean();
    console.log('DB_ENROLLMENTS_COUNT', enrollments.length);
    for (const enrollment of enrollments) {
      console.log('ENROLLMENT', {
        id: enrollment._id,
        assessmentId: enrollment.assessmentId,
        assessmentIdType: typeof enrollment.assessmentId,
        assessmentIdRaw: JSON.stringify(enrollment.assessmentId),
        accessGranted: enrollment.accessGranted,
        status: enrollment.status,
        subscriptionStatus: enrollment.subscriptionStatus,
        paymentStatus: enrollment.paymentStatus,
      });
    }
  } catch (err) {
    if (err.response) {
      console.error('HTTP ERROR', err.response.status, err.response.data);
    } else {
      console.error('ERROR', err.message, err.stack);
    }
  }
})();