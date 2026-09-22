#!/usr/bin/env node
/**
 * Create test enrollments for student accounts
 * This allows bypassing the payment flow for testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function createTestEnrollments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the default database
    const db = mongoose.connection.db;

    // Find the student user (alpha@gmail.com)
    const users = await db.collection('users').findOne({ email: 'alpha@gmail.com' });
    if (!users) {
      console.error('❌ User alpha@gmail.com not found');
      process.exit(1);
    }
    const studentId = users._id;
    console.log(`✅ Found student: ${studentId}`);

    // Find the English assessment - try multiple collection names
    let englishAssessment = await db.collection('assessments').findOne({ 
      subject: 'english'
    });
    
    if (!englishAssessment) {
      englishAssessment = await db.collection('standardassessments').findOne({ 
        subject: 'english'
      });
    }
    
    if (!englishAssessment) {
      // List all collections to help debug
      console.log('Available collections:');
      const collections = await db.listCollections().toArray();
      collections.forEach(c => console.log(`  - ${c.name}`));
      console.error('❌ English assessment not found');
      process.exit(1);
    }
    const assessmentId = englishAssessment._id;
    console.log(`✅ Found English assessment: ${assessmentId}`);

    // Create or update enrollment
    const enrollment = {
      assessmentId,
      studentId,
      enrolledDate: new Date(),
      accessGranted: true,
      subscriptionStatus: 'active',
      subscriptionType: 'free',
      paymentStatus: 'completed',
      paymentMethod: 'Manual',
      paymentAmount: 0,
      paymentReference: `TEST-${Date.now()}`,
    };

    const result = await db.collection('assessmentenrollments').updateOne(
      { assessmentId, studentId },
      { $set: enrollment },
      { upsert: true }
    );

    console.log(`✅ Enrollment created/updated:`);
    console.log(`   Modified: ${result.modifiedCount}, Inserted: ${result.upsertedCount}`);

    // Verify enrollment was created
    const verifyEnrollment = await db.collection('assessmentenrollments').findOne({ 
      assessmentId,
      studentId 
    });
    console.log(`✅ Verified enrollment:`);
    console.log(`   ID: ${verifyEnrollment._id}`);
    console.log(`   accessGranted: ${verifyEnrollment.accessGranted}`);
    console.log(`   subscriptionStatus: ${verifyEnrollment.subscriptionStatus}`);

    console.log('\n✅ Test enrollments created successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestEnrollments();
