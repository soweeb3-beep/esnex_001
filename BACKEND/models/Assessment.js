const mongoose = require("mongoose");
const AssessmentAttempt = require("./AssessmentAttempt");

// Question Marking Configuration Schema - For storing AI marking rules per question
const questionMarkingConfigSchema = new mongoose.Schema({
  questionId: { type: String, required: true }, // ID from question file
  totalMarks: { type: Number, required: true }, // Total marks for this question
  requiredMarks: { type: Number, default: 0 }, // Minimum marks to pass
  minimumWordCount: { type: Number, default: 0 },
  modelAnswer: { type: String, default: "" }, // Fixed model answer (if available)
  aiMarking: { type: Boolean, default: true }, // Use AI for marking
  rubric: mongoose.Schema.Types.Mixed, // Rubric/marking guide
  categories: mongoose.Schema.Types.Mixed, // For essays: { Content: 20, Organization: 10, ... }
  markingCriteria: { type: String, default: "" },
  expectedPoints: [{ type: String }], // Key points to look for
});

// Theory Marking Configuration - For Theory parts with AI support
const theoryMarkingConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  aiProvider: { type: String, enum: ["gemini", "openai"], default: "gemini" },
  
  // For subjects like English: Essay, Comprehension, Summary
  sections: {
    // Essay specific
    essay: {
      enabled: { type: Boolean, default: false },
      totalMarks: { type: Number, default: 50 },
      categories: {
        Content: { type: Number, default: 20 },
        Organization: { type: Number, default: 10 },
        Expression: { type: Number, default: 10 },
        MechanicalAccuracy: { type: Number, default: 10 },
      },
      essayTypes: [{ type: String }], // letter, article, debate, story
      questionConfig: [questionMarkingConfigSchema],
    },
    // Comprehension specific
    comprehension: {
      enabled: { type: Boolean, default: false },
      totalMarks: { type: Number, default: 30 },
      questionConfig: [questionMarkingConfigSchema],
    },
    // Summary specific
    summary: {
      enabled: { type: Boolean, default: false },
      totalMarks: { type: Number, default: 20 },
      questionConfig: [questionMarkingConfigSchema],
    },
    // Generic theory section
    generic: {
      enabled: { type: Boolean, default: false },
      totalMarks: { type: Number, default: 40 },
      questionConfig: [questionMarkingConfigSchema],
    },
  },
  
  // Caching and reuse
  cacheResults: { type: Boolean, default: true },
  allowAdminOverride: { type: Boolean, default: true },
});

// Section Schema: Represents one section within a part (e.g., "Section A", "Section B")
const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Section A, B, C, etc.
  type: { type: String, default: "standard" }, // standard, essay, comprehension, summary
  essayType: { type: String }, // For essay sections: letter, article, debate, story
  questionCount: { type: Number, required: true }, // Number of questions in this section
  totalMarks: { type: Number }, // Total marks for this section
  instructions: { type: String, default: "" }, // Section-level instruction
  bankPath: { type: String, default: "" }, // Path to question bank
  files: [{ type: String }],
  questionsPerPage: { type: Number, default: 1 },
});

// Part Schema: Represents a part (Part A, B, C with type Objective/Theory/Practical/Oral)
const partSchema = new mongoose.Schema({
  partName: { type: String, required: true }, // "Part A", "Part B", "Part C"
  partType: { type: String, enum: ["Objective", "Theory", "Practical", "Oral"], required: true },
  duration: { type: Number, required: true }, // duration in minutes
  totalQuestions: { type: Number, required: true }, // total questions for this part
  totalMarks: { type: Number }, // Total marks for this part
  instructions: { type: String, default: "" }, // part-level instructions
  sections: [sectionSchema],
  randomizeQuestions: { type: Boolean, default: true },
  markingEnabled: { type: Boolean, default: true },
  
  // For Theory parts - AI marking configuration
  theoryMarkingConfig: theoryMarkingConfigSchema,
});

// Assessment Schema: Flexible, admin-controlled assessment
const assessmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["global", "course"], required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },
    subject: { type: String, required: true },
    price: { type: Number, default: 0 },
    subscription: { type: String, default: "monthly" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
    duration: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    totalQuestions: { type: Number, default: 0 },
    parts: [partSchema],
    allowedParts: [{ type: String }],
    availabilityDate: { type: Date },
    closingDate: { type: Date },
    randomizeQuestions: { type: Boolean, default: true },
    autoSubmit: { type: Boolean, default: true },
    antiCheat: {
      enabled: { type: Boolean, default: false },
      fullscreen: { type: Boolean, default: true },
      tabSwitchDetection: { type: Boolean, default: true },
      copyPasteDisabled: { type: Boolean, default: true },
      inspectDisabled: { type: Boolean, default: true },
      maxWarnings: { type: Number, default: 3 },
      exitAction: { type: String, enum: ["auto-submit", "allow", "warning"], default: "auto-submit" },
    },
    markingScheme: {
      autoMark: { type: Boolean, default: true },
      aiTheoryMarking: { type: Boolean, default: true },
      markingGuide: { type: String, default: "" },
      answerFormat: { type: String, default: "" },
    },
    retakeRules: {
      allowRetake: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 3 },
      retakeDelay: { type: Number, default: 0 },
    },
    visibility: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Pre-save middleware to validate and update assessment totals
assessmentSchema.pre('save', function(next) {
  try {
    if (this.parts && this.parts.length > 0) {
      // Generate allowedParts from part names
      this.allowedParts = this.parts.map((part) => part.partName);
      
      // Calculate total questions from all parts
      this.totalQuestions = this.parts.reduce((sum, part) => sum + (part.totalQuestions || 0), 0);
    }
  } catch (err) {
    console.error('Assessment pre-save error:', err);
  }
  if (typeof next === 'function') {
    next();
  }
});

// Assessment Enrollment Schema: Controls access to global assessments
const enrollmentSchema = new mongoose.Schema(
  {
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    enrolledDate: { type: Date, default: Date.now },
    accessGranted: { type: Boolean, default: true },
    attempts: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    bestPercentage: { type: Number, default: 0 },

    // Subscription & Payment Tracking
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentReference: { type: String, trim: true, default: "" },
    transactionId: { type: String, trim: true, default: "" },
    paymentMethod: {
      type: String,
      enum: ["Modem Pay", "Card", "Bank Transfer", "Manual", "Wallet", "Other"],
      default: "Modem Pay",
    },
    paymentAmount: { type: Number, default: 0 },
    paymentCurrency: { type: String, default: "GMD" },
    paymentDate: { type: Date },
    paidAt: { type: Date },
    expiresAt: { type: Date },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    paymentError: { type: String, default: "" },
    refundReference: { type: String, default: "" },
    deviceInfo: {
      ipAddress: { type: String, default: "" },
      browser: { type: String, default: "" },
      platform: { type: String, default: "" },
    },
    accessType: { type: String, enum: ["full", "assessment"], default: "assessment" },
    validUntil: { type: Date },
    subscriptionType: { type: String, enum: ["free", "monthly", "quarterly", "yearly", "lifetime"], default: "free" },
    expiryDate: { type: Date },
    subscriptionStatus: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true }
);

assessmentSchema.index({ type: 1, subject: 1 });
assessmentSchema.index({ courseId: 1 });
enrollmentSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });

module.exports = {
  Assessment: mongoose.model("Assessment", assessmentSchema),
  AssessmentAttempt: AssessmentAttempt,
  AssessmentEnrollment: mongoose.model("AssessmentEnrollment", enrollmentSchema),
};
