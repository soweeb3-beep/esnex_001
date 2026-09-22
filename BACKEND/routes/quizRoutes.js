const express = require("express");
const router = express.Router();

const {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  startQuiz,
  submitQuiz,
  getMyResults,
  getAttemptDetails,
  getAnalytics,
  createCourseSectionQuiz,
  getCourseSectionQuizzes,
  startCourseSectionQuiz,
  importQuizQuestions,
} = require("../controllers/quizController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { checkCourseAccess, checkAssessmentAccess } = require("../middleware/accessMiddleware");

/* ================= ADMIN ================= */
router.post("/", protect, adminOnly, createQuiz);
router.put("/:quizId", protect, adminOnly, updateQuiz);

/* ================= NAMED ROUTES (must come before :quizId) ================= */
router.get("/results", protect, getMyResults);
router.get("/attempt/:id", protect, getAttemptDetails);
router.get("/analytics", protect, adminOnly, getAnalytics);

/* ================= STUDENT ================= */
router.get("/", protect, getAllQuizzes);
router.get("/:quizId", protect, getQuizById);
router.post("/start/:quizId", protect, checkAssessmentAccess, startQuiz);
router.post("/submit/:attemptId", protect, submitQuiz);

/* ================= COURSE SECTION QUIZZES ================= */
router.post("/course-section", protect, adminOnly, createCourseSectionQuiz);
router.get("/course-section/:courseId", protect, getCourseSectionQuizzes);
router.get("/course-section/:courseId/:sectionId", protect, getCourseSectionQuizzes);
router.post("/course-section/start/:quizId", protect, checkCourseAccess, startCourseSectionQuiz);
router.post("/import-questions", protect, adminOnly, importQuizQuestions);

module.exports = router;