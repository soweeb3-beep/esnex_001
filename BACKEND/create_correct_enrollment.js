#!/usr/bin/env node
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function createCorrectEnrollment() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Delete the old enrollment with string ID
    await db.collection('assessmentenrollments').deleteOne({
      studentId: 'alpha_user_001',
      assessmentId: 'tz7hco9ae'
    });
    console.log('✅ Deleted old enrollment with string ID');

    // Create enrollment with correct ObjectId reference
    const englishAssessmentId = new mongoose.Types.ObjectId('6a0b63cefb919523d032d6ca');
    const result = await db.collection('assessmentenrollments').insertOne({
      studentId: 'alpha_user_001',
      assessmentId: englishAssessmentId,
      accessGranted: true,
      subscriptionStatus: 'active',
      paymentStatus: 'completed',
      subscriptionType: 'free',
      attempts: 0,
      bestScore: 0,
      bestPercentage: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Enrollment created with correct ObjectId:');
    console.log('   - Inserted ID:', result.insertedId);
    console.log('   - Student ID: alpha_user_001');
    console.log('   - Assessment ID: 6a0b63cefb919523d032d6ca (English)');

    // Verify the enrollment
    const enrollment = await db.collection('assessmentenrollments').findOne({
      studentId: 'alpha_user_001'
    });
    
    console.log('✅ Enrollment verified:', enrollment ? 'YES' : 'NO');
    if (enrollment) {
      console.log('   - Access Granted:', enrollment.accessGranted);
      console.log('   - Subscription Status:', enrollment.subscriptionStatus);
      console.log('   - Assessment ID:', enrollment.assessmentId);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createCorrectEnrollment();
