const mongoose = require("mongoose");

// Question Schema for Periodic Quiz
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ["multiple-choice", "true-false", "short-answer", "essay"],
    required: true,
  },
  options: [String], // For multiple-choice
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
  marks: { type: Number, required: true },
  explanation: { type: String, default: "" },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  createdAt: { type: Date, default: Date.now },
});

// Recurrence Pattern
const recurrenceSchema = new mongoose.Schema({
  pattern: {
    type: String,
    enum: ["once", "daily", "weekly", "biweekly", "monthly", "custom"],
    default: "once",
  },
  daysOfWeek: [Number], // 0=Sunday, 1=Monday, etc. for weekly
  dayOfMonth: Number, // 1-31 for monthly
  monthlyPattern: String, // e.g., "first-monday", "last-friday"
  customDays: [Number], // specific days for custom pattern
  endRecurrenceDate: Date, // when to stop repeating
});

// Periodic Quiz Schema
const periodicQuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    quizType: {
      type: String,
      enum: ["midterm", "monthly", "mock", "weekly", "other"],
      required: true,
    },

    // Course Association
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courses",
      required: true,
    },

    // Quiz Content
    questions: [questionSchema],
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },

    // Duration
    duration: { type: Number, required: true }, // in minutes

    // Schedule
    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      openTime: String, // e.g., "09:00" (24-hour format)
      closeTime: String, // e.g., "17:00"
      timezone: { type: String, default: "UTC" },
      recurrence: recurrenceSchema,
    },

    // Quiz Settings
    settings: {
      randomizeQuestions: { type: Boolean, default: true },
      randomizeOptions: { type: Boolean, default: true },
      allowMultipleAttempts: { type: Boolean, default: false },
      maxAttempts: { type: Number, default: 1 },
      showResultsImmediately: { type: Boolean, default: true },
      showAnswers: { type: Boolean, default: true },
      showAnswersAfter: {
        type: String,
        enum: ["never", "after-submit", "after-deadline"],
        default: "after-deadline",
      },
      immediateCorrection: { type: Boolean, default: true },
      questionsPerPage: { type: Number, default: 1 },
      allowReview: { type: Boolean, default: false },
      progressTracking: { type: Boolean, default: true },
      preventBackButton: { type: Boolean, default: false },
    },

    // Access Control
    isActive: { type: Boolean, default: true },
    onlyEnrolledStudents: { type: Boolean, default: true },
    mandatoryParticipation: { type: Boolean, default: false },
    countTowardsFinalGrade: { type: Boolean, default: false },
    weightage: { type: Number, default: 0 }, // percentage contribution to final grade

    // Availability
    announcementDate: Date, // when quiz is announced to students
    reviewStartDate: Date,
    reviewEndDate: Date,

    // Analytics
    totalAttempts: { type: Number, default: 0 },
    uniqueParticipants: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },

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
    notes: String, // Internal notes for instructors

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save middleware
periodicQuizSchema.pre("save", function (next) {
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
periodicQuizSchema.index({ courseId: 1, isActive: 1 });
periodicQuizSchema.index({ "schedule.startDate": 1, "schedule.endDate": 1 });
periodicQuizSchema.index({ createdAt: -1 });

// Get active quizzes for a date
periodicQuizSchema.statics.getActiveForDate = function (courseId, date) {
  return this.find({
    courseId: courseId,
    isActive: true,
    "schedule.startDate": { $lte: date },
    "schedule.endDate": { $gte: date },
  });
};

const PeriodicQuiz = mongoose.model("PeriodicQuiz", periodicQuizSchema);

module.exports = PeriodicQuiz;
