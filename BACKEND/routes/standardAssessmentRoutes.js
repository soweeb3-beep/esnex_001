const express = require("express");
const router = express.Router();
const standardAssessmentController = require("../controllers/standardAssessmentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// DEBUG ROUTE - Remove before production
router.get("/debug/test-mock", async (req, res) => {
  try {
    const { getModel } = require("../config/adapter");
    const StandardAssessment = getModel("StandardAssessment");
    const assessment = await StandardAssessment.findById("tz7hco9ae");
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADMIN ROUTES =====

router.post(
  "/admin/standard-assessments/create",
  protect,
  adminOnly,
  standardAssessmentController.createAssessment
);

router.get(
  "/admin/standard-assessments",
  protect,
  adminOnly,
  standardAssessmentController.getAllAssessments
);

router.get(
  "/admin/standard-assessments/:id",
  protect,
  adminOnly,
  standardAssessmentController.getAssessmentById
);

router.put(
  "/admin/standard-assessments/:id",
  protect,
  adminOnly,
  standardAssessmentController.updateAssessment
);

router.delete(
  "/admin/standard-assessments/:id",
  protect,
  adminOnly,
  standardAssessmentController.deleteAssessment
);

router.put(
  "/admin/standard-assessments/:id/publish",
  protect,
  adminOnly,
  standardAssessmentController.publishAssessment
);

router.put(
  "/admin/standard-assessments/:id/archive",
  protect,
  adminOnly,
  standardAssessmentController.archiveAssessment
);

router.get(
  "/admin/standard-assessments/:id/stats",
  protect,
  adminOnly,
  standardAssessmentController.getAssessmentStats
);

// ===== STUDENT ROUTES =====

// Get all published assessments
router.get(
  "/assessments/standard",
  standardAssessmentController.getPublishedAssessments
);

// Get assessment details
router.get(
  "/assessments/standard/:id",
  standardAssessmentController.getAssessmentDetails
);

// Get enrolled assessments
router.get(
  "/assessments/standard/enrolled",
  protect,
  standardAssessmentController.getEnrolledAssessments
);

// Start assessment (note: enrollment checked directly in controller, no middleware needed for mock DB compatibility)
router.post(
  "/assessments/standard/start",
  protect,
  standardAssessmentController.startAssessment
);

// Submit answer
router.post(
  "/assessments/standard/:id/answer",
  protect,
  standardAssessmentController.submitAnswer
);

// Submit part
router.post(
  "/assessments/standard/:id/submit-part",
  protect,
  standardAssessmentController.submitPart
);

// Get results
router.get(
  "/assessments/standard/:id/results/:attemptId",
  protect,
  standardAssessmentController.getAttemptResults
);

// Get past attempts
router.get(
  "/assessments/standard/:assessmentId/attempts",
  protect,
  standardAssessmentController.getStudentAttempts
);

module.exports = router;
