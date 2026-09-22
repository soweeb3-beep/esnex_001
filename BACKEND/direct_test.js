const mongoose = require('mongoose');
const express = require('express');
const app = express();

// Try to require the controller directly
try {
  const { getModel } = require('./config/adapter');
  const AssessmentModel = getModel('Assessment');
  
  console.log('AssessmentModel loaded:', typeof AssessmentModel);
  console.log('AssessmentModel.create type:', typeof AssessmentModel.create);
  
  // Try to create directly
  const testData = {
    name: 'Direct Test',
    type: 'global',
    subject: 'english',
    duration: 60,
    totalMarks: 100,
    passingScore: 50,
    parts: [{
      partName: 'Part 1',
      partType: 'Objective',
      duration: 60,
      totalQuestions: 10,
      sections: [{name: 'Section 1', questionCount: 10}]
    }]
  };
  
  console.log('\nTest data:', JSON.stringify(testData, null, 2));
  
  AssessmentModel.create(testData)
    .then(result => {
      console.log('\n✅ SUCCESS! Assessment created:');
      console.log('ID:', result._id);
      console.log('Name:', result.name);
    })
    .catch(err => {
      console.error('\n❌ FAILED! Error:', err.message);
      console.error('Error name:', err.name);
      console.error('Error details:', err);
      if (err.errors) {
        console.error('\nValidation errors:');
        Object.keys(err.errors).forEach(key => {
          console.error(`  ${key}:`, err.errors[key].message);
        });
      }
    });
    
} catch (error) {
  console.error('Failed to load model:', error.message);
}
