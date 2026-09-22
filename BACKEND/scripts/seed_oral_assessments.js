/**
 * Seed Script: Create Oral Assessments for English, Physics, Chemistry, Mathematics
 * 
 * Structure:
 * - English: Objective + Theory (Essay/Comprehension/Summary) + Oral
 * - Physics: Objective + Theory + Practical
 * - Chemistry: Objective + Theory + Practical
 * - Mathematics: Objective + Theory
 * 
 * Each subject = 1 Assessment
 * Students choose parts inside the assessment
 * Backend keeps separate question folders internally
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Get Assessment model
const getModel = (modelName) => {
  try {
    return require(path.join(__dirname, "../config/adapter")).getModel(modelName);
  } catch (err) {
    const mod = require(path.join(__dirname, `../models/${modelName}`));
    // Support modules that export an object with the model under a property
    return mod[modelName] || mod.Assessment || mod.default || mod;
  }
};

async function seedOralAssessments() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/exnex";
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB");

    let Assessment = getModel("Assessment");
    // If the returned module is an object wrapper, extract the model
    if (Assessment && typeof Assessment.findOne !== "function") {
      Assessment = Assessment.Assessment || Assessment.default || Assessment;
    }
    // Ensure we have the correct Assessment model
    console.log('Debug: resolving Assessment model...');
    try {
      console.log('Debug: Assessment type=', typeof Assessment);
      console.log('Debug: Assessment keys=', Object.keys(Assessment || {}));
    } catch (e) {
      console.log('Debug: could not introspect Assessment model');
    }
    
    // Define assessment configurations
    const assessments = [
      {
        name: "English Assessment",
        description: "Comprehensive English assessment with Objective, Theory, and Oral components",
        subject: "English",
        type: "global",
        duration: 180, // 3 hours
        totalMarks: 100,
        status: "published",
        price: 5000, // GMD
        subscription: "monthly",
        parts: [
          {
            partName: "Objective",
            partType: "Objective",
            duration: 45,
            totalQuestions: 50,
            totalMarks: 25,
            instructions: "Answer all 50 objective questions. Select the best option (A, B, C, or D).",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 50,
                totalMarks: 25,
                instructions: "Multiple choice questions",
                bankPath: "english/objective",
                files: ["section1.json", "section2.json", "section3.json", "section4.json", "section5.json", "section6.json"],
              },
            ],
          },
          {
            partName: "Theory",
            partType: "Theory",
            duration: 120,
            totalQuestions: 4,
            totalMarks: 60,
            instructions: "Complete all theory sections. Choose essay type, answer comprehension, and write a summary.",
            sections: [
              {
                name: "Essay",
                type: "essay",
                questionCount: 1,
                totalMarks: 30,
                instructions: "Write an essay (450-500 words). Choose one type: Letter, Article, Debate, or Story.",
                bankPath: "english/theory/essay",
              },
              {
                name: "Comprehension",
                type: "comprehension",
                questionCount: 2,
                totalMarks: 20,
                instructions: "Answer comprehension questions based on the provided passage.",
                bankPath: "english/theory/comprehension",
                files: ["comprehension1.json", "comprehension2.json"],
              },
              {
                name: "Summary",
                type: "summary",
                questionCount: 1,
                totalMarks: 10,
                instructions: "Write a summary (150-200 words) of the given passage.",
                bankPath: "english/theory/summary",
              },
            ],
            theoryMarkingConfig: {
              enabled: true,
              aiProvider: "gemini",
              sections: {
                essay: {
                  enabled: true,
                  totalMarks: 30,
                  categories: {
                    Content: 12,
                    Organization: 8,
                    Expression: 7,
                    MechanicalAccuracy: 3,
                  },
                  essayTypes: ["letter", "article", "debate", "story"],
                },
                comprehension: {
                  enabled: true,
                  totalMarks: 20,
                },
                summary: {
                  enabled: true,
                  totalMarks: 10,
                },
              },
              cacheResults: true,
              allowAdminOverride: true,
            },
          },
          {
            partName: "Oral",
            partType: "Oral",
            duration: 15,
            totalQuestions: 3,
            totalMarks: 15,
            instructions: "Record your response to 3 oral questions. Speak clearly and concisely (1-2 minutes per question).",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 3,
                totalMarks: 15,
                instructions: "Listen to each question and record your response.",
                bankPath: "english/oral",
                files: ["oral1.json", "oral2.json", "oral3.json"],
              },
            ],
          },
        ],
        randomizeQuestions: true,
        autoSubmit: true,
        antiCheat: {
          enabled: true,
          fullscreen: true,
          tabSwitchDetection: true,
          copyPasteDisabled: true,
          inspectDisabled: true,
          maxWarnings: 3,
          exitAction: "auto-submit",
        },
        markingScheme: {
          autoMark: true,
          aiTheoryMarking: true,
          markingGuide: "Objective: 0.5 marks per correct answer. Theory: AI-marked using rubric. Oral: Manual marking.",
        },
        retakeRules: {
          allowRetake: true,
          maxAttempts: 2,
          retakeDelay: 7,
        },
      },
      {
        name: "Physics Assessment",
        description: "Comprehensive Physics assessment with Objective, Theory, and Practical components",
        subject: "Physics",
        type: "global",
        duration: 180,
        totalMarks: 100,
        status: "published",
        price: 5000,
        subscription: "monthly",
        parts: [
          {
            partName: "Objective",
            partType: "Objective",
            duration: 45,
            totalQuestions: 40,
            totalMarks: 30,
            instructions: "Answer all 40 objective questions. Select the best option (A, B, C, or D).",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 20,
                totalMarks: 15,
                bankPath: "physics/objective",
                files: ["section1.json"],
              },
              {
                name: "Section B",
                type: "standard",
                questionCount: 20,
                totalMarks: 15,
                bankPath: "physics/objective",
                files: ["section2.json"],
              },
            ],
          },
          {
            partName: "Theory",
            partType: "Theory",
            duration: 90,
            totalQuestions: 5,
            totalMarks: 50,
            instructions: "Answer all theory questions. Show all working.",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 3,
                totalMarks: 30,
                instructions: "Answer all questions in this section.",
                bankPath: "physics/theory",
                files: ["theory_sectionA.json"],
              },
              {
                name: "Section B",
                type: "standard",
                questionCount: 2,
                totalMarks: 20,
                instructions: "Answer all questions in this section.",
                bankPath: "physics/theory",
                files: ["theory_sectionB.json"],
              },
            ],
            theoryMarkingConfig: {
              enabled: true,
              aiProvider: "gemini",
              sections: {
                generic: {
                  enabled: true,
                  totalMarks: 50,
                },
              },
              cacheResults: true,
              allowAdminOverride: true,
            },
          },
          {
            partName: "Practical",
            partType: "Practical",
            duration: 45,
            totalQuestions: 3,
            totalMarks: 20,
            instructions: "Complete all practical experiments. Record observations and calculations.",
            sections: [
              {
                name: "Experiments",
                type: "standard",
                questionCount: 3,
                totalMarks: 20,
                instructions: "Complete the practical experiments as directed.",
                bankPath: "physics/practical",
                files: ["practical1.json", "practical2.json", "practical3.json"],
              },
            ],
          },
        ],
        randomizeQuestions: true,
        autoSubmit: true,
        antiCheat: {
          enabled: true,
          fullscreen: true,
          tabSwitchDetection: true,
        },
        markingScheme: {
          autoMark: true,
          aiTheoryMarking: true,
          markingGuide: "Objective: 0.75 marks per correct answer. Theory: AI-marked with working validation. Practical: Manual marking.",
        },
        retakeRules: {
          allowRetake: true,
          maxAttempts: 2,
          retakeDelay: 7,
        },
      },
      {
        name: "Chemistry Assessment",
        description: "Comprehensive Chemistry assessment with Objective, Theory, and Practical components",
        subject: "Chemistry",
        type: "global",
        duration: 180,
        totalMarks: 100,
        status: "published",
        price: 5000,
        subscription: "monthly",
        parts: [
          {
            partName: "Objective",
            partType: "Objective",
            duration: 45,
            totalQuestions: 40,
            totalMarks: 30,
            instructions: "Answer all 40 objective questions. Select the best option (A, B, C, or D).",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 20,
                totalMarks: 15,
                bankPath: "chemistry/objective",
                files: ["section1.json"],
              },
              {
                name: "Section B",
                type: "standard",
                questionCount: 20,
                totalMarks: 15,
                bankPath: "chemistry/objective",
                files: ["section2.json"],
              },
            ],
          },
          {
            partName: "Theory",
            partType: "Theory",
            duration: 90,
            totalQuestions: 5,
            totalMarks: 50,
            instructions: "Answer all theory questions. Show all working and equations.",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 3,
                totalMarks: 30,
                bankPath: "chemistry/theory",
                files: ["theory_sectionA.json"],
              },
              {
                name: "Section B",
                type: "standard",
                questionCount: 2,
                totalMarks: 20,
                bankPath: "chemistry/theory",
                files: ["theory_sectionB.json"],
              },
            ],
            theoryMarkingConfig: {
              enabled: true,
              aiProvider: "gemini",
              sections: {
                generic: {
                  enabled: true,
                  totalMarks: 50,
                },
              },
              cacheResults: true,
              allowAdminOverride: true,
            },
          },
          {
            partName: "Practical",
            partType: "Practical",
            duration: 45,
            totalQuestions: 3,
            totalMarks: 20,
            instructions: "Complete all practical experiments. Record observations, calculations, and conclusions.",
            sections: [
              {
                name: "Experiments",
                type: "standard",
                questionCount: 3,
                totalMarks: 20,
                bankPath: "chemistry/practical",
                files: ["practical1.json", "practical2.json", "practical3.json"],
              },
            ],
          },
        ],
        randomizeQuestions: true,
        autoSubmit: true,
        antiCheat: {
          enabled: true,
          fullscreen: true,
          tabSwitchDetection: true,
        },
        markingScheme: {
          autoMark: true,
          aiTheoryMarking: true,
          markingGuide: "Objective: 0.75 marks per correct answer. Theory: AI-marked with equation validation. Practical: Manual marking.",
        },
        retakeRules: {
          allowRetake: true,
          maxAttempts: 2,
          retakeDelay: 7,
        },
      },
      {
        name: "Mathematics Assessment",
        description: "Comprehensive Mathematics assessment with Objective and Theory components",
        subject: "Mathematics",
        type: "global",
        duration: 120,
        totalMarks: 100,
        status: "published",
        price: 5000,
        subscription: "monthly",
        parts: [
          {
            partName: "Objective",
            partType: "Objective",
            duration: 45,
            totalQuestions: 50,
            totalMarks: 30,
            instructions: "Answer all 50 objective questions. Select the best option (A, B, C, or D).",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 50,
                totalMarks: 30,
                bankPath: "mathematics/objective",
                files: ["section1.json", "section2.json"],
              },
            ],
          },
          {
            partName: "Theory",
            partType: "Theory",
            duration: 75,
            totalQuestions: 6,
            totalMarks: 70,
            instructions: "Answer all theory questions. Show all working. All questions are compulsory.",
            sections: [
              {
                name: "Section A",
                type: "standard",
                questionCount: 3,
                totalMarks: 35,
                instructions: "Answer all questions in this section.",
                bankPath: "mathematics/theory",
                files: ["theory_sectionA.json"],
              },
              {
                name: "Section B",
                type: "standard",
                questionCount: 3,
                totalMarks: 35,
                instructions: "Answer all questions in this section.",
                bankPath: "mathematics/theory",
                files: ["theory_sectionB.json"],
              },
            ],
            theoryMarkingConfig: {
              enabled: true,
              aiProvider: "gemini",
              sections: {
                generic: {
                  enabled: true,
                  totalMarks: 70,
                },
              },
              cacheResults: true,
              allowAdminOverride: true,
            },
          },
        ],
        randomizeQuestions: true,
        autoSubmit: true,
        antiCheat: {
          enabled: true,
          fullscreen: true,
          tabSwitchDetection: true,
        },
        markingScheme: {
          autoMark: true,
          aiTheoryMarking: true,
          markingGuide: "Objective: 0.6 marks per correct answer. Theory: AI-marked with step validation and working marks.",
        },
        retakeRules: {
          allowRetake: true,
          maxAttempts: 2,
          retakeDelay: 7,
        },
      },
    ];

    // Upsert assessments with normalized subject and part names
    for (const assessmentData of assessments) {
      const normalizedSubject = String(assessmentData.subject || "").toLowerCase();

      // Normalize partName values to lowercase for consistency
      const normalizedParts = (assessmentData.parts || []).map((p) => ({
        ...p,
        partName: p.partName ? String(p.partName).toLowerCase() : p.partName,
      }));

      const query = {
        subject: normalizedSubject,
        name: assessmentData.name,
      };

      const update = {
        ...assessmentData,
        subject: normalizedSubject,
        parts: normalizedParts,
      };

      // Check existence and update/create accordingly (some model wrappers may not expose findOneAndUpdate)
      const existingAssessment = await Assessment.findOne(query);
      if (existingAssessment) {
        Object.assign(existingAssessment, update);
        await existingAssessment.save();
        console.log(`✓ Updated ${normalizedSubject} assessment`);
      } else {
        const newAssessment = await Assessment.create(update);
        if (newAssessment) {
          console.log(`✓ Created ${normalizedSubject} assessment`);
        }
      }
    }

    console.log("\n✅ Oral assessments seeded successfully!");
    console.log(`
    Created/Updated:
    1. English Assessment (Objective + Theory + Oral)
    2. Physics Assessment (Objective + Theory + Practical)
    3. Chemistry Assessment (Objective + Theory + Practical)
    4. Mathematics Assessment (Objective + Theory)
    
    Students can now:
    - Enroll in individual subject assessments
    - Choose which part to attempt (Objective/Theory/Oral/Practical)
    - For English Theory: choose essay type, comprehension, or summary
    - Complete assessments with AI marking support
    `);
  } catch (err) {
    console.error("❌ Error seeding assessments:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("✓ MongoDB connection closed");
  }
}

// Run if executed directly
if (require.main === module) {
  seedOralAssessments();
}

module.exports = seedOralAssessments;
