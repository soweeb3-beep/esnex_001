const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentStatus,
  handleWaveWebhook,
  getAdminPaymentSummary,
  getAdminRevenueChart,
  getPaymentReconciliation,
  getAdminPayments,
  getPaymentDetails,
  exportPayments,
} = require("../controllers/paymentController");

/**
 * POST /api/payments/initiate
 * Initiate a payment for a course enrollment
 */
router.post("/initiate", protect, initiatePayment);

/**
 * POST /api/payments/verify
 * Verify a payment and complete enrollment
 */
router.post("/verify", protect, verifyPayment);

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get("/history", protect, getPaymentHistory);

/**
 * GET /api/payments/admin/summary
 * Get admin payment dashboard summary
 */
router.get("/admin/summary", protect, adminOnly, getAdminPaymentSummary);
router.get("/admin/revenue-chart", protect, adminOnly, getAdminRevenueChart);
router.get("/admin/reconciliation", protect, adminOnly, getPaymentReconciliation);

/**
 * GET /api/payments/admin/list
 * Get admin payment list with filters
 */
router.get("/admin/list", protect, adminOnly, getAdminPayments);

/**
 * GET /api/payments/admin/:paymentId
 * Get admin payment details for a single payment
 */
router.get("/admin/:paymentId", protect, adminOnly, getPaymentDetails);
router.get("/admin/:paymentId/details", protect, adminOnly, getPaymentDetails);

/**
 * GET /api/payments/admin/export
 * Export payment records
 */
router.get("/admin/export", protect, adminOnly, exportPayments);

/**
 * GET /api/payments/status/:enrollmentId
 * Get payment status for a specific enrollment
 */
router.get("/status/:enrollmentId", protect, getPaymentStatus);

/**
 * POST /api/payments/webhook
 * Handle Wave webhook events
 */
router.post("/webhook", handleWaveWebhook);

module.exports = router;
