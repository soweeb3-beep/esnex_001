const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    transactionId: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Modem Pay", "Card", "Bank Transfer", "Manual", "Wallet", "Other"],
      default: "Modem Pay",
    },
    paymentAmount: {
      type: Number,
      default: 0,
    },
    paymentCurrency: {
      type: String,
      default: "GMD",
    },
    paymentDate: {
      type: Date,
    },
    paymentError: {
      type: String,
      default: "",
    },
    refundReference: {
      type: String,
      default: "",
    },
    deviceInfo: {
      ipAddress: { type: String, default: "" },
      browser: { type: String, default: "" },
      platform: { type: String, default: "" },
    },
    accessType: {
      type: String,
      enum: ["full", "assessment"],
      default: "full",
    },
    validUntil: {
      type: Date,
    },
    progress: {
      completedLessons: [
        {
          sectionIndex: {
            type: Number,
            required: true,
          },
          lessonIndex: {
            type: Number,
            required: true,
          },
          completedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      percentage: {
        type: Number,
        default: 0,
      },
    },
    certificateIssuedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
enrollmentSchema.index({ student: 1 });
enrollmentSchema.index({ course: 1 });
enrollmentSchema.index({ student: 1, course: 1 }); // Compound index for common queries

module.exports = mongoose.model("Enrollment", enrollmentSchema);