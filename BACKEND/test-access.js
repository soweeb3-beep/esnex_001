const { getModel } = require('./config/adapter');

(async () => {
  console.log('\n=== SIMULATING checkCourseAccess ===\n');
  
  const courseId = '76oos1loq';
  const userId = 'alpha_user_001';
  
  console.log('Input params:', { courseId, userId });
  
  try {
    // Get course
    const Course = getModel('Course');
    let query = Course.findById(courseId);
    if (typeof query.lean === 'function') {
      query = query.lean();
    }
    const course = await query;
    console.log('✓ Course:', { exists: !!course, _id: course?._id, price: course?.price });
    
    if (!course) {
      console.log('❌ FAIL: Course not found');
      process.exit(1);
    }
    
    if (!course.price || Number(course.price) === 0) {
      console.log('✓ PASS: Free course');
      process.exit(0);
    }
    
    // Get enrollment
    const Enrollment = getModel('Enrollment');
    console.log('Enrollment.findOne query:', { student: userId, course: courseId });
    const enrollment = await Enrollment.findOne({ student: userId, course: courseId });
    console.log('✓ Enrollment:', { exists: !!enrollment, _id: enrollment?._id, paymentId: enrollment?.paymentId });
    
    if (!enrollment) {
      console.log('❌ FAIL: No enrollment');
      process.exit(1);
    }
    
    // Check payment
    if (enrollment.paymentId) {
      console.log('\nChecking payment by ID:', enrollment.paymentId);
      const Payment = getModel('Payment');
      const paymentQuery = Payment.findById(enrollment.paymentId);
      let payment = null;
      if (typeof paymentQuery.lean === 'function') {
        payment = await paymentQuery.lean();
      } else {
        payment = await paymentQuery;
      }
      console.log('✓ Payment:', { exists: !!payment, _id: payment?._id, status: payment?.status, verified: payment?.verificationStatus });
      
      if (payment && payment.status === 'completed' && payment.verificationStatus === 'verified') {
        console.log('✓ PASS: Payment verified');
        process.exit(0);
      } else {
        console.log('❌ FAIL: Payment not verified or not found');
        process.exit(1);
      }
    }
    
    console.log('❌ FAIL: No paymentId');
    process.exit(1);
    
  } catch (e) {
    console.error('❌ EXCEPTION:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
