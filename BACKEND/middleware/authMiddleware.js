const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
try {
  fs.appendFileSync(path.join(__dirname, '../auth-middleware-module-loaded.log'), `${new Date().toISOString()} - authMiddleware module loaded\n`, 'utf8');
} catch (err) {
  console.error('Failed to write auth middleware module load log', err && err.message);
}

/* =========================
   PROTECT (LOGIN REQUIRED)
========================= */
exports.protect = (req, res, next) => {
  console.log("🔐 PROTECT middleware called for", req.method, req.path);
  let token = req.headers.authorization;

  // No token
  if (!token) {
    console.log("❌ No token found");
    return res.status(401).json({ message: "No token, access denied" });
  }

  try {
    // Remove "Bearer "
    const parts = token.split(" ");
    token = parts.length > 1 ? parts[1] : parts[0];

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("✅ Token verified for user:", decoded.id);

    req.user = decoded; // attach user info

    next(); // go to next function
  } catch (error) {
    console.log("❌ Token verification failed:", error.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

/* =========================
   ADMIN ONLY
========================= */
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "super-admin") {
    return res.status(403).json({ message: "Admin access only" });
  }

  next();
};