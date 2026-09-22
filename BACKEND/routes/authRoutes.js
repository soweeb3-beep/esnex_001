const express = require("express");
const router = express.Router();

const {
  register,
  adminRegister,
  createUser,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getUsers,
  getMe,
  updateProfile,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// REGISTER
router.post("/register", register);
router.post("/create-user", protect, adminOnly, createUser);

// LOGIN
router.post("/login", login);

// PASSWORD RESET FLOW
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// AUTH PROFILE
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);

// ADMIN USERS
router.get("/users", protect, adminOnly, getUsers);

// ADMIN: Delete user
router.delete("/users/:id", protect, adminOnly, async (req, res, next) => {
	console.log('[ADMIN] delete user route called', req.params.id);
	next();
}, async (req, res) => {
	// delegate to controller
	const { deleteUser } = require("../controllers/authController");
	return deleteUser(req, res);
});

// ADMIN: Enroll a user into a course or assessment
router.post("/users/:id/enroll", protect, adminOnly, async (req, res, next) => {
	console.log('[ADMIN] enroll user route called', req.params.id, req.body);
	next();
}, async (req, res) => {
	const { enrollUser } = require("../controllers/authController");
	return enrollUser(req, res);
});
module.exports = router;