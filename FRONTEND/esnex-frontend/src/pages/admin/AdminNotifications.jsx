import { useState } from "react";
import { useWindowSize, inputStyle, buttonStyle } from "./adminUtils";

export default function AdminNotifications() {
  const { width: windowWidth } = useWindowSize();
  const [notificationForm, setNotificationForm] = useState({ title: "", message: "", audience: "All users", priority: "Normal" });
  const [message, setMessage] = useState("");
  const isMobile = windowWidth < 768;

  const sendNotification = async (e) => {
    e.preventDefault();
    try {
      // Try to POST to backend endpoint if available
      const payload = { ...notificationForm, sentAt: new Date().toISOString(), isRead: false };
      let ok = false;
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        ok = res.ok;
      } catch (e) {
        // network error or endpoint missing - fall back to localStorage
        ok = false;
      }

      // Persist to localStorage so students can see notifications in dev
      try {
        const existing = JSON.parse(localStorage.getItem('sent_notifications') || '[]');
        existing.unshift(payload);
        localStorage.setItem('sent_notifications', JSON.stringify(existing.slice(0, 200)));
      } catch (e) {
        // ignore storage failures
      }

      setMessage(ok ? 'Notification sent successfully.' : 'Notification saved locally (no backend).');
      setNotificationForm({ title: "", message: "", audience: "All users", priority: "Normal" });
    } catch (err) {
      setMessage("Unable to send notification.");
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Send notification</h2>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Broadcast messages to specific audiences.</p>
        {message && (
          <div style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "1rem", padding: "1rem", color: "#22c55e" }}>
            {message}
          </div>
        )}
        <form onSubmit={sendNotification} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <input placeholder="Title" value={notificationForm.title} onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })} required style={inputStyle} />
          <textarea placeholder="Message" value={notificationForm.message} onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })} required rows={isMobile ? 4 : 5} style={{ ...inputStyle, resize: "vertical" }} />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Audience" value={notificationForm.audience} onChange={(e) => setNotificationForm({ ...notificationForm, audience: e.target.value })} style={inputStyle} />
            <input placeholder="Priority" value={notificationForm.priority} onChange={(e) => setNotificationForm({ ...notificationForm, priority: e.target.value })} style={inputStyle} />
          </div>
          <button type="submit" style={buttonStyle}>Send notification</button>
        </form>
      </div>
    </div>
  );
}
