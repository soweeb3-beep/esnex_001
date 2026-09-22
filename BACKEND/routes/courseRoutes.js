const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  addSection,
} = require("../controllers/courseController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { checkCourseAccess } = require("../middleware/accessMiddleware");

const uploadDir = path.join(__dirname, "..", "uploads", "resources");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname) || "";
    const sanitizedName = file.fieldname.replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${sanitizedName}-${Date.now()}${fileExt}`);
  },
});

const upload = multer({ storage });

// Admin only routes (must come before public routes to avoid conflicts)
router.post("/", protect, adminOnly, upload.any(), createCourse);
router.post("/:courseId/sections", protect, adminOnly, addSection);
router.put("/:id", protect, adminOnly, updateCourse);
router.delete("/:id", protect, adminOnly, deleteCourse);

// Public routes (must come last)
router.get("/", getAllCourses);

// Protected full course content (lessons/resources) - only for enrolled/paid users
// Must come before /:id route to avoid being shadowed by the generic route
router.get("/:id/content", protect, checkCourseAccess, (req, res) => {
  console.log('[ROUTE HANDLER] Course content route handler called for course:', req.params.id);
  const { getCourseContent } = require("../controllers/courseController");
  getCourseContent(req, res);
});

router.get("/:id", getCourseById);

module.exports = router;
