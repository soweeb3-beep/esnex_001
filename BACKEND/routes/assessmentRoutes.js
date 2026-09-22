const express = require("express");
const router = express.Router();
const {
  createAssessment,
  updateAssessment,
  getAssessments,
  getPublicGlobalAssessments,
  getAssessmentById,
  getAssessmentTemplate,
  startAssessment,
  getAssessmentBySubject,
  getEssayQuestions,
  getAvailableOralTypes,
  startAssessmentBySubject,
  startCourseSectionByCourseSection,
  startOralAssessment,
  updateAttemptTimeLeft,
  getAttemptResume,
  autoSaveAnswer,
  submitAssessment,
  enrollInAssessment,
  getEnrolledAssessments,
  deleteAssessment,
  recordTabSwitch,
  getAttempt,
  getAttempts,
  createQuestion,
  getQuestions,
  getQuestionsByPath,
  updateQuestion,
  deleteQuestion,
  importQuestionsFromBank,
  // New assessment flow controllers
  getAssessmentWithParts,
  getAvailableEssayTypes,
  getEssayTypeQuestions,
  startAssessmentPart,
  // AI marking
  aiMarkAttempt,
} = require("../controllers/assessmentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { checkCourseAccess, checkAssessmentAccess } = require("../middleware/accessMiddleware");

// Admin routes: Create, update, delete assessments
router.post("/", protect, adminOnly, createAssessment);
router.post("/template", protect, adminOnly, getAssessmentTemplate);
router.put("/:id", protect, adminOnly, updateAssessment);
router.delete("/:id", protect, adminOnly, deleteAssessment);

// Public routes: Get assessment metadata by subject (for landing page)
// IMPORTANT: essay route must come before the generic /global/subject/:subject route
router.get("/global/subject/:subject/essay/:type/questions", protect, getEssayQuestions);
// NEW ASSESSMENT FLOW ROUTES
router.get("/global/subject/:subject/essay-types", protect, getAvailableEssayTypes);
router.get("/global/subject/:subject/essay-types/:essayType/questions", protect, getEssayTypeQuestions);
router.get("/global/subject/:subject/oral-types", protect, getAvailableOralTypes);
router.get("/global/subject/:subject/with-parts", protect, getAssessmentWithParts);
router.post("/global/assessment/start-part", protect, checkAssessmentAccess, startAssessmentPart);
// Debug: clear in-progress attempts (admin only)
router.post('/debug/clear-inprogress', protect, adminOnly, (req, res) => require('../controllers/assessmentController').clearInProgressAttempts(req, res));
// Debug: allow student to clear their own in-progress attempt for testing
router.post('/debug/clear-my-inprogress', protect, (req, res) => require('../controllers/assessmentController').clearMyInProgress(req, res));
// Debug: preview loader order without creating attempt
router.get('/debug/preview-start', (req, res) => require('../controllers/assessmentController').previewStartBySubject(req, res));
// Dynamic question loader by path: subject, part, section, subsection
router.get('/questions/load', protect, getQuestionsByPath);
// Old routes for backward compatibility
router.get("/global/subject/:subject", getAssessmentBySubject);
router.get("/global", getPublicGlobalAssessments);

// Student routes: Get assessments and start attempt (require auth)
router.get("/", protect, getAssessments);
router.get("/global/:id", protect, getAssessmentById);
router.get("/course-section/:id", protect, getAssessmentById);
router.post("/:assessmentId/start", protect, checkAssessmentAccess, startAssessment);
router.post("/global/start/:assessmentId", protect, checkAssessmentAccess, startAssessment);
router.post("/course-section/start/:assessmentId", protect, checkAssessmentAccess, startAssessment);
router.post("/course-section/start/:courseId/:sectionId", protect, checkCourseAccess, startCourseSectionByCourseSection);
router.post("/global/subject/:subject/start", protect, checkAssessmentAccess, startAssessmentBySubject);

// Attempt routes: Oral lifecycle, save answers, submit, record security events
router.post("/:assessmentId/oral/start", protect, checkAssessmentAccess, startOralAssessment);
router.patch("/:attemptId/timeleft", protect, updateAttemptTimeLeft);
router.get("/:attemptId/resume", protect, getAttemptResume);
router.post("/:attemptId/answer", protect, autoSaveAnswer);
router.post("/:attemptId/submit", protect, submitAssessment);
router.post("/submit/:attemptId", protect, submitAssessment);
router.post("/:attemptId/tab-switch", protect, recordTabSwitch);
// List attempts (admin)
router.get('/attempts', protect, adminOnly, getAttempts);
router.get("/attempt/:attemptId", protect, getAttempt);
// AI Marking endpoint (run AI marking on an attempt)
router.post("/:attemptId/ai-mark", protect, aiMarkAttempt);

// Enrollment routes: Enroll in global assessments
router.post("/:assessmentId/enroll", protect, enrollInAssessment);
router.get("/enrolled", protect, getEnrolledAssessments);

// Student dashboard progress must be registered before the generic /:id route
router.get("/student/progress", protect, async (req, res) => {
  try {
    const AssessmentAttemptModel = require("../config/adapter").getModel("AssessmentAttempt");
    const AssessmentModel = require("../config/adapter").getModel("Assessment");
    const AssessmentEnrollmentModel = require("../config/adapter").getModel("AssessmentEnrollment");
    const studentId = req.user?.id || req.user?._id;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    const enrollments = await AssessmentEnrollmentModel.find({ studentId }).lean();
    const now = new Date();

    for (const enrollment of enrollments) {
      const status = enrollment.subscriptionStatus || enrollment.status || "active";
      const expiryDateValue = enrollment.expiryDate || enrollment.validUntil;
      const isExpired = ["expired", "cancelled"].includes(status) || (expiryDateValue && now > new Date(expiryDateValue));

      if (!isExpired) continue;

      await AssessmentEnrollmentModel.findByIdAndUpdate(enrollment._id, {
        accessGranted: false,
        subscriptionStatus: "expired",
        status: "expired",
      }).catch((err) => console.error("Failed to expire assessment enrollment", err));

      await AssessmentAttemptModel.deleteMany({
        studentId,
        assessmentId: enrollment.assessmentId,
      }).catch((err) => console.error("Failed to clear expired assessment attempts", err));
    }

    const activeAssessmentIds = enrollments
      .filter((enrollment) => {
        const status = enrollment.subscriptionStatus || enrollment.status || "active";
        const expiryDateValue = enrollment.expiryDate || enrollment.validUntil;
        const isExpired = ["expired", "cancelled"].includes(status) || (expiryDateValue && now > new Date(expiryDateValue));
        return !isExpired && Boolean(enrollment.accessGranted !== false);
      })
      .map((enrollment) => String(enrollment.assessmentId))
      .filter(Boolean);

    const attempts = activeAssessmentIds.length
      ? await AssessmentAttemptModel.find({ studentId, assessmentId: { $in: activeAssessmentIds } }).sort({ updatedAt: -1 }).lean()
      : [];

    const assessmentIds = [...new Set(attempts.map((attempt) => String(attempt.assessmentId)).filter(Boolean))];
    const assessments = assessmentIds.length
      ? await AssessmentModel.find({ _id: { $in: assessmentIds } }).lean()
      : [];
    const assessmentMap = Object.fromEntries(
      assessments.map((assessment) => [String(assessment._id), assessment])
    );

    const inProgress = attempts.filter((attempt) => attempt.status === "in-progress");
    const submitted = attempts.filter((attempt) => ["submitted", "pending-review", "marked", "completed"].includes(attempt.status));

    const progress = attempts.map((attempt) => {
      const assessment = assessmentMap[String(attempt.assessmentId)] || null;
      return {
        _id: attempt._id,
        assessmentId: attempt.assessmentId,
        assessmentName: assessment?.name || assessment?.title || "Assessment",
        subject: assessment?.subject || null,
        status: attempt.status,
        percentage: Number(attempt.percentage || 0),
        obtainedMarks: Number(attempt.obtainedMarks || 0),
        totalMarks: Number(attempt.totalMarks || 0),
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        updatedAt: attempt.updatedAt,
        timeLeft: Number(attempt.timeLeft || 0),
        selectedPart: attempt.selectedPart || null,
      };
    });

    const assessmentSummaries = Object.values(
      attempts.reduce((groups, attempt) => {
        const key = String(attempt.assessmentId);
        if (!key) return groups;

        const assessment = assessmentMap[key] || {};
        const rawPercentage = Number(
          attempt.percentage ?? (
            attempt.totalMarks
              ? (Number(attempt.obtainedMarks || 0) / Number(attempt.totalMarks)) * 100
              : 0
          )
        );

        if (!groups[key]) {
          groups[key] = {
            assessmentId: key,
            assessmentName: assessment.name || assessment.title || "Assessment",
            attemptCount: 0,
            totalScore: 0,
          };
        }

        groups[key].attemptCount += 1;
        groups[key].totalScore += Number.isFinite(rawPercentage) ? rawPercentage : 0;
        return groups;
      }, {})
    )
      .map((summary) => ({
        assessmentId: summary.assessmentId,
        assessmentName: summary.assessmentName,
        attemptCount: summary.attemptCount,
        averageScore: Number((summary.totalScore / summary.attemptCount).toFixed(1)),
      }))
      .sort((a, b) => b.attemptCount - a.attemptCount || a.assessmentName.localeCompare(b.assessmentName));

    res.json({
      success: true,
      summary: {
        totalAttempts: attempts.length,
        inProgressCount: inProgress.length,
        completedCount: submitted.length,
        averageScore: attempts.length
          ? Number((attempts.reduce((sum, attempt) => sum + Number(attempt.percentage || 0), 0) / attempts.length).toFixed(2))
          : 0,
      },
      progress,
      assessmentSummaries,
    });
  } catch (error) {
    console.error("Student progress error", error);
    res.status(500).json({ message: "Unable to fetch student progress", error: error?.message || "Unknown error" });
  }
});

// Generic GET route (MUST come after specific routes like /global/subject/:subject)
router.get("/:id", protect, getAssessmentById);

// Question management routes (Admin only)
router.post("/questions", protect, adminOnly, createQuestion);
router.get("/questions", protect, adminOnly, getQuestions);
router.put("/questions/:id", protect, adminOnly, updateQuestion);
router.delete("/questions/:id", protect, adminOnly, deleteQuestion);
router.post("/questions/import", protect, adminOnly, importQuestionsFromBank);

module.exports = router;
