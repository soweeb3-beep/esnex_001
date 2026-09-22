const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getUnreadMessages,
  getMessages,
  getMessageById,
  sendMessage,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  sendNotification,
  getMessageStats,
} = require("../controllers/messageController");

// Add debug logging
router.use((req, res, next) => {
  console.log("🎯 Message route hit:", req.method, req.path);
  next();
});

// Public routes
router.get("/unread-count", protect, getUnreadMessages);
router.get("/", protect, getMessages);
router.get("/:messageId", protect, getMessageById);
router.post("/", protect, sendMessage);
router.patch("/:messageId/mark-read", protect, markAsRead);
router.patch("/mark-all-read", protect, markAllAsRead);
router.delete("/:messageId", protect, deleteMessage);

// Admin routes
router.post("/admin/send-notification", protect, adminOnly, sendNotification);
router.get("/admin/stats", protect, adminOnly, getMessageStats);

module.exports = router;
