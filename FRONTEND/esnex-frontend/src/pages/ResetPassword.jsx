import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../api/axios";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", pin: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await API.post("/auth/reset-password", {
        email: form.email,
        pin: form.pin,
        newPassword: form.newPassword,
      });
      setMessage(data.message || "Password reset successful.");
      toast.success(data.message || "Password has been reset.");
      navigate("/login");
    } catch (error) {
      const errorMessage = error?.response?.data?.message || "Unable to reset password.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className="page-content">
        <div className="auth-card">
          <h1>Reset Password</h1>
          <p>Use the PIN sent to your email to choose a new password.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Reset PIN
              <input
                type="text"
                name="pin"
                value={form.pin}
                onChange={handleChange}
                required
                autoComplete="one-time-code"
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
          {message && <p className="auth-note" style={{ marginTop: "1rem" }}>{message}</p>}
          <p className="auth-footer">
            Need a new PIN? <Link to="/forgot-password">Request another reset PIN</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
