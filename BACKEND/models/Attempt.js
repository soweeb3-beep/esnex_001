const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
    },

    selectedPart: {
      type: String,
      enum: ["A", "B", "C", "D", "E", "F"],
      default: "A",
    },

    objectiveCompleted: {
      type: Boolean,
      default: false,
    },
    theoryCompleted: {
      type: Boolean,
      default: false,
    },
    oralCompleted: {
      type: Boolean,
      default: false,
    },

    answers: [mongoose.Schema.Types.Mixed],

    score: Number,
    total: Number,

    startedAt: Date,
    submittedAt: Date,

    status: {
      type: String,
      enum: ["in-progress", "submitted", "timeout"],
      default: "in-progress",
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
attemptSchema.index({ student: 1 });
attemptSchema.index({ quiz: 1 });
attemptSchema.index({ status: 1 });

module.exports = mongoose.model("Attempt", attemptSchema);
