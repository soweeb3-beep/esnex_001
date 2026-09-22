const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    productType: {
      type: String,
      enum: ["course", "assessment"],
      required: true,
    },
    productTypeRef: {
      type: String,
      enum: ["Course", "Assessment"],
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "productTypeRef",
    },
    productName: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: "GMD",
    },
    paymentMethod: {
      type: String,
      enum: ["Modem Pay", "Card", "Bank Transfer", "Cash", "Admin Granted", "Manual", "Wallet", "Other"],
      default: "Card",
    },
    paymentSource: {
      type: String,
      enum: ["Modem Pay", "Bank Transfer", "Cash", "Admin Granted"],
      default: "Modem Pay",
    },
    transactionId: {
      type: String,
      trim: true,
      default: "",
      sparse: true,
      index: true,
    },
    gatewayReference: {
      type: String,
      trim: true,
      default: "",
      sparse: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      trim: true,
      default: "",
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    verificationStatus: {
      type: String,
      enum: ["unverified", "verified", "rejected"],
      default: "unverified",
    },
    verifiedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    provider: {
      type: String,
      trim: true,
      default: "Modem Pay",
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    allowRepurchase: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    approvalReason: {
      type: String,
      trim: true,
      default: "",
    },
    auditLogs: [
      {
        event: { type: String, trim: true, default: "" },
        details: { type: String, trim: true, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

paymentSchema.index({ studentId: 1, productType: 1, productId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $ne: "" } } });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ gatewayReference: 1 }, { unique: true, sparse: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ studentId: 1 });
paymentSchema.index({ productType: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
