const mongoose = require("mongoose");

// Answer Schema - for storing student answers
const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.Mixed, required: true },
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ["multiple-choice", "true-false", "short-answer", "essay", "objective"],
  },

  // For standard assessments
  partName: String,
  sectionName: String,
  questionIndex: Number,

  studentAnswer: { type: mongoose.Schema.Types.Mixed },
  correctAnswer: { type: mongoose.Schema.Types.Mixed },
  // Optional rubric supplied or used for AI marking (per-category weights)
  rubric: mongoose.Schema.Types.Mixed,

  marks: { type: Number, default: 0 },
  totalMarks: { type: Number, required: true },
  isCorrect: { type: Boolean, default: false },

  // Feedback
  explanation: String,
  aiMarked: { type: Boolean, default: false },
  aiFeedback: String,
  aiReport: mongoose.Schema.Types.Mixed,
  adminReview: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewedAt: Date,

  answeredAt: { type: Date, default: Date.now },
  reviewedTime: Number, // seconds spent on this question
});

// Assessment Attempt Schema - unified for all assessment types
const assessmentAttemptSchema = new mongoose.Schema(
  {
    // Assessment Type and Reference
    assessmentType: {
      type: String,
      enum: ["standard", "section", "periodic"],
      required: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "assessmentTypeRef",
      required: true,
    },
    assessmentTypeRef: {
      type: String,
      enum: ["StandardAssessment", "SectionQuiz", "PeriodicQuiz"],
      required: true,
    },

    // Student Information
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courses",
    },

    // Attempt Status
    status: {
      type: String,
      enum: [
        "in-progress",
        "submitted",
        "marked",
        "pending-review",
        "completed",
      ],
      default: "in-progress",
    },

    // Answers
    answers: [answerSchema],

    // Question metadata stored with the attempt so result views can display prompts
    questions: [mongoose.Schema.Types.Mixed],

    // Scoring
    totalMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    grade: String, // A+, A, B+, B, etc.

    // For Standard Assessments - Part-wise scoring
    partAttempts: [
      {
        partName: String,
        totalMarks: Number,
        obtainedMarks: Number,
        percentage: Number,
        status: { type: String, enum: ["pending", "submitted", "marked"] },
        submittedAt: Date,
      },
    ],
    selectedPart: String, // For standard assessments

    // Timing
    duration: { type: Number, required: true }, // in minutes
    timeTaken: { type: Number, default: 0 }, // in seconds
    timeLeft: { type: Number, default: 0 }, // in seconds
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    markedAt: Date,

    // Progress Tracking
    currentQuestionIndex: { type: Number, default: 0 },
    lastAutoSave: { type: Date },
    autoSaveCount: { type: Number, default: 0 },

    // AI Marking Summary
    aiReport: mongoose.Schema.Types.Mixed,

    // Anti-Cheat
    antiCheatLog: [
      {
        event: String, // "tab-switch", "copy-paste", "inspect-opened", etc.
        timestamp: { type: Date, default: Date.now },
        severity: { type: String, enum: ["warning", "critical"] },
      },
    ],
    warnings: { type: Number, default: 0 },
    tabSwitches: { type: Number, default: 0 },
    sessionToken: String,
    ipAddress: String,
    userAgent: String,

    // Proctoring Data
    proctorNotes: String,
    flaggedForReview: { type: Boolean, default: false },
    suspiciousActivity: { type: Boolean, default: false },

    // Metadata
    attemptNumber: { type: Number, default: 1 },
    isRetake: { type: Boolean, default: false },
    device: {
      type: String,
      enum: ["desktop", "tablet", "mobile"],
    },
    browser: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // Oral/audio-specific metadata
    fullAudio: { type: String },
    oralType: { type: String },
    oralYear: { type: String },
    audioCurrentTime: { type: Number, default: 0 },
    lastAudioSync: { type: Date },
  },
  { timestamps: true }
);

// Pre-save middleware to calculate stats (synchronous - return instead of using next)
assessmentAttemptSchema.pre("save", function () {
  try {
    if (this.answers && this.answers.length > 0) {
      // Calculate obtained marks
      this.obtainedMarks = this.answers.reduce(
        (sum, answer) => sum + (answer.marks || 0),
        0
      );

      // Calculate percentage
      if (this.totalMarks > 0) {
        this.percentage = (this.obtainedMarks / this.totalMarks) * 100;
      }

      // Calculate time taken if submitted
      if (this.submittedAt && this.startedAt) {
        this.timeTaken = Math.round(
          (this.submittedAt - this.startedAt) / 1000
        );
      }
    }
  } catch (err) {
    console.error("AssessmentAttempt pre-save error:", err);
  }
  return;
});

// Method to calculate grade based on percentage
assessmentAttemptSchema.methods.calculateGrade = function () {
  if (this.percentage >= 90) this.grade = "A+";
  else if (this.percentage >= 80) this.grade = "A";
  else if (this.percentage >= 70) this.grade = "B+";
  else if (this.percentage >= 60) this.grade = "B";
  else if (this.percentage >= 50) this.grade = "C";
  else this.grade = "F";

  return this.grade;
};

// Method to check if attempt passed
assessmentAttemptSchema.methods.checkPassed = function (passMark) {
  this.passed = this.obtainedMarks >= passMark;
  return this.passed;
};

// Index for frequently queried fields
assessmentAttemptSchema.index({ studentId: 1, assessmentId: 1 });
assessmentAttemptSchema.index({ courseId: 1, studentId: 1 });
assessmentAttemptSchema.index({ status: 1 });
assessmentAttemptSchema.index({ createdAt: -1 });
assessmentAttemptSchema.index({ flaggedForReview: 1 });

const AssessmentAttempt = mongoose.model(
  "AssessmentAttempt",
  assessmentAttemptSchema
);

module.exports = AssessmentAttempt;

// Post-save hook to log persisted question order for debugging
assessmentAttemptSchema.post('save', function(doc) {
  try {
    const order = (doc.questions || []).map(q => String(q.questionId || q.id || q._id || q.text));
    console.error('[DEBUG AssessmentAttempt post-save] attemptId=', String(doc._id), 'savedOrder=', order);
  } catch (e) {
    console.error('[DEBUG AssessmentAttempt post-save] error logging', e);
  }
});
