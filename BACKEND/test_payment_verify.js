require('dotenv').config();
const mongoose = require('mongoose');

async function testVerifyPayment() {
  try {
    console.log('🧪 TEST: Starting payment verify test');
    console.log('WAVE_API_KEY:', process.env.WAVE_API_KEY?.substring(0, 10) + '...');
    console.log('Starts with test_:', String(process.env.WAVE_API_KEY).startsWith('test_'));
    
    await mongoose.connect(process.env.MONGO_URI);
    const Payment = require('./models/Payment');
    
    // Create a test payment
    const paymentId = 'TEST-' + Date.now();
    const payment = await Payment.create({
      paymentId,
      studentId: '6a14599e48d9114de54e63b0',
      studentName: 'Test Student',
      email: 'test@example.com',
      productType: 'course',
      productId: '6a39bb58a53eb440ba82f924',
      productName: 'Test Course',
      amount: 2000,
      currency: 'USD',
      paymentMethod: 'Wave',
      paymentSource: 'Wave',
      status: 'pending',
      verificationStatus: 'unverified',
    });
    
    console.log('✅ Created test payment:', paymentId);
    console.log('   Status before verify:', payment.status);
    
    // Now manually run the verify logic
    console.log('\n🔍 Checking test API key condition:');
    console.log('   WAVE_API_KEY exists:', !!process.env.WAVE_API_KEY);
    console.log('   Test condition:', String(process.env.WAVE_API_KEY).startsWith("test_"));
    
    if (String(process.env.WAVE_API_KEY).startsWith("test_")) {
      console.log('✅ TEST API KEY DETECTED! Auto-approving payment...');
      payment.transactionId = paymentId;
      payment.gatewayReference = `test-${paymentId}`;
      payment.paymentMethod = 'Card';
      payment.verificationStatus = 'verified';
      payment.status = 'completed';
      payment.verifiedAt = new Date();
      await payment.save();
      console.log('✅ Payment updated to completed');
    } else {
      console.log('❌ TEST API KEY NOT DETECTED - this is the problem!');
    }
    
    const updated = await Payment.findOne({paymentId});
    console.log('\n✅ Final payment status:', updated.status);
    console.log('   Verification:', updated.verificationStatus);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testVerifyPayment();
