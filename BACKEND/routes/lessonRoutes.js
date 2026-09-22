const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { addLesson, updateLesson, deleteLesson } = require("../controllers/courseController");

router.post("/:sectionId/lessons", protect, adminOnly, addLesson);
router.put("/:id", protect, adminOnly, updateLesson);
router.delete("/:id", protect, adminOnly, deleteLesson);

module.exports = router;
