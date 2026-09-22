const { getModel } = require("../config/adapter");
const { isMongoConnected } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@esnex.com";

const canSendEmail = EMAIL_HOST && EMAIL_USER && EMAIL_PASS;

const createTransporter = () => {
  if (!canSendEmail) return null;
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
};

const sendResetPINEmail = async (email, pin) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email credentials are not configured. Skipping email send.");
    return false;
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "ESNEX Password Reset PIN",
    text: `Your ESNEX password reset PIN is ${pin}. It expires in 15 minutes. If you did not request this, please ignore this email.`,
    html: `<p>Your ESNEX password reset PIN is <strong>${pin}</strong>.</p><p>It expires in 15 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

const findByIdFallback = async (Model, id) => {
  if (!Model || !id) return null;

  if (typeof Model.findById !== "function") {
    return null;
  }

  try {
    return await Model.findById(id);
  } catch (err) {
    if (err.name === "CastError" && err.kind === "ObjectId") {
      if (typeof Model.findOne === "function") {
        try {
          return await Model.findOne({ _id: id });
        } catch (innerErr) {
          console.warn("findByIdFallback secondary lookup failed", innerErr.message);
          return null;
        }
      }
    }
    throw err;
  }
};

const generateResetPin = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get models (either Mongoose or mock)
const getUser = () => getModel("User");
const getRole = () => getModel("Role");

// Helper: Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper: Validate password strength
const isStrongPassword = (password) => {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters with uppercase, lowercase, and numbers" 
      });
    }

    const normalizedEmail = email.toLowerCase();

    const User = getUser();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const studentRole = await getRole().findOne({ key: "student" });
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashed,
      role: studentRole ? studentRole._id : null,
      roleString: "student",
    });

    res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
      email: user.email,
      profileImage: user.profileImage || "",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/* =========================
   ADMIN REGISTER
========================= */
const ALLOWED_USER_ROLES = ["student", "lecturer", "admin", "support", "moderator"];

const normalizeRoleKey = (roleKey) => {
  const key = String(roleKey || "").trim().toLowerCase();
  return ALLOWED_USER_ROLES.includes(key) ? key : "student";
};

exports.adminRegister = async (req, res) => {
  try {
    const { name, email, password, adminCode } = req.body;

    if (!name || !email || !password || !adminCode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with uppercase, lowercase, and numbers",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const User = getUser();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const expectedCode = process.env.ADMIN_SIGNUP_CODE;
    if (!expectedCode) {
      return res.status(503).json({ message: "Admin signup is disabled" });
    }
    if (adminCode !== expectedCode) {
      return res.status(401).json({ message: "Invalid admin signup code" });
    }

    const adminRole = await getRole().findOne({ key: "admin" });
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashed,
      role: adminRole ? adminRole._id : null,
      roleString: "admin",
    });

    res.status(201).json({
      message: "Admin user registered successfully",
      userId: user._id,
      email: user.email,
      profileImage: user.profileImage || "",
    });
  } catch (err) {
    console.error("Admin register error:", err);
    res.status(500).json({ message: "Server error during admin registration" });
  }
};

/* =========================
   CREATE USER (ADMIN ONLY)
========================= */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with uppercase, lowercase, and numbers",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const User = getUser();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const roleKey = normalizeRoleKey(role);
    const roleDoc = await getRole().findOne({ key: roleKey });
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashed,
      role: roleDoc ? roleDoc._id : null,
      roleString: roleKey,
    });

    res.status(201).json({
      message: "User created successfully",
      userId: user._id,
      email: user.email,
      role: roleKey,
      profileImage: user.profileImage || "",
    });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Server error during user creation" });
  }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("LOGIN REQUEST BODY:", JSON.stringify(req.body));

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    console.log("LOGIN REQUEST", { email, hasJwtSecret: !!process.env.JWT_SECRET });

    const User = getUser();
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Contact support." });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log("LOGIN PASSWORD MATCH", { match });
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Get role string
    let roleString = user.roleString;
    console.log("LOGIN ROLE CHECK", { email: user.email, roleString, userRole: user.role });
    
    // Special handling for admin user
    if (user.email === "admin@esnex.com") {
      roleString = "admin";
      console.log("LOGIN SET ADMIN ROLE", roleString);
    } else if (!roleString) {
      // If roleString is not set, try to look up the role
      try {
        const roleDoc = await getRole().findById(user.role);
        roleString = roleDoc ? roleDoc.key : "student";
        console.log("LOGIN LOOKED UP ROLE", roleString);
      } catch (err) {
        console.error("Error looking up role:", err);
        roleString = "student";
      }
    }
    
    console.log("LOGIN ROLE DETERMINED", { email: user.email, roleString, userRoleString: user.roleString, userRole: user.role });

    const token = jwt.sign(
      { id: user._id, role: roleString },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      role: user.email === "admin@esnex.com" ? "admin" : roleString,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage || "",
      userId: user._id,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};

/* =========================
   FORGOT PASSWORD
========================= */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const User = getUser();
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ message: "If an account with that email exists, a password reset PIN has been sent." });
    }

    const pin = generateResetPin();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetPasswordPin = pin;
    user.resetPasswordPinExpiry = expiry;
    await user.save();

    let emailSent = false;
    try {
      const info = await sendResetPINEmail(user.email, pin);
      emailSent = !!info;
      if (emailSent) {
        console.log(`Password reset PIN email sent to ${user.email}`);
      }
    } catch (err) {
      console.error("Failed to send password reset email:", err);
    }

    if (!emailSent) {
      console.log(`Password reset PIN for ${email}: ${pin} (expires at ${expiry.toISOString()})`);
    }

    res.status(200).json({
      message: "If an account with that email exists, a password reset PIN has been sent."
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, pin, newPassword } = req.body;

    if (!email || !pin || !newPassword) {
      return res.status(400).json({ message: "Email, PIN, and new password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const User = getUser();
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or PIN" });
    }

    if (!user.resetPasswordPin || user.resetPasswordPin !== pin) {
      return res.status(400).json({ message: "Invalid email or PIN" });
    }

    if (!user.resetPasswordPinExpiry || user.resetPasswordPinExpiry < new Date()) {
      return res.status(400).json({ message: "Reset PIN has expired. Please request a new one." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordPin = "";
    user.resetPasswordPinExpiry = null;
    await user.save();

    res.status(200).json({ message: "Password has been reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const User = getUser();
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error changing password" });
  }
};

/* =========================
   GET CURRENT USER
========================= */
exports.getMe = async (req, res) => {
  try {
    const User = getUser();
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeUser = user.toObject ? user.toObject() : user;

    res.status(200).json({
      user: {
        name: safeUser.name,
        email: safeUser.email,
        role: safeUser.roleString || safeUser.role,
        profileImage: safeUser.profileImage || "",
        createdAt: safeUser.createdAt,
      },
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};

/* =========================
   UPDATE CURRENT USER PROFILE
========================= */
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, password, profileImage } = req.body;
    const User = getUser();

    const existingUser = await User.findById(req.user.id);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeExisting = existingUser.toObject ? existingUser.toObject() : existingUser;

    const updateData = {};
    if (email) {
      if (email.toLowerCase() !== safeExisting.email) {
        const existingEmailUser = await User.findOne({ email: email.toLowerCase() });
        if (existingEmailUser) {
          return res.status(400).json({ message: "Email is already taken" });
        }
      }
      updateData.email = email.toLowerCase();
    }

    if (name) updateData.name = name;
    if (profileImage !== undefined) updateData.profileImage = profileImage;

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData);
    const savedUser = updatedUser || safeExisting;
    const safeUser = savedUser.toObject ? savedUser.toObject() : savedUser;

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        name: safeUser.name,
        email: safeUser.email,
        profileImage: safeUser.profileImage || "",
        role: safeUser.roleString || safeUser.role,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

/* =========================
   GET ALL USERS (ADMIN ONLY)
========================= */
exports.getUsers = async (req, res) => {
  try {
    const User = getUser();
    const Course = getModel("Course");
    const Attempt = getModel("Attempt");

    const usersRaw = await User.find();
    const users = Array.isArray(usersRaw)
      ? usersRaw.map((user) => {
          const safeUser = user.toObject ? user.toObject() : user;
          const roleString = safeUser.roleString || (safeUser.email === "admin@esnex.com" ? "admin" : "student");
          return { ...safeUser, roleString };
        })
      : [];

    if (!isMongoConnected()) {
      const usersWithStats = users.map((user) => ({
        ...user,
        enrolledCourses: 0,
        completedAssessments: 0,
      }));
      return res.status(200).json({ users: usersWithStats });
    }

    const userIds = users.map((user) => user._id);

    const enrollmentCounts = await Course.aggregate([
      { $unwind: "$students" },
      { $match: { students: { $in: userIds } } },
      { $group: { _id: "$students", enrolledCourses: { $sum: 1 } } },
    ]);

    const assessmentCounts = await Attempt.aggregate([
      { $match: { student: { $in: userIds }, status: "submitted" } },
      { $group: { _id: "$student", completedAssessments: { $sum: 1 } } },
    ]);

    const enrollmentMap = enrollmentCounts.reduce((map, item) => {
      map[item._id.toString()] = item.enrolledCourses;
      return map;
    }, {});

    const assessmentMap = assessmentCounts.reduce((map, item) => {
      map[item._id.toString()] = item.completedAssessments;
      return map;
    }, {});

    const usersWithStats = users.map((user) => ({
      ...user,
      enrolledCourses: enrollmentMap[user._id.toString()] || 0,
      completedAssessments: assessmentMap[user._id.toString()] || 0,
    }));

    res.status(200).json({ users: usersWithStats });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error fetching users" });
  }
};

/* =========================
   DELETE USER (ADMIN)
========================= */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ message: "User id is required" });

    const User = getUser();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // prevent deleting system admin accounts
    if ((user.roleString || "").toLowerCase() === "super-admin" || String(user.email).toLowerCase() === "admin@esnex.com") {
      return res.status(403).json({ message: "Cannot delete protected admin user" });
    }

    // remove related enrollments and assessment enrollments
    try {
      const Enrollment = getModel("Enrollment");
      const AssessmentEnrollment = getModel("AssessmentEnrollment");
      if (Enrollment && typeof Enrollment.deleteMany === "function") {
        await Enrollment.deleteMany({ student: userId });
      }
      if (AssessmentEnrollment && typeof AssessmentEnrollment.deleteMany === "function") {
        await AssessmentEnrollment.deleteMany({ studentId: userId });
      }
    } catch (e) {
      console.warn("Failed to remove related enrollments for user", userId, e.message);
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ message: "Server error deleting user" });
  }
};

/* =========================
   ENROLL USER (ADMIN) - add student to course or assessment
   POST /api/auth/users/:id/enroll
   body: { productType: 'course'|'assessment', productId: '<id>', paymentData?: {} }
========================= */
exports.enrollUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { productType, productId } = req.body;
    if (!userId || !productType || !productId) return res.status(400).json({ message: "user id, productType and productId are required" });

    const User = getUser();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!["course", "assessment"].includes(productType)) return res.status(400).json({ message: "productType must be 'course' or 'assessment'" });

    if (productType === "course") {
      const Enrollment = getModel("Enrollment");
      const Course = getModel("Course");
      const course = await Course.findById(productId);
      if (!course) return res.status(404).json({ message: "Course not found" });

      const existing = await Enrollment.findOne({ student: userId, course: productId });
      if (existing) return res.status(200).json({ message: "User already enrolled", enrollment: existing });

      const enrollment = await Enrollment.create({
        student: userId,
        course: productId,
        paymentStatus: "paid",
        paymentAmount: 0,
        paymentCurrency: course.currency || "GMD",
        paymentDate: new Date(),
        accessType: "full",
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // add course to user's enrolledCourses array (if using Mongo model)
      try {
        if (user.enrolledCourses && Array.isArray(user.enrolledCourses)) {
          user.enrolledCourses = Array.from(new Set([...user.enrolledCourses.map(String), String(productId)]));
        } else {
          user.enrolledCourses = [productId];
        }
        await User.findByIdAndUpdate(userId, { enrolledCourses: user.enrolledCourses });
      } catch (e) {
        console.warn("Failed to update user's enrolledCourses", e.message);
      }

      return res.status(201).json({ message: "User enrolled in course", enrollment });
    }

    // assessment
    if (productType === "assessment") {
      let StandardAssessmentEnrollment = getModel("AssessmentEnrollment");
      const Assessment = getModel("Assessment");
      let assessment = null;
      try {
        assessment = await findByIdFallback(Assessment, productId);
      } catch (e) {
        console.warn("findByIdFallback secondary lookup failed", e.message);
      }

      // If not found in Mongo (or CastError because id is a string key), try mock DB files
      let usedMockEnrollment = false;
      let mockDb = null;
      if (!assessment) {
        try {
          mockDb = require("../config/mockDb");
          if (mockDb && typeof mockDb.StandardAssessmentMock?.findById === "function") {
            assessment = await mockDb.StandardAssessmentMock.findById(productId);
          }
          if (!assessment && mockDb && typeof mockDb.AssessmentMock?.find === "function") {
            const maybe = await mockDb.AssessmentMock.find({ _id: productId });
            if (Array.isArray(maybe)) assessment = maybe[0] || null;
            else if (maybe && maybe.length) assessment = maybe[0];
          }
        } catch (mockErr) {
          console.warn("mock assessment lookup failed", mockErr.message);
        }
      }

      // Determine whether to use mock enrollment creation (string IDs)
      if (assessment && typeof assessment._id === "string" && !/^[0-9a-fA-F]{24}$/.test(String(assessment._id))) {
        usedMockEnrollment = true;
        if (!mockDb) {
          try { mockDb = require("../config/mockDb"); } catch (_) { /* ignore */ }
        }
        // if mockDb provides a mock enrollment model, use it
        if (mockDb && mockDb.AssessmentEnrollmentMock) {
          StandardAssessmentEnrollment = mockDb.AssessmentEnrollmentMock;
        }
      }

      if (!assessment) return res.status(404).json({ message: "Assessment not found" });

      const existing = await StandardAssessmentEnrollment.findOne({ assessmentId: productId, studentId: userId });
      if (existing) return res.status(200).json({ message: "User already enrolled", enrollment: existing });

      const now = new Date();
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const attemptsAllowed = assessment.attemptsAllowed || assessment.attempts?.total || 1;
      const enrollmentData = {
        assessmentId: productId,
        studentId: userId,
        status: "active",
        accessGranted: true,
        paymentStatus: "paid",
        amountPaid: 0,
        currency: assessment.currency || "GMD",
        paymentDate: now,
        enrolledDate: now,
        activationDate: now,
        expiryDate: expiry,
        attempts: { total: attemptsAllowed, used: 0, remaining: attemptsAllowed },
        source: "admin-grant",
      };

      let enrollment = null;
      // If using mock enrollment (string ids), the mock create will accept string _id values
      if (typeof StandardAssessmentEnrollment.create === "function" && StandardAssessmentEnrollment.create.length >= 0 && StandardAssessmentEnrollment === require('../config/mockDb').AssessmentEnrollmentMock) {
        enrollment = await StandardAssessmentEnrollment.create(enrollmentData);
      } else if (typeof StandardAssessmentEnrollment.create === "function") {
        // mongoose model - create will attempt to cast assessmentId to ObjectId
        enrollment = await StandardAssessmentEnrollment.create(enrollmentData);
      } else if (typeof StandardAssessmentEnrollment.insert === "function") {
        enrollment = await StandardAssessmentEnrollment.insert(enrollmentData);
      } else {
        // last resort: write to mock DB if available
        try {
          const mockDbFallback = require("../config/mockDb");
          if (mockDbFallback && typeof mockDbFallback.AssessmentEnrollmentMock?.create === "function") {
            enrollment = await mockDbFallback.AssessmentEnrollmentMock.create(enrollmentData);
          }
        } catch (e) {
          console.warn("Failed to persist enrollment via fallback", e.message);
        }
      }

      if (!enrollment) return res.status(500).json({ message: "Failed to create enrollment" });

      return res.status(201).json({ message: "User enrolled in assessment", enrollment });
    }

    return res.status(400).json({ message: "Unknown productType" });
  } catch (err) {
    console.error("Enroll user error:", err);
    return res.status(500).json({ message: "Server error enrolling user" });
  }
};

