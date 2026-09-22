#!/usr/bin/env node
/**
 * Payment Security Enforcement Tests (A–D)
 * 
 * Before running:
 * 1. Start backend: npm start (or node server.js)
 * 2. Ensure MongoDB is running and accessible
 * 3. Set API_BASE_URL, STUDENT_TOKEN, COURSE_ID, ASSESSMENT_ID below
 * 
 * Run: node payment_enforcement_tests.js
 */

const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'esnex';

let studentToken = process.env.STUDENT_TOKEN;
let studentId = process.env.STUDENT_ID;
let courseId = process.env.COURSE_ID;
let assessmentId = process.env.ASSESSMENT_ID;

const results = {
  testA: { passed: false, error: null, response: null },
  testB: { passed: false, error: null, response: null },
  testC: { passed: false, error: null, response: null },
  testD: { passed: false, error: null, response: null },
};

const axiosInstance = axios.create({
  validateStatus: () => true, // Don't throw on any status
});

async function getDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  return { client, db: client.db(DB_NAME) };
}

async function testA() {
  console.log('\n=== TEST A: Assessment Access Without Payment ===');
  try {
    if (!studentToken || !assessmentId) {
      console.error('Missing STUDENT_TOKEN or ASSESSMENT_ID');
      results.testA.error = 'Missing environment variables';
      return;
    }

    const response = await axiosInstance.post(
      `${API_BASE}/assessments/global/start/${assessmentId}`,
      { assessmentPaid: false },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    // Expected: 403 or 402
    const success = response.status === 403 || response.status === 402;
    if (success) {
      console.log('✅ PASS: Access denied as expected');
      results.testA.passed = true;
    } else {
      console.log('❌ FAIL: Expected 403/402 but got', response.status);
    }
    results.testA.response = response.data;
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    results.testA.error = err.message;
  }
}

async function testB() {
  console.log('\n=== TEST B: Course Content Without Payment ===');
  try {
    if (!studentToken || !courseId) {
      console.error('Missing STUDENT_TOKEN or COURSE_ID');
      results.testB.error = 'Missing environment variables';
      return;
    }

    const response = await axiosInstance.get(
      `${API_BASE}/courses/${courseId}/content`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    // Expected: 403
    const success = response.status === 403;
    if (success) {
      console.log('✅ PASS: Access denied as expected');
      results.testB.passed = true;
    } else {
      console.log('❌ FAIL: Expected 403 but got', response.status);
    }
    results.testB.response = response.data;
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    results.testB.error = err.message;
  }
}

async function testC() {
  console.log('\n=== TEST C: Verified Payment Grants Access ===');
  try {
    if (!studentId || !assessmentId) {
      console.error('Missing STUDENT_ID or ASSESSMENT_ID');
      results.testC.error = 'Missing environment variables';
      return;
    }

    const { client, db } = await getDB();

    // Create test payment
    const paymentData = {
      paymentId: `PAY_TEST_${Date.now()}`,
      studentId: ObjectId.isValid(studentId) ? ObjectId(studentId) : studentId,
      productType: 'assessment',
      productId: ObjectId.isValid(assessmentId) ? ObjectId(assessmentId) : assessmentId,
      amount: 2000,
      status: 'completed',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      metadata: { completionProcessed: false },
    };

    await db.collection('payments').insertOne(paymentData);
    console.log('✓ Test payment created:', paymentData.paymentId);

    // Verify payment via webhook (or manual call)
    const verifyResponse = await axiosInstance.post(
      `${API_BASE}/payments/verify`,
      { paymentId: paymentData.paymentId },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log(`Verify Status: ${verifyResponse.status}`);
    console.log(`Verify Response:`, JSON.stringify(verifyResponse.data, null, 2));

    // Check enrollment was created
    const enrollment = await db.collection('assessmentenrollments').findOne({
      studentId: ObjectId.isValid(studentId) ? ObjectId(studentId) : studentId,
      assessmentId: ObjectId.isValid(assessmentId) ? ObjectId(assessmentId) : assessmentId,
    });

    console.log('Enrollment Check:', enrollment ? '✓ Found' : '✗ Not found');
    if (enrollment) {
      console.log('  accessGranted:', enrollment.accessGranted);
      console.log('  paymentId:', enrollment.paymentId);
    }

    const success = enrollment && enrollment.accessGranted === true;
    if (success) {
      console.log('✅ PASS: Enrollment created with verified payment');
      results.testC.passed = true;
    } else {
      console.log('❌ FAIL: Enrollment not created or accessGranted is false');
    }
    results.testC.response = { enrollment };

    await client.close();
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    results.testC.error = err.message;
  }
}

async function testD() {
  console.log('\n=== TEST D: Duplicate Webhook Protection (Idempotency) ===');
  try {
    if (!studentId) {
      console.error('Missing STUDENT_ID');
      results.testD.error = 'Missing environment variables';
      return;
    }

    const { client, db } = await getDB();

    const txnId = `TXN_${Date.now()}`;
    const paymentData = {
      paymentId: `PAY_DUP_${Date.now()}`,
      studentId: ObjectId.isValid(studentId) ? ObjectId(studentId) : studentId,
      productType: 'assessment',
      productId: new ObjectId(),
      transactionId: txnId,
      amount: 1000,
      status: 'completed',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      metadata: { completionProcessed: false },
    };

    // Insert test payment
    const insertRes = await db.collection('payments').insertOne(paymentData);
    console.log('✓ Test payment inserted:', paymentData.paymentId);

    // First webhook call
    const webhook1 = await axiosInstance.post(
      `${API_BASE}/payments/webhook/wave`,
      {
        transaction_id: txnId,
        status: 'COMPLETED',
        amount: 1000,
      }
    );

    console.log(`1st webhook Status: ${webhook1.status}`);
    console.log(`1st webhook Response:`, JSON.stringify(webhook1.data, null, 2));

    // Second webhook call (duplicate)
    const webhook2 = await axiosInstance.post(
      `${API_BASE}/payments/webhook/wave`,
      {
        transaction_id: txnId,
        status: 'COMPLETED',
        amount: 1000,
      }
    );

    console.log(`2nd webhook Status: ${webhook2.status}`);
    console.log(`2nd webhook Response:`, JSON.stringify(webhook2.data, null, 2));

    // Check payment records
    const paymentCount = await db.collection('payments').countDocuments({
      transactionId: txnId,
    });

    console.log(`Payment records with txn ${txnId}:`, paymentCount);

    const success = paymentCount === 1;
    if (success) {
      console.log('✅ PASS: Duplicate prevented, only one record exists');
      results.testD.passed = true;
    } else {
      console.log('❌ FAIL: Expected 1 record but found', paymentCount);
    }
    results.testD.response = { paymentCount, webhook1: webhook1.data, webhook2: webhook2.data };

    await client.close();
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    results.testD.error = err.message;
  }
}

async function runAllTests() {
  console.log('Payment Security Enforcement Tests');
  console.log('==================================\n');
  console.log('API Base:', API_BASE);
  console.log('Student ID:', studentId || 'NOT SET');
  console.log('Course ID:', courseId || 'NOT SET');
  console.log('Assessment ID:', assessmentId || 'NOT SET');

  await testA();
  await testB();
  await testC();
  await testD();

  console.log('\n=== TEST SUMMARY ===');
  const summary = {
    'Test A (Assessment No Payment)': results.testA.passed ? '✅ PASS' : '❌ FAIL',
    'Test B (Course No Payment)': results.testB.passed ? '✅ PASS' : '❌ FAIL',
    'Test C (Verified Payment Access)': results.testC.passed ? '✅ PASS' : '❌ FAIL',
    'Test D (Duplicate Webhook)': results.testD.passed ? '✅ PASS' : '❌ FAIL',
  };
  console.table(summary);

  const allPassed = Object.values(results).every(r => r.passed);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  // Write results to file
  const fs = require('fs');
  const reportPath = `test-results-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
