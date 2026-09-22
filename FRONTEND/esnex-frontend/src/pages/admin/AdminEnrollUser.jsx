import { useState } from "react";
import API from "../../api/axios";

export default function AdminEnrollUser() {
  const [form, setForm] = useState({ userId: "", productType: "assessment", productId: "" });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await API.post(`/auth/users/${form.userId}/enroll`, {
        productType: form.productType,
        productId: form.productId,
      });
      setMessage({ type: "success", text: response.data.message || "Enrollment successful." });
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Enrollment failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", display: "grid", gap: "1.25rem" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "1.5rem", padding: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#e2e8f0" }}>Enroll a User</h2>
        <p style={{ color: "#94a3b8", margin: "0.75rem 0 0" }}>Grant access to a course or assessment using the admin enroll endpoint.</p>
      </div>

      {message && (
        <div style={{ borderRadius: "1rem", padding: "1rem", background: message.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)", border: message.type === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(248,113,113,0.3)", color: message.type === "success" ? "#16a34a" : "#b91c1c" }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "1.5rem", padding: "1.25rem" }}>
        <label style={{ display: "grid", gap: "0.5rem", color: "#cbd5e1" }}>
          User ID
          <input
            type="text"
            required
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            placeholder="6a14599e48d9114de54e63b0"
            style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: "1px solid rgba(148,163,184,0.18)", background: "#0f172a", color: "#e2e8f0" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.5rem", color: "#cbd5e1" }}>
          Product Type
          <select
            value={form.productType}
            onChange={(e) => setForm({ ...form, productType: e.target.value })}
            style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: "1px solid rgba(148,163,184,0.18)", background: "#0f172a", color: "#e2e8f0" }}
          >
            <option value="assessment">Assessment</option>
            <option value="course">Course</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: "0.5rem", color: "#cbd5e1" }}>
          Product ID
          <input
            type="text"
            required
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            placeholder="vwwo5yfu1"
            style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: "1px solid rgba(148,163,184,0.18)", background: "#0f172a", color: "#e2e8f0" }}
          />
        </label>
        <button type="submit" disabled={loading} style={{ padding: "0.85rem 1rem", borderRadius: "0.95rem", border: "none", background: "#2563eb", color: "white", fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Enrolling..." : "Enroll User"}
        </button>
      </form>
    </div>
  );
}
