const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getHomepage, updateHomepage } = require("../controllers/homepageController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads", "homepage");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname) || "";
    const sanitizedField = file.fieldname.replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${sanitizedField}-${Date.now()}${fileExt}`);
  },
});

const upload = multer({ storage });

router.get("/", getHomepage);
router.put("/", protect, adminOnly, upload.any(), updateHomepage);

module.exports = router;
