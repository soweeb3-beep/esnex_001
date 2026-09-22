const mongoose = require("mongoose");

// Question Schema for Section Quiz
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ["multiple-choice", "true-false", "short-answer", "essay"],
    required: true,
  },
  options: [String], // For multiple-choice
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true }, // String, Array, or Boolean
  marks: { type: Number, required: true },
  explanation: { type: String, default: "" },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  createdAt: { type: Date, default: Date.now },
});

// Section Quiz Schema
const sectionQuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },

    // Course Association
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courses",
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section", // Link to course section/module
      required: true,
    },

    // Quiz Content
    questions: [questionSchema],
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },

    // Duration
    duration: { type: Number, default: null }, // in minutes, null = no time limit

    // Quiz Settings
    settings: {
      randomizeQuestions: { type: Boolean, default: true },
      randomizeOptions: { type: Boolean, default: true },
      allowMultipleAttempts: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 3 },
      showResultsImmediately: { type: Boolean, default: true },
      showAnswers: { type: Boolean, default: true },
      showAnswersAfterSubmit: { type: Boolean, default: true },
      immediateCorrection: { type: Boolean, default: true },
      questionsPerPage: { type: Number, default: 1 },
      allowReview: { type: Boolean, default: true },
      progressTracking: { type: Boolean, default: true },
    },

    // Access Control
    isActive: { type: Boolean, default: true },
    requiredToPass: { type: Boolean, default: false }, // Must pass to access next section
    unlocksNextSection: { type: Boolean, default: false }, // Pass this to unlock next
    nextSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
    },

    // Availability
    availabilityDate: { type: Date },
    dueDate: { type: Date },
    releaseDate: { type: Date },

    // Analytics
    totalAttempts: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },

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

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save middleware to calculate totals
sectionQuizSchema.pre("save", function (next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce(
      (sum, q) => sum + (q.marks || 0),
      0
    );

    // Set passing marks if not set (typically 50%)
    if (!this.passingMarks) {
      this.passingMarks = Math.ceil(this.totalMarks * 0.5);
    }
  }
  next();
});

// Index for frequently queried fields
sectionQuizSchema.index({ courseId: 1, sectionId: 1 });
sectionQuizSchema.index({ isActive: 1 });
sectionQuizSchema.index({ createdAt: -1 });

const SectionQuiz = mongoose.model("SectionQuiz", sectionQuizSchema);

module.exports = SectionQuiz;
