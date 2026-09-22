const express = require("express");
const router = express.Router();

const {
  createQuestion,
  getAllQuestions,
  updateQuestion,
  deleteQuestion,
} = require("../controllers/questionController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

/* ================= ADMIN ================= */
router.post("/", protect, adminOnly, createQuestion);
router.get("/", protect, adminOnly, getAllQuestions);
router.put("/:id", protect, adminOnly, updateQuestion);
router.delete("/:id", protect, adminOnly, deleteQuestion);

module.exports = router;