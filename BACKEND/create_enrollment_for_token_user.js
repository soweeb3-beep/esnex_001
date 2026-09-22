#!/usr/bin/env node
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function createTokenUserEnrollment() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Create enrollment for the JWT token user "alpha_user_001"
    const result = await db.collection('assessmentenrollments').updateOne(
      { 
        studentId: 'alpha_user_001', 
        assessmentId: 'tz7hco9ae' 
      },
      {
        $set: {
          studentId: 'alpha_user_001',
          assessmentId: 'tz7hco9ae',
          accessGranted: true,
          subscriptionStatus: 'active',
          paymentStatus: 'completed',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log('✅ Enrollment created/updated:');
    console.log('   - Matched:', result.matchedCount);
    console.log('   - Modified:', result.modifiedCount);
    console.log('   - Upserted:', result.upsertedCount);
    console.log('   - User ID: alpha_user_001');
    console.log('   - Assessment ID: tz7hco9ae');

    // Verify the enrollment was created
    const enrollment = await db.collection('assessmentenrollments').findOne({
      studentId: 'alpha_user_001',
      assessmentId: 'tz7hco9ae'
    });
    
    console.log('✅ Enrollment verified:', enrollment ? 'YES' : 'NO');
    if (enrollment) {
      console.log('   - Access Granted:', enrollment.accessGranted);
      console.log('   - Subscription Status:', enrollment.subscriptionStatus);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTokenUserEnrollment();
