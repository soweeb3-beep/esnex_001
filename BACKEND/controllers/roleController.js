const mongoose = require("mongoose");
const { getModel } = require("../config/adapter");

const getRole = () => getModel("Role");

/**
 * Initialize default system roles
 */
exports.initializeDefaultRoles = async () => {
  try {
    const defaultRoles = [
      {
        key: "super-admin",
        name: "Super Admin",
        description: "Full system access with all permissions",
        permissions: ["everything"],
        isSystemRole: true,
        isActive: true,
      },
      {
        key: "admin",
        name: "Admin",
        description: "Administrative access to manage courses, assessments, users, and payments",
        permissions: ["homepage", "courses", "users", "assessments", "payments", "notifications", "analytics"],
        isSystemRole: true,
        isActive: true,
      },
      {
        key: "lecturer",
        name: "Lecturer",
        description: "Can upload and edit courses, create quizzes, and grade theory/oral assignments",
        permissions: ["uploadCourse", "editOwnCourse", "createQuizzes", "gradeTheory", "viewStudents"],
        isSystemRole: true,
        isActive: true,
      },
      {
        key: "support",
        name: "Support Staff",
        description: "Can view student information, manage payments and notifications",
        permissions: ["viewStudents", "payments", "notifications"],
        isSystemRole: true,
        isActive: true,
      },
      {
        key: "moderator",
        name: "Moderator",
        description: "Can approve content, review testimonials, and publish FAQs",
        permissions: ["approveContent", "reviewTestimonials", "publishFaq"],
        isSystemRole: true,
        isActive: true,
      },
      {
        key: "student",
        name: "Student",
        description: "Default learner role with access to courses and assessments",
        permissions: [],
        isSystemRole: true,
        isActive: true,
      },
    ];

    for (const roleData of defaultRoles) {
      const exists = await getRole().findOne({ name: roleData.name });
      if (!exists) {
        await getRole().create(roleData);
      }
    }
    console.log("Default roles initialized");
  } catch (error) {
    console.error("Error initializing default roles:", error);
  }
};

/**
 * Get all roles
 */
exports.getAllRoles = async (req, res) => {
  try {
    const roles = (await getRole().find()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    res.json({ roles });
  } catch (error) {
    console.error("Get all roles error", error);
    res.status(500).json({ message: "Unable to fetch roles" });
  }
};

/**
 * Get role by ID
 */
exports.getRoleById = async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await getRole().findById(roleId);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({ role });
  } catch (error) {
    console.error("Get role by ID error", error);
    res.status(500).json({ message: "Unable to fetch role" });
  }
};

/**
 * Create new role
 */
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !Array.isArray(permissions)) {
      return res.status(400).json({ message: "name and permissions array are required" });
    }

    const key = name.trim().toLowerCase().replace(/\s+/g, "-");
    const exists = await getRole().findOne({ $or: [{ name }, { key }] });
    if (exists) {
      return res.status(400).json({ message: "Role with this name or key already exists" });
    }

    const role = await getRole().create({
      key,
      name,
      description: description || "",
      permissions,
      isSystemRole: false,
      isActive: true,
    });

    res.status(201).json({ role, message: "Role created successfully" });
  } catch (error) {
    console.error("Create role error", error);
    res.status(500).json({ message: "Unable to create role" });
  }
};

/**
 * Update role
 */
exports.updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description, permissions, isActive } = req.body;

    const role = await getRole().findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent updating system roles to have non-existent permissions
    if (role.isSystemRole && !Array.isArray(permissions)) {
      return res.status(400).json({ message: "Permissions must be an array" });
    }

    // Update fields
    if (name && name !== role.name) {
      const exists = await getRole().findOne({ name, _id: { $ne: roleId } });
      if (exists) {
        return res.status(400).json({ message: "Another role with this name already exists" });
      }
      role.name = name;
    }

    if (description !== undefined) role.description = description;
    if (Array.isArray(permissions)) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();
    res.json({ role, message: "Role updated successfully" });
  } catch (error) {
    console.error("Update role error", error);
    res.status(500).json({ message: "Unable to update role" });
  }
};

/**
 * Delete custom role (cannot delete system roles)
 */
exports.deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await getRole().findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (role.isSystemRole) {
      return res.status(403).json({ message: "Cannot delete system roles" });
    }

    await getRole().findByIdAndDelete(roleId);
    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error", error);
    res.status(500).json({ message: "Unable to delete role" });
  }
};

/**
 * Update Super Admin permissions - ADMIN ONLY
 */
exports.updateSuperAdminPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "permissions must be an array" });
    }

    const superAdminRole = await getRole().findOne({ key: "super-admin" });
    if (!superAdminRole) {
      return res.status(404).json({ message: "Super Admin role not found" });
    }

    superAdminRole.permissions = permissions;
    await superAdminRole.save();

    res.json({ role: superAdminRole, message: "Super Admin permissions updated successfully" });
  } catch (error) {
    console.error("Update Super Admin permissions error", error);
    res.status(500).json({ message: "Unable to update Super Admin permissions" });
  }
};

/**
 * Get permissions for a role
 */
exports.getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await getRole().findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({ permissions: role.permissions, role: role.name });
  } catch (error) {
    console.error("Get role permissions error", error);
    res.status(500).json({ message: "Unable to fetch role permissions" });
  }
};

/**
 * Check if user has specific permission
 */
exports.checkPermission = async (userId, permission) => {
  try {
    const User = require("../models/user");
    const user = await User.findById(userId).populate("role");

    if (!user) return false;

    if (user.role && Array.isArray(user.role.permissions)) {
      if (user.role.permissions.includes("everything")) return true;
      return user.role.permissions.includes(permission);
    }

    if (user.roleString === "super-admin") {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Check permission error", error);
    return false;
  }
};
