/**
 * Fix script to update English assessment's theory questionCount
 * Sets comprehension and summary to 0 to load all questions
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/esnex_learning");
    console.log(`✅ MongoDB connected to: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Get Assessment model
const getAssessmentModel = async () => {
  const conn = await connectDB();
  const assessmentSchema = require("./models/Assessment");
  return assessmentSchema.Assessment || assessmentSchema;
};

// Main function
const fixTheoryQuestions = async () => {
  try {
    console.log("🔧 Starting fix for English theory questions...\n");
    
    const Assessment = await getAssessmentModel();
    
    // Find English assessment
    const englishAssessments = await Assessment.find({
      subject: "english",
      type: "global",
      status: "published"
    });
    
    console.log(`Found ${englishAssessments.length} English assessments\n`);
    
    for (const assessment of englishAssessments) {
      console.log(`Processing assessment: ${assessment.name} (${assessment._id})`);
      
      // Find theory part
      const theoryPart = assessment.parts.find(p => p.type === "theory" || p.partType === "Theory");
      
      if (!theoryPart) {
        console.log("  ⚠️  No theory part found, skipping\n");
        continue;
      }
      
      console.log(`  Found theory part with ${theoryPart.sections?.length || 0} sections`);
      
      // Update comprehension and summary sections
      let updated = false;
      if (theoryPart.sections) {
        theoryPart.sections.forEach(section => {
          if (section.type === "comprehension" || section.name === "Comprehension") {
            console.log(`    - Comprehension: ${section.questionCount} -> 0`);
            section.questionCount = 0;
            updated = true;
          }
          if (section.type === "summary" || section.name === "Summary") {
            console.log(`    - Summary: ${section.questionCount} -> 0`);
            section.questionCount = 0;
            updated = true;
          }
        });
      }
      
      if (updated) {
        await assessment.save();
        console.log("  ✅ Assessment updated\n");
      } else {
        console.log("  ℹ️  No changes needed\n");
      }
    }
    
    console.log("✅ Fix complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

// Run fix
fixTheoryQuestions();
