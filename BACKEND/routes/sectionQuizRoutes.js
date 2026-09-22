const express = require("express");
const router = express.Router();
const sectionQuizController = require("../controllers/sectionQuizController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { checkCourseAccess } = require("../middleware/accessMiddleware");

// ===== ADMIN ROUTES =====

router.post(
  "/admin/section-quizzes/create",
  protect,
  adminOnly,
  sectionQuizController.createSectionQuiz
);

router.get(
  "/admin/section-quizzes",
  protect,
  adminOnly,
  sectionQuizController.getAllSectionQuizzes
);

router.get(
  "/admin/section-quizzes/:id",
  protect,
  adminOnly,
  sectionQuizController.getSectionQuizById
);

router.put(
  "/admin/section-quizzes/:id",
  protect,
  adminOnly,
  sectionQuizController.updateSectionQuiz
);

router.delete(
  "/admin/section-quizzes/:id",
  protect,
  adminOnly,
  sectionQuizController.deleteSectionQuiz
);

// ===== STUDENT ROUTES =====

// Get quiz for course section
router.get(
  "/courses/:courseId/sections/:sectionId/quiz",
  protect,
  checkCourseAccess,
  sectionQuizController.getSectionQuizForStudent
);

// Start quiz attempt
router.post(
  "/quizzes/section/start",
  protect,
  checkCourseAccess,
  sectionQuizController.startSectionQuizAttempt
);

// Submit answer
router.post(
  "/quizzes/section/:attemptId/answer",
  protect,
  sectionQuizController.submitSectionQuizAnswer
);

// Submit quiz
router.post(
  "/quizzes/section/:attemptId/submit",
  protect,
  sectionQuizController.submitSectionQuiz
);

// Get results
router.get(
  "/quizzes/section/:attemptId/results",
  protect,
  sectionQuizController.getSectionQuizResults
);

// Get student attempts
router.get(
  "/quizzes/section/:quizId/attempts",
  protect,
  sectionQuizController.getStudentSectionQuizAttempts
);

module.exports = router;
