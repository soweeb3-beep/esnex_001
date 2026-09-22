const connectDB = require('./config/db');
const { getModel } = require('./config/adapter');

async function migrateAssessmentDurations() {
  try {
    // Connect to database
    await connectDB();

    // Get Assessment model
    const Assessment = getModel('Assessment');

    console.log('🔄 Starting assessment duration migration...');

    // Find all global assessments
    const globalAssessments = await Assessment.find({ type: 'global' });

    console.log(`📊 Found ${globalAssessments.length} global assessments to update`);

    let updatedCount = 0;

    for (const assessment of globalAssessments) {
      const oldDuration = assessment.duration;

      // Calculate new duration based on parts (sum of part durations)
      let newDuration = 0;
      if (assessment.parts && assessment.parts.length > 0) {
        newDuration = assessment.parts.reduce((sum, part) => sum + (part.duration || 0), 0);
      }

      // If no parts or duration is 0, set a default duration
      if (newDuration === 0) {
        newDuration = 120; // Default 2 hours
      }

      // Update the assessment duration
      if (assessment.save && typeof assessment.save === 'function') {
        // MongoDB model
        assessment.duration = newDuration;
        await assessment.save();
      } else {
        // Mock database model
        await Assessment.findByIdAndUpdate(assessment._id, { duration: newDuration });
      }

      console.log(`✅ Updated ${assessment.name}: ${oldDuration}min → ${newDuration}min`);
      updatedCount++;
    }

    console.log(`🎉 Migration completed! Updated ${updatedCount} assessments.`);

    // Close database connection
    if (connectDB.isMongoConnected && connectDB.isMongoConnected()) {
      await require('mongoose').connection.close();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateAssessmentDurations();