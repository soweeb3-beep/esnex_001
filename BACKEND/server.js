const express = require("express");
// touched to trigger nodemon reload
// reload marker
const cors = require("cors");
const compression = require("compression");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

console.log('🚀 [SERVER STARTUP] PAYSTACK_SECRET_KEY:', process.env.PAYSTACK_SECRET_KEY?.substring(0, 12) + '...');
console.log('🚀 [SERVER STARTUP] PAYSTACK_PUBLIC_KEY:', process.env.PAYSTACK_PUBLIC_KEY?.substring(0, 12) + '...');
console.log('🚀 [SERVER STARTUP] MODEM_PAY_API_KEY:', process.env.MODEM_PAY_API_KEY?.substring(0, 12) + '...');
console.log('🚀 [SERVER STARTUP] WAVE_API_KEY:', process.env.WAVE_API_KEY?.substring(0, 12) + '...');
console.log('🚀 [SERVER STARTUP] Starts with test_:', String(process.env.WAVE_API_KEY).startsWith('test_'));

const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const { getModel } = require("./config/adapter");

// Routes
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const sectionRoutes = require("./routes/sectionRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const quizRoutes = require("./routes/quizRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const assessmentPartRoutes = require("./routes/assessmentPartRoutes");
const roleRoutes = require("./routes/roleRoutes");
const questionRoutes = require("./routes/questionRoutes");
const homepageRoutes = require("./routes/homepageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const periodicQuizRoutes = require("./routes/periodicQuizRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const messageRoutes = require("./routes/messageRoutes");
const standardAssessmentRoutes = require("./routes/standardAssessmentRoutes");

const printRouterPaths = (router, label) => {
  try {
    const paths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const methods = Object.keys(layer.route.methods).join(",");
        return `${methods} ${layer.route.path}`;
      });
    console.log(`ROUTES [${label}]:`, paths);
  } catch (err) {
    console.error(`Unable to print router paths for ${label}:`, err.message);
  }
};
// New Assessment Routes (Temporarily disabled to avoid model conflicts)
// const standardAssessmentRoutes = require("./routes/standardAssessmentRoutes");
// const sectionQuizRoutes = require("./routes/sectionQuizRoutes");
// const periodicQuizRoutes = require("./routes/periodicQuizRoutes");
const { initializeDefaultRoles } = require("./controllers/roleController");
const { protect } = require("./middleware/authMiddleware");
const {
  enrollCourse,
  getMyCourses,
  getCourseProgress,
  updateLessonProgress,
  handlePayment,
} = require("./controllers/enrollmentController");

const app = express();

app.use(cors());
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const logLine = `${new Date().toISOString()} REQUEST: ${req.method} ${req.url}\n`;
  try {
    fs.appendFileSync(path.join(__dirname, 'request-debug.log'), logLine, 'utf8');
  } catch (err) {
    console.error('Request debug log failed', err.message);
  }
  console.log(logLine.trim());
  if (req.url.includes('/api/assessments') && req.method === 'POST') {
    console.log('Assessment POST request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

app.use("/api/sections", sectionRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/messages", messageRoutes);
printRouterPaths(messageRoutes, 'messageRoutes');
// Mount standardAssessmentRoutes BEFORE assessmentRoutes to prevent generic /:assessmentId/start pattern from catching /assessments/standard/start
app.use("/api", standardAssessmentRoutes);
printRouterPaths(standardAssessmentRoutes, 'standardAssessmentRoutes');
app.use("/api/assessments", assessmentRoutes);
printRouterPaths(assessmentRoutes, 'assessmentRoutes');
app.use("/api/assessments/:assessmentId/parts", assessmentPartRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/homepage", homepageRoutes);
app.use("/api/payments", paymentRoutes);
// Mount Routes
app.use("/api/auth", authRoutes);
printRouterPaths(authRoutes, 'authRoutes');
app.use("/api/courses", courseRoutes);
app.use("/api/certificates", certificateRoutes);
printRouterPaths(certificateRoutes, 'certificateRoutes');

// Test message route directly
app.get("/test-message-route", (req, res) => {
  res.json({ message: "Test route works" });
});

// Temporary local route for debugging the preview loader without auth
app.get('/local-preview-start', (req, res) => {
  try {
    return require('./controllers/assessmentController').previewStartBySubject(req, res);
  } catch (e) {
    console.error('local-preview-start route error', e);
    return res.status(500).json({ message: 'local preview error', error: e && e.message });
  }
});

// Temporary debug route to inspect raw course document (enabled when DEBUG_RAW_ROUTE=1)
app.get('/debug/raw-course/:id', async (req, res) => {
  if (String(process.env.DEBUG_RAW_ROUTE) !== '1') return res.status(403).json({ message: 'Debug route disabled' });
  try {
    const Course = getModel('Course');
    const doc = await Course.findById(req.params.id).lean?.() ?? await Course.findById(req.params.id);
    return res.json({ doc });
  } catch (err) {
    console.error('debug raw-course error', err);
    return res.status(500).json({ message: 'Error fetching raw course', error: err.message });
  }
});

// New Assessment Routes (Temporarily disabled to avoid model conflicts)
// app.use("/api/assessments", standardAssessmentRoutes);
// app.use("/api/quizzes", sectionQuizRoutes);
// Register LAST to avoid catching other routes
app.use("/api", periodicQuizRoutes);

app.post("/api/enroll", protect, enrollCourse);
app.post("/api/payment", protect, handlePayment);
app.get("/api/user/courses", protect, getMyCourses);
app.post("/api/progress", protect, updateLessonProgress);
app.get("/api/progress/:courseId", protect, getCourseProgress);

app.use((req, res, next) => {
  console.log("DEBUG final middleware", req.method, req.url);
  res.status(404).json({ message: "Route not found", path: req.url });
});

const PORT = process.env.PORT || 5000;

async function createDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@esnex.com").toLowerCase();
  const adminName = process.env.ADMIN_NAME || "ESNEX Admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin1234";
  const UserModel = getModel("User");
  const RoleModel = getModel("Role");

  const adminRole = await RoleModel.findOne({ key: "admin" });
  if (!adminRole) {
    console.warn("Admin role not found while creating default admin");
    return;
  }

  const existingAdmin = await UserModel.findOne({ roleString: "admin" });
  if (existingAdmin) {
    return;
  }

  const existingUser = await UserModel.findOne({ email: adminEmail });
  if (existingUser) {
    if (existingUser.roleString !== "admin" || existingUser.role?.toString() !== adminRole._id.toString()) {
      existingUser.role = adminRole._id;
      existingUser.roleString = "admin";
      if (typeof existingUser.save === "function") {
        await existingUser.save();
      } else if (typeof UserModel.findByIdAndUpdate === "function") {
        await UserModel.findByIdAndUpdate(existingUser._id, { role: adminRole._id, roleString: "admin" });
      }
    }
    console.log(`Updated existing user to admin: ${adminEmail}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await UserModel.create({
    name: adminName,
    email: adminEmail,
    password: hashedPassword,
    role: adminRole._id,
    roleString: "admin",
  });
  console.log(`Default admin created: ${adminEmail}`);
}

connectDB()
  .then(async () => {
    await initializeDefaultRoles();
    await createDefaultAdmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Server failed to start:", err);
  });
