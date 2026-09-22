const express = require("express");
const router = express.Router();

const {
  enrollCourse,
  getMyCourses,
  getCourseProgress,
  getUserAccessFlags,
  updateLessonProgress,
} = require("../controllers/enrollmentController");

const { protect } = require("../middleware/authMiddleware");

// student must be logged in
router.post("/enroll", protect, enrollCourse);
router.get("/my-courses", protect, getMyCourses);
router.get("/access-flags", protect, getUserAccessFlags);
router.get("/progress/:courseId", protect, getCourseProgress);
router.put("/progress/:courseId", protect, updateLessonProgress);

module.exports = router;    