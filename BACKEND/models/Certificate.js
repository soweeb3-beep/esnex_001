const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentEmail: {
      type: String,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    issuedByName: {
      type: String,
      default: "ESNEX Admin",
    },
    issuedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Valid", "Revoked", "Expired"],
      default: "Valid",
    },
    template: {
      type: String,
      default: "Premium Corporate",
    },
    verificationData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

certificateSchema.index({ certificateId: 1 }, { unique: true });
certificateSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
