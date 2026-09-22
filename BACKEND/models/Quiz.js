const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  part: {
    type: String,
    enum: ["A", "B", "C", "D", "E", "F"],
    required: true,
    default: "A",
  },
  section: String, // a, b, c, etc. for Part A grouping

  type: {
    type: String,
    enum: ["mcq", "theory", "math", "objective"],
    required: true,
  },

  question: { type: String, required: true },

  // MCQ
  options: [String],
  correctAnswer: mongoose.Schema.Types.Mixed,

  // THEORY
  sampleAnswer: String,
  useAI: { type: Boolean, default: false },
  markingFormat: String,

  // MATH
  correctFormat: String,
});

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    
    // Course and section association
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Courses", required: true },
    courseSectionId: { type: String }, // Course section _id as string or object
    
    // Quiz type and settings
    quizType: { type: String, enum: ["section", "course"], default: "section" },
    quizCategory: { type: String, enum: ["quiz", "mock-test", "monthly-exam"], default: "quiz" },
    instructions: { type: String, default: "" },
    duration: { type: Number, required: true }, // in minutes
    totalMarks: { type: Number, required: true },
    passingScore: { type: Number, required: true },
    
    // Questions
    questions: [questionSchema],
    
    // Question behavior
    randomizeQuestions: { type: Boolean, default: true },
    autoSubmit: { type: Boolean, default: true },
    
    // Status and visibility
    status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
    visibility: { type: Boolean, default: true },
    availabilityDate: { type: Date },
    closingDate: { type: Date },
    
    // Attempt rules
    retakeRules: {
      allowRetake: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 3 },
      retakeDelay: { type: Number, default: 0 },
    },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes for efficient querying
quizSchema.index({ courseId: 1 });
quizSchema.index({ courseSectionId: 1 });
quizSchema.index({ courseId: 1, courseSectionId: 1 });
quizSchema.index({ status: 1, visibility: 1 });

module.exports = mongoose.model("Quiz", quizSchema);