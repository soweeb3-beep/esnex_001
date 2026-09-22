const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      default: "Notification",
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["notification", "message", "alert", "announcement"],
      default: "notification",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    attachments: [
      {
        filename: String,
        url: String,
        type: String,
      },
    ],
    tags: [String],
    category: {
      type: String,
      enum: ["academic", "payment", "enrollment", "system", "support", "other"],
      default: "system",
    },
  },
  { timestamps: true }
);

// Index for faster queries
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1 });

module.exports = mongoose.model("Message", messageSchema);
