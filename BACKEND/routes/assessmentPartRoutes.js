const express = require("express");
const router = express.Router({ mergeParams: true });
const {
  getAssessmentParts,
  updateAssessmentPart,
  createAssessmentPart,
  deleteAssessmentPart,
  addSectionToPart,
  updateSectionInPart,
  deleteSectionFromPart,
} = require("../controllers/assessmentPartController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Part management routes (admin only)
router.get("/", protect, adminOnly, getAssessmentParts);
router.post("/", protect, adminOnly, createAssessmentPart);
router.put("/:partIndex", protect, adminOnly, updateAssessmentPart);
router.delete("/:partIndex", protect, adminOnly, deleteAssessmentPart);

// Section management routes (admin only)
router.post("/:partIndex/sections", protect, adminOnly, addSectionToPart);
router.put("/:partIndex/sections/:sectionIndex", protect, adminOnly, updateSectionInPart);
router.delete("/:partIndex/sections/:sectionIndex", protect, adminOnly, deleteSectionFromPart);

module.exports = router;
