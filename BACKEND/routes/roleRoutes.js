const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  updateSuperAdminPermissions,
  getRolePermissions,
} = require("../controllers/roleController");

// Get all roles
router.get("/", protect, adminOnly, getAllRoles);

// Get role by ID
router.get("/:roleId", protect, adminOnly, getRoleById);

// Get role permissions
router.get("/:roleId/permissions", protect, adminOnly, getRolePermissions);

// Create new role (admin only)
router.post("/", protect, adminOnly, createRole);

// Update role
router.put("/:roleId", protect, adminOnly, updateRole);

// Update Super Admin permissions (admin only)
router.put("/super-admin/update-permissions", protect, adminOnly, updateSuperAdminPermissions);

// Delete custom role (admin only, cannot delete system roles)
router.delete("/:roleId", protect, adminOnly, deleteRole);

module.exports = router;
