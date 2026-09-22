import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data } = await API.post("/auth/forgot-password", { email });
      setMessage(data.message || "If an account exists, a reset PIN has been sent to your email.");
      toast.success(data.message || "Password reset PIN request submitted.");
    } catch (error) {
      const errorMessage = error?.response?.data?.message || "Unable to send reset PIN.";
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
          <h1>Forgot Password</h1>
          <p>Enter your email address and we will send a reset PIN to your inbox.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading || !email}>
              {loading ? "Sending..." : "Send Reset PIN"}
            </button>
          </form>
          {message && <p className="auth-note" style={{ marginTop: "1rem" }}>{message}</p>}
          <p className="auth-footer">
            Remembered your password? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-footer">
            Have a PIN already? <Link to="/reset-password">Reset password</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
