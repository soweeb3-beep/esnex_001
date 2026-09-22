const mongoose = require("mongoose");

// Standard Assessment Enrollment Schema
// Controls access and payment status for WAEC/WASSCE assessments
const standardAssessmentEnrollmentSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Payment & Access
    status: {
      type: String,
      enum: ["pending", "active", "expired", "completed", "cancelled"],
      default: "pending",
    },
    accessGranted: { type: Boolean, default: false },

    // Payment Details
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "refunded"],
      default: "unpaid",
    },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    paymentDate: Date,
    paymentMethod: String,

    // Enrollment Details
    enrolledDate: { type: Date, default: Date.now },
    activationDate: Date,
    expiryDate: Date,
    autoRenewal: { type: Boolean, default: false },

    // Attempt Tracking
    attempts: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      lastAttemptDate: Date,
      nextRetakeEligibleDate: Date,
    },

    // Performance
    bestScore: {
      marks: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      grade: String,
      attemptDate: Date,
      attemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AssessmentAttempt",
      },
    },

    lastAttemptScore: {
      marks: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      grade: String,
      attemptDate: Date,
      attemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AssessmentAttempt",
      },
    },

    // Certificate
    certificateEarned: { type: Boolean, default: false },
    certificateUrl: String,
    certificateIssuedDate: Date,
    certificateId: String,

    // Notes
    notes: String,
    adminNotes: String,

    // Metadata
    source: {
      type: String,
      enum: ["direct-purchase", "subscription", "promotion", "admin-grant"],
      default: "direct-purchase",
    },
    referralSource: String,
    promotionCode: String,
    isFreeTrial: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save middleware
standardAssessmentEnrollmentSchema.pre("save", async function () {
  try {
    // Calculate remaining attempts
    if (this.attempts.total > 0) {
      this.attempts.remaining =
        this.attempts.total - this.attempts.used;
    }

    // Grant access only when the linked payment is verified
    if (this.paymentStatus === "paid" && !this.accessGranted) {
      if (this.paymentId) {
        try {
          const Payment = mongoose.models.Payment || mongoose.model("Payment");
          const payment = await Payment.findById(this.paymentId).lean();
          if (payment && payment.status === "completed" && payment.verificationStatus === "verified") {
            this.accessGranted = true;
            this.activationDate = this.activationDate || new Date();
            this.status = "active";
          } else {
            this.accessGranted = false;
            if (this.status === "active") {
              this.status = "pending";
            }
          }
        } catch (paymentCheckError) {
          console.error("StandardAssessmentEnrollment payment check error:", paymentCheckError);
          this.accessGranted = false;
        }
      } else {
        this.accessGranted = false;
      }
    }

    // Check expiry
    if (this.expiryDate && new Date() > this.expiryDate) {
      this.status = "expired";
      this.accessGranted = false;
    }
  } catch (err) {
    console.error("StandardAssessmentEnrollment pre-save error:", err);
  }
});

// Method to check if student can attempt
standardAssessmentEnrollmentSchema.methods.canAttempt = function () {
  const now = new Date();

  // Check if access is granted
  if (!this.accessGranted) {
    return { allowed: false, reason: "Access not granted" };
  }

  // Check if expired
  if (this.expiryDate && now > this.expiryDate) {
    return { allowed: false, reason: "Enrollment expired" };
  }

  // Check remaining attempts
  if (this.attempts.remaining <= 0) {
    return { allowed: false, reason: "No attempts remaining" };
  }

  // Check retake delay
  if (
    this.attempts.lastAttemptDate &&
    this.nextRetakeEligibleDate &&
    now < this.nextRetakeEligibleDate
  ) {
    const waitTime = Math.ceil(
      (this.nextRetakeEligibleDate - now) / (1000 * 60 * 60 * 24)
    );
    return {
      allowed: false,
      reason: `You can retake in ${waitTime} days`,
    };
  }

  return { allowed: true };
};

// Method to record attempt
standardAssessmentEnrollmentSchema.methods.recordAttempt = function (
  retakeDelay = 0
) {
  this.attempts.used++;
  this.attempts.remaining = this.attempts.total - this.attempts.used;
  this.attempts.lastAttemptDate = new Date();

  if (retakeDelay > 0) {
    const nextEligible = new Date();
    nextEligible.setDate(nextEligible.getDate() + retakeDelay);
    this.nextRetakeEligibleDate = nextEligible;
  }

  return this;
};

// Index for frequently queried fields
standardAssessmentEnrollmentSchema.index({
  assessmentId: 1,
  studentId: 1,
});
standardAssessmentEnrollmentSchema.index({
  studentId: 1,
  status: 1,
});
standardAssessmentEnrollmentSchema.index({
  paymentStatus: 1,
  accessGranted: 1,
});
standardAssessmentEnrollmentSchema.index({ createdAt: -1 });

const StandardAssessmentEnrollment = mongoose.model(
  "StandardAssessmentEnrollment",
  standardAssessmentEnrollmentSchema
);

module.exports = StandardAssessmentEnrollment;
