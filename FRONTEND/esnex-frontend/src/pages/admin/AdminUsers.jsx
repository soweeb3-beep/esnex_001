import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, inputStyle, buttonStyle, tableHeader, tableCell } from "./adminUtils";

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "lecturer", label: "Lecturer" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsers() {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 768;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [roleFilter, setRoleFilter] = useState("");
  const [message, setMessage] = useState(null);
  const { searchTerm = "" } = useOutletContext() || {};

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await API.get("/auth/users");
      setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [deletingUserId, setDeletingUserId] = useState(null);

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user account?")) return;
    setDeletingUserId(userId);
    setMessage(null);

    try {
      const res = await API.delete(`/auth/users/${userId}`);
      setMessage({ type: "success", text: res.data.message || "User deleted successfully." });
      await fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to delete user." });
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let filtered = users;

    if (query) {
      filtered = filtered.filter((user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user._id?.toString().includes(query) ||
        (user.roleString || user.role || "student").toString().toLowerCase().includes(query)
      );
    }

    if (roleFilter) {
      filtered = filtered.filter((user) =>
        (user.roleString || user.role || "student").toString().toLowerCase() === roleFilter.toLowerCase()
      );
    }

    return filtered;
  }, [searchTerm, users, roleFilter]);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await API.post("/auth/register", userForm);
      setUserForm({ name: "", email: "", password: "" });
      setMessage("User account created successfully.");
      await fetchUsers();
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create user.");
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Manage Users</h2>
          <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Search users, inspect details, and add student accounts.</p>
          <form onSubmit={createUser} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required autoComplete="name" style={inputStyle} />
              <input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required autoComplete="email" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required autoComplete="new-password" style={inputStyle} />
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={inputStyle}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" style={buttonStyle}>Add user</button>
          </form>
        </div>

        {message && (
          <div style={{ backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(248, 113, 113, 0.15)", border: message.type === "success" ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(248, 113, 113, 0.3)", borderRadius: "1rem", padding: "1rem", color: message.type === "success" ? "#22c55e" : "#b91c1c" }}>
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ minWidth: "200px" }}>
            <label style={{ display: "block", color: "#94a3b8", marginBottom: "0.35rem", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>Filter by role</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>User details</h2>
          <div style={{ overflowX: "auto", marginTop: "1rem", fontSize: isMobile ? "0.85rem" : "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "600px" : "auto" }}>
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Name</th>
                  {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Email</th>}
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Role</th>
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Courses</th>
                  {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Assessments</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>No users found.</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{isMobile ? user.name.split(" ")[0] : user.name}</td>
                      {!isMobile && <td style={{ ...tableCell, padding: "1rem", fontSize: "0.9rem" }}>{user.email}</td>}
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{user.roleString || user.role || "Student"}</td>
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{user.enrolledCourses || 0}</td>
                      {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{user.completedAssessments || 0}</td>}
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                        <button
                          onClick={() => deleteUser(user._id)}
                          disabled={deletingUserId === user._id}
                          style={{
                            background: deletingUserId === user._id ? "#334155" : "#ef4444",
                            color: "white",
                            border: "none",
                            padding: "0.5rem 0.85rem",
                            borderRadius: "0.75rem",
                            cursor: deletingUserId === user._id ? "wait" : "pointer",
                          }}
                        >
                          {deletingUserId === user._id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
