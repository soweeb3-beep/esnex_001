const mongoose = require("mongoose");

// Section Schema within a Part
const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Section A", "Section B"
  questionCount: { type: Number, required: true },
  marksPerQuestion: { type: Number, required: true },
  totalMarks: { type: Number, required: true }, // calculated as questionCount * marksPerQuestion
  randomizeQuestions: { type: Boolean, default: true },
  randomizeOptions: { type: Boolean, default: true },
  fileReference: { type: String, required: true }, // e.g., "english/objective/sectionA.json"
  instructions: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Part Schema
const partSchema = new mongoose.Schema({
  partName: { type: String, required: true }, // e.g., "Part A", "Objective"
  partType: {
    type: String,
    enum: ["Objective", "Theory", "Practical", "Oral", "Essay"],
    required: true,
  },
  duration: { type: Number, required: true }, // in minutes
  totalMarks: { type: Number, required: true },
  sections: [sectionSchema],
  instructions: { type: String, default: "" },
  randomizeQuestions: { type: Boolean, default: true },
  markingScheme: {
    autoMark: { type: Boolean, default: true }, // Auto-mark objective only
    aiTheoryMarking: { type: Boolean, default: true },
    markingGuide: { type: String, default: "" },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// StandardAssessment Schema
const standardAssessmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g., "English Language WAEC"
    description: { type: String, default: "" },
    subject: { type: String, required: true }, // e.g., "English", "Physics"
    examBoard: {
      type: String,
      enum: ["WAEC", "WASSCE", "JAMB", "NECO", "Other"],
      default: "WAEC",
    },

    // Pricing and Access
    price: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    subscriptionType: {
      type: String,
      enum: ["one-time", "monthly", "yearly"],
      default: "one-time",
    },

    // Grading
    totalMarks: { type: Number, required: true },
    passmark: { type: Number, required: true },
    certificateAvailable: { type: Boolean, default: true },

    // Assessment Structure
    parts: [partSchema],

    // Course Linking
    linkedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Courses",
      },
    ],

    // Access Control
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    visibility: { type: Boolean, default: true },
    availabilityDate: { type: Date },
    retirementDate: { type: Date },

    // Attempt Control
    retakeRules: {
      allowRetake: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 3 },
      retakeDelay: { type: Number, default: 0 }, // in days
      minScoreForRetake: { type: Number, default: 0 }, // 0 = no minimum
    },

    // Anti-Cheat
    antiCheat: {
      enabled: { type: Boolean, default: false },
      fullscreen: { type: Boolean, default: true },
      tabSwitchDetection: { type: Boolean, default: true },
      copyPasteDisabled: { type: Boolean, default: true },
      inspectDisabled: { type: Boolean, default: true },
      maxWarnings: { type: Number, default: 3 },
      exitAction: {
        type: String,
        enum: ["auto-submit", "allow", "warning"],
        default: "allow",
      },
    },

    // UI/UX Settings
    displaySettings: {
      showQuestionNumbers: { type: Boolean, default: true },
      showTimer: { type: Boolean, default: true },
      shuffleQuestions: { type: Boolean, default: true },
      questionsPerPage: { type: Number, default: 1 },
    },

    // Review Settings
    reviewSettings: {
      showResultsImmediately: { type: Boolean, default: true },
      allowReview: { type: Boolean, default: true },
      showAnswers: { type: Boolean, default: true },
      showMarks: { type: Boolean, default: true },
    },

    // Analytics
    totalAttempts: { type: Number, default: 0 },
    totalEnrollments: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tags: [String],
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save middleware
standardAssessmentSchema.pre("save", function (next) {
  try {
    if (this.parts && this.parts.length > 0) {
      // Calculate total marks from all parts
      this.totalMarks = this.parts.reduce((sum, part) => {
        if (part.sections && part.sections.length > 0) {
          const sectionMarks = part.sections.reduce(
            (sectionSum, section) => sectionSum + (section.totalMarks || 0),
            0
          );
          part.totalMarks = sectionMarks;
        }
        return sum + (part.totalMarks || 0);
      }, 0);
    }
  } catch (err) {
    console.error("StandardAssessment pre-save error:", err);
  }
  next();
});

// Index for frequently queried fields
standardAssessmentSchema.index({ subject: 1, status: 1 });
standardAssessmentSchema.index({ linkedCourses: 1 });
standardAssessmentSchema.index({ createdAt: -1 });

const StandardAssessment = mongoose.model(
  "StandardAssessment",
  standardAssessmentSchema
);

module.exports = StandardAssessment;
