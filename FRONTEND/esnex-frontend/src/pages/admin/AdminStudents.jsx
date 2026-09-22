import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, inputStyle, buttonStyle, tableHeader, tableCell, deleteButtonStyle } from "./adminUtils";

const SAMPLE_STUDENTS = [
  { _id: "s1", name: "Aisha Conteh", email: "aisha@example.com", phone: "+232 78 123 456", progress: "72%", status: "active", enrolledCourses: 3, certificates: 1 },
  { _id: "s2", name: "Joseph Kamara", email: "joseph@example.com", phone: "+232 76 321 987", progress: "45%", status: "suspended", enrolledCourses: 1, certificates: 0 },
];

export default function AdminStudents() {
  const { width: windowWidth } = useWindowSize();
  const [students, setStudents] = useState(SAMPLE_STUDENTS);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formState, setFormState] = useState({ name: "", email: "", phone: "", status: "active" });
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const res = await API.get("/students");
        if (res.data?.students) setStudents(res.data.students);
      } catch (err) {
        console.warn("Students API not available", err);
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      student.name?.toLowerCase().includes(q) ||
      student.email?.toLowerCase().includes(q) ||
      student.phone?.includes(q)
    );
  }, [students, searchTerm]);

  const selectStudent = (student) => {
    setSelectedStudent(student);
    setFormState({ name: student.name, email: student.email, phone: student.phone, status: student.status || "active" });
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    const saved = { ...selectedStudent, ...formState, enrolledCourses: selectedStudent?.enrolledCourses ?? 0, certificates: selectedStudent?.certificates ?? 0, progress: selectedStudent?.progress ?? "0%" };
    try {
      if (saved._id) {
        await API.put(`/students/${saved._id}`, saved).catch(() => {});
        setStudents((current) => current.map((item) => (item._id === saved._id ? saved : item)));
      } else {
        const next = { ...saved, _id: `s-${Date.now()}` };
        await API.post(`/students`, next).catch(() => {});
        setStudents((current) => [next, ...current]);
      }
      setSelectedStudent(null);
      setFormState({ name: "", email: "", phone: "", status: "active" });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteStudent = (id) => {
    setStudents((current) => current.filter((student) => student._id !== id));
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem", display: "grid", gap: "1rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ margin: 0, color: "#e2e8f0" }}>Student Management</h2>
        <p style={{ margin: "0.75rem 0 0", color: "#94a3b8" }}>View full student records, reset access, enroll students, and manage status.</p>
      </div>

      {selectedStudent && (
        <form onSubmit={saveStudent} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: "1rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Edit student</h3>
          <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
            <input placeholder="Student name" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} style={inputStyle} />
            <input placeholder="Email" value={formState.email} onChange={(e) => setFormState({ ...formState, email: e.target.value })} style={inputStyle} />
            <input placeholder="Phone" value={formState.phone} onChange={(e) => setFormState({ ...formState, phone: e.target.value })} style={inputStyle} />
            <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value })} style={inputStyle}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setSelectedStudent(null); setFormState({ name: "", email: "", phone: "", status: "active" }); }} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Cancel</button>
            <button type="submit" style={buttonStyle}>Save student</button>
          </div>
        </form>
      )}

      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "640px" : "auto" }}>
          <thead>
            <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Name</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Email</th>}
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Status</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Progress</th>}
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>Loading student records...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>No matching students found.</td></tr>
            ) : (
              filteredStudents.map((student) => (
                <tr key={student._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{student.name}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{student.email}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{student.status}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{student.progress}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                    <button type="button" onClick={() => selectStudent(student)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#2563eb" }}>Edit</button>
                    <button type="button" onClick={() => deleteStudent(student._id)} style={{ ...deleteButtonStyle, marginLeft: "0.5rem" }}>Delete</button>
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
