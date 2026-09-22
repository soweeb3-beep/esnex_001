import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, inputStyle, buttonStyle, tableHeader, tableCell } from "./adminUtils";

const DEFAULT_ROLES = [
  {
    id: "role-super-admin",
    name: "Super Admin",
    permissions: ["everything"],
    isSystemRole: true,
  },
  {
    id: "role-admin",
    name: "Admin",
    permissions: ["homepage", "courses", "users", "assessments", "payments", "notifications", "analytics"],
    isSystemRole: true,
  },
  {
    id: "role-lecturer",
    name: "Lecturer",
    permissions: ["uploadCourse", "editOwnCourse", "createQuizzes", "gradeTheory", "viewStudents"],
    isSystemRole: true,
  },
  {
    id: "role-support",
    name: "Support Staff",
    permissions: ["viewStudents", "payments", "notifications"],
    isSystemRole: true,
  },
  {
    id: "role-moderator",
    name: "Moderator",
    permissions: ["approveContent", "reviewTestimonials", "publishFaq"],
    isSystemRole: true,
  },
];

const AVAILABLE_PERMISSIONS = [
  { value: "homepage", label: "Homepage CMS" },
  { value: "courses", label: "Course Management" },
  { value: "assessments", label: "Assessment Builder" },
  { value: "payments", label: "Payments" },
  { value: "notifications", label: "Notifications" },
  { value: "analytics", label: "Analytics" },
  { value: "viewStudents", label: "View Students" },
  { value: "uploadCourse", label: "Upload Course" },
  { value: "editOwnCourse", label: "Edit Own Course" },
  { value: "createQuizzes", label: "Create Quizzes" },
  { value: "gradeTheory", label: "Grade Theory/Oral" },
  { value: "approveContent", label: "Content Approval" },
  { value: "everything", label: "Full system access" },
];

export default function AdminRoles() {
  const { width: windowWidth } = useWindowSize();
  const { searchTerm = "" } = useOutletContext() || {};
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [activeRoleId, setActiveRoleId] = useState(DEFAULT_ROLES[0]?.id || null);
  const [newRoleName, setNewRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLES[0]?.permissions || []);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isMobile = windowWidth < 768;

  const activeRole = roles.find((role) => role.id === activeRoleId) || roles[0];

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const response = await API.get("/roles");
        const fetchedRoles = (response?.data?.roles || []).map((role) => ({
          id: role._id,
          name: role.name,
          key: role.key,
          permissions: Array.isArray(role.permissions) ? role.permissions : [],
          isSystemRole: role.isSystemRole || false,
        }));

        if (fetchedRoles.length > 0) {
          setRoles(fetchedRoles);
          setActiveRoleId(fetchedRoles[0].id);
          setRolePermissions(fetchedRoles[0].permissions);
        }
      } catch (error) {
        console.error("Failed to load roles", error);
        setErrorMessage(error?.response?.data?.message || "Unable to load roles");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoles();
  }, []);

  useEffect(() => {
    const current = roles.find((role) => role.id === activeRoleId);
    if (current) {
      setRolePermissions(current.permissions || []);
    }
  }, [activeRoleId, roles]);

  const filteredRoles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(q));
  }, [roles, searchTerm]);

  const togglePermission = (permission) => {
    setRolePermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      const response = await API.post("/roles", {
        name: newRoleName.trim(),
        description: "",
        permissions: rolePermissions,
      });

      const createdRole = response.data.role;
      const newRole = {
        id: createdRole._id,
        name: createdRole.name,
        key: createdRole.key,
        permissions: createdRole.permissions || [],
        isSystemRole: createdRole.isSystemRole || false,
      };

      setRoles((current) => [newRole, ...current]);
      setActiveRoleId(newRole.id);
      setNewRoleName("");
      setErrorMessage("");
    } catch (error) {
      console.error("Create role failed", error);
      setErrorMessage(error?.response?.data?.message || "Unable to create role");
    }
  };

  const handleSaveRole = async () => {
    const current = roles.find((role) => role.id === activeRoleId);
    if (!current) return;

    try {
      const response = await API.put(`/roles/${current.id}`, {
        name: current.name,
        permissions: rolePermissions,
      });

      const updatedRole = response.data.role;
      setRoles((currentRoles) =>
        currentRoles.map((role) =>
          role.id === updatedRole._id
            ? { ...role, permissions: updatedRole.permissions || [], name: updatedRole.name }
            : role
        )
      );
      setErrorMessage("");
    } catch (error) {
      console.error("Save role failed", error);
      setErrorMessage(error?.response?.data?.message || "Unable to save role");
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem", display: "grid", gap: "1rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ margin: 0, color: "#e2e8f0" }}>Role Permissions</h2>
        <p style={{ margin: "0.75rem 0 0", color: "#94a3b8" }}>Create and manage system roles from the backend so changes persist for the entire application.</p>
      </div>

      <div style={{ display: "grid", gap: isMobile ? "1rem" : "1.5rem", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: "1rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Roles</h3>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {filteredRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setActiveRoleId(role.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.85rem 1rem",
                  borderRadius: "1rem",
                  border: role.id === activeRoleId ? "1px solid #2563eb" : "1px solid rgba(148, 163, 184, 0.12)",
                  backgroundColor: role.id === activeRoleId ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)",
                  color: "#e2e8f0",
                }}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: "1rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Edit role permissions</h3>
          <p style={{ color: "#94a3b8", margin: "0.5rem 0 1rem" }}>Current role: {activeRole?.name}</p>
          {isLoading ? (
            <p style={{ color: "#94a3b8" }}>Loading roles...</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <label
                  key={permission.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.9rem 1rem",
                    borderRadius: "1rem",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "#e2e8f0",
                  }}
                >
                  <input type="checkbox" checked={rolePermissions.includes(permission.value)} onChange={() => togglePermission(permission.value)} />
                  <span>{permission.label}</span>
                </label>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            <input placeholder="New role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} style={inputStyle} />
            <button type="button" onClick={handleCreateRole} style={buttonStyle}>Create new role</button>
            <button type="button" onClick={handleSaveRole} style={buttonStyle}>Save changes</button>
            {errorMessage ? <p style={{ color: "#f87171" }}>{errorMessage}</p> : null}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "640px" : "auto" }}>
          <thead>
            <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Role</th>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{role.name}</td>
                <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{role.permissions.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
