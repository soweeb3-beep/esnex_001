import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, inputStyle, buttonStyle, tableHeader, tableCell, deleteButtonStyle } from "./adminUtils";

const DEFAULT_LECTURURER = {
  name: "",
  photoUrl: "",
  bio: "",
  qualification: "",
  specialization: "",
  socialLinks: { linkedin: "", twitter: "", website: "" },
  cvUrl: "",
  permissions: {
    uploadCourse: true,
    editOwnCourse: true,
    viewStudents: false,
    createQuizzes: false,
    gradeTheory: false,
    messageStudents: false,
  },
  status: "active",
};

const initialLecturers = [
  {
    _id: "l1",
    name: "Adama Jalloh",
    role: "Lecturer",
    specialization: "Mathematics",
    qualification: "MSc Mathematics",
    status: "active",
    enrolledCourses: 12,
  },
  {
    _id: "l2",
    name: "Fatmata Sesay",
    role: "Lecturer",
    specialization: "English",
    qualification: "MA English",
    status: "suspended",
    enrolledCourses: 8,
  },
];

export default function AdminLecturers() {
  const { width: windowWidth } = useWindowSize();
  const [lecturers, setLecturers] = useState(initialLecturers);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState(DEFAULT_LECTURURER);
  const [editingId, setEditingId] = useState(null);
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await API.get("/lecturers");
        if (res.data?.lecturers) setLecturers(res.data.lecturers);
      } catch (err) {
        console.warn("Lecturers API not available", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredLecturers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return lecturers;
    return lecturers.filter((lecturer) =>
      lecturer.name?.toLowerCase().includes(query) ||
      lecturer.specialization?.toLowerCase().includes(query) ||
      lecturer.qualification?.toLowerCase().includes(query)
    );
  }, [lecturers, searchTerm]);

  const handleEdit = (lecturer) => {
    setEditingId(lecturer._id);
    setFormState({
      name: lecturer.name,
      photoUrl: lecturer.photoUrl || "",
      bio: lecturer.bio || "",
      qualification: lecturer.qualification || "",
      specialization: lecturer.specialization || "",
      socialLinks: lecturer.socialLinks || { linkedin: "", twitter: "", website: "" },
      cvUrl: lecturer.cvUrl || "",
      permissions: lecturer.permissions || DEFAULT_LECTURURER.permissions,
      status: lecturer.status || "active",
    });
  };

  const handleRemove = (id) => {
    setLecturers((current) => current.filter((item) => item._id !== id));
  };

  const saveLecturer = async (event) => {
    event.preventDefault();
    const savedLecturer = {
      _id: editingId || `l-${Date.now()}`,
      name: formState.name,
      photoUrl: formState.photoUrl,
      bio: formState.bio,
      qualification: formState.qualification,
      specialization: formState.specialization,
      socialLinks: formState.socialLinks,
      cvUrl: formState.cvUrl,
      permissions: formState.permissions,
      status: formState.status,
      enrolledCourses: 0,
    };

    try {
      if (editingId) {
        await API.put(`/lecturers/${editingId}`, savedLecturer).catch(() => {});
        setLecturers((current) => current.map((item) => (item._id === editingId ? savedLecturer : item)));
      } else {
        await API.post(`/lecturers`, savedLecturer).catch(() => {});
        setLecturers((current) => [savedLecturer, ...current]);
      }
      setEditingId(null);
      setFormState(DEFAULT_LECTURURER);
    } catch (err) {
      console.error("Unable to save lecturer", err);
    }
  };

  const togglePermission = (key) => {
    setFormState((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem", display: "grid", gap: "1rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ margin: 0, color: "#e2e8f0" }}>Lecturer Management</h2>
        <p style={{ margin: "0.75rem 0 0", color: "#94a3b8" }}>Add, edit, suspend and assign permissions to lecturers across the platform.</p>
      </div>

      <form onSubmit={saveLecturer} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: "1rem" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>{editingId ? "Edit lecturer" : "Add lecturer"}</h3>
        <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <input placeholder="Name" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} style={inputStyle} />
          <input placeholder="Qualification" value={formState.qualification} onChange={(e) => setFormState({ ...formState, qualification: e.target.value })} style={inputStyle} />
          <input placeholder="Specialization" value={formState.specialization} onChange={(e) => setFormState({ ...formState, specialization: e.target.value })} style={inputStyle} />
          <textarea placeholder="Bio" value={formState.bio} onChange={(e) => setFormState({ ...formState, bio: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="Photo URL" value={formState.photoUrl} onChange={(e) => setFormState({ ...formState, photoUrl: e.target.value })} style={inputStyle} />
          <input placeholder="CV URL" value={formState.cvUrl} onChange={(e) => setFormState({ ...formState, cvUrl: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <h4 style={{ margin: 0, color: "#cbd5e1" }}>Permissions</h4>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            {Object.keys(formState.permissions).map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(255,255,255,0.04)", padding: "0.9rem 1rem", borderRadius: "1rem" }}>
                <input type="checkbox" checked={formState.permissions[key]} onChange={() => togglePermission(key)} />
                <span style={{ color: "#e2e8f0", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
          <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value })} style={inputStyle}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setFormState(DEFAULT_LECTURURER); }} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Cancel</button>}
            <button type="submit" style={buttonStyle}>{editingId ? "Save lecturer" : "Create lecturer"}</button>
          </div>
        </div>
      </form>

      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "640px" : "auto" }}>
          <thead>
            <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Name</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Specialization</th>}
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Status</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Courses</th>}
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>Loading lecturers...</td></tr>
            ) : filteredLecturers.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>No lecturer records found.</td></tr>
            ) : (
              filteredLecturers.map((lecturer) => (
                <tr key={lecturer._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{lecturer.name}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{lecturer.specialization}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{lecturer.status}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{lecturer.enrolledCourses || 0}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                    <button type="button" onClick={() => handleEdit(lecturer)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#2563eb" }}>Edit</button>
                    <button type="button" onClick={() => handleRemove(lecturer._id)} style={{ ...deleteButtonStyle, marginLeft: "0.5rem" }}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
