const express = require("express");
const router = express.Router();
const periodicQuizController = require("../controllers/periodicQuizController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { checkCourseAccess } = require("../middleware/accessMiddleware");

// ===== ADMIN ROUTES =====

router.post(
  "/admin/periodic-quizzes/create",
  protect,
  adminOnly,
  periodicQuizController.createPeriodicQuiz
);

router.get(
  "/admin/periodic-quizzes",
  protect,
  adminOnly,
  periodicQuizController.getAllPeriodicQuizzes
);

router.get(
  "/admin/periodic-quizzes/:id",
  protect,
  adminOnly,
  periodicQuizController.getPeriodicQuizById
);

router.put(
  "/admin/periodic-quizzes/:id",
  protect,
  adminOnly,
  periodicQuizController.updatePeriodicQuiz
);

router.delete(
  "/admin/periodic-quizzes/:id",
  protect,
  adminOnly,
  periodicQuizController.deletePeriodicQuiz
);

router.get(
  "/admin/courses/:courseId/periodic-quizzes",
  protect,
  adminOnly,
  periodicQuizController.getCoursePeriodicQuizzes
);

// ===== STUDENT ROUTES =====

// Get periodic quizzes for course
router.get(
  "/courses/:courseId/periodic-quizzes",
  protect,
  checkCourseAccess,
  periodicQuizController.getStudentCourseQuizzes
);

// Get quiz details
router.get(
  "/courses/:courseId/periodic-quizzes/:quizId",
  protect,
  checkCourseAccess,
  periodicQuizController.getPeriodicQuizDetails
);

// Start quiz attempt
router.post(
  "/quizzes/periodic/start",
  protect,
  checkCourseAccess,
  periodicQuizController.startPeriodicQuizAttempt
);

// Submit answer
router.post(
  "/quizzes/periodic/:attemptId/answer",
  protect,
  periodicQuizController.submitPeriodicQuizAnswer
);

// Submit quiz
router.post(
  "/quizzes/periodic/:attemptId/submit",
  protect,
  periodicQuizController.submitPeriodicQuiz
);

// Get results
router.get(
  "/quizzes/periodic/:attemptId/results",
  protect,
  periodicQuizController.getPeriodicQuizResults
);

// Get student attempts
router.get(
  "/courses/:courseId/periodic-quizzes/:quizId/attempts",
  protect,
  periodicQuizController.getStudentPeriodicQuizAttempts
);

module.exports = router;
