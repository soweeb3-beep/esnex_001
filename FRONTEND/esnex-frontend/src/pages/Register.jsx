import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../api/axios";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time password validation
    if (name === "password") {
      validatePassword(value);
    }
  };

  const validatePassword = (password) => {
    if (!password) {
      setPasswordError("");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (!/(?=.*[a-z])/.test(password)) {
      setPasswordError("Password must contain at least one lowercase letter");
      return;
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      setPasswordError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/(?=.*\d)/.test(password)) {
      setPasswordError("Password must contain at least one number");
      return;
    }

    setPasswordError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation before submit
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);

    try {
      await API.post("/auth/register", form);
      toast.success("Registration successful. Please login.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className="page-content">
        <div className="auth-card">
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              color: '#0ea5e9'
            }}>Create your account</p>
            <h1 style={{
              marginTop: '1rem',
              fontSize: '1.875rem',
              fontWeight: '600',
              color: 'inherit'
            }}>Get started with ESNEX</h1>
            <p style={{
              marginTop: '0.75rem',
              color: 'inherit'
            }}>Sign up to access courses, quizzes, and analytics.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Full name
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </label>
            <label>
              Email address
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
              Password
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  style={{ borderColor: passwordError ? '#ef4444' : undefined }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </label>
            {passwordError && (
              <p style={{
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: '#ef4444'
              }}>
                {passwordError}
              </p>
            )}
            <p style={{
              marginTop: '0.25rem',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              Must be 8+ characters with uppercase, lowercase, and numbers
            </p>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="auth-note" style={{ marginTop: '1rem' }}>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
