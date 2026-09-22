import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { isLoggedIn, getRole, getName, logout } from "../utils/auth";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({ onUserClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const location = useLocation();
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const role = getRole();
  const name = getName();
  const { isDark, toggleTheme } = useTheme();

  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };

    window.addEventListener("resize", onResize, { passive: true });
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Hamburger button (render only on small screens) */}
      {isMobile && (
        <>
          <button
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="site-navigation"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          {/* Mobile menu overlay (only on small screens) */}
          {mobileMenuOpen && (
            <button
              type="button"
              className="nav-mobile-overlay"
              onClick={closeMobileMenu}
              aria-label="Close navigation menu"
            />
          )}
        </>
      )}

      <nav
        id="site-navigation"
        className={`site-nav ${mobileMenuOpen ? "nav-mobile-open" : ""}`}
        role="navigation"
        aria-label="Primary site navigation"
        aria-hidden={!mobileMenuOpen && isMobile}
      >
      <div className="container nav-grid">
        <Link to="/" className="brand-link">
          <div className="brand-icon">E</div>
          <div className="brand-copy">
            <span>ESNEX</span>
            <small>Learning platform</small>
          </div>
        </Link>

        <div className="nav-links">
          <Link to="/" onClick={closeMobileMenu}>Home</Link>
          <Link to="/courses" onClick={closeMobileMenu}>Courses</Link>
          <Link to="/assessments" onClick={closeMobileMenu}>Assessments</Link>
          <Link to="/certificates" onClick={closeMobileMenu}>Certificates</Link>
          <Link to="/pricing" onClick={closeMobileMenu}>Pricing</Link>
          <Link to="/about" onClick={closeMobileMenu}>About</Link>
          <Link to="/contact" onClick={closeMobileMenu}>Contact</Link>
          {/* On mobile, repeat secondary links here so they appear in the main mobile list */}
          {isMobile && (
            <>
              <Link to="/about" onClick={closeMobileMenu}>About</Link>
              <Link to="/contact" onClick={closeMobileMenu}>Contact</Link>
            </>
          )}
        </div>

        <div className="nav-secondary">
          <Link to="/about" className="nav-button nav-button-ghost nav-secondary-link" onClick={closeMobileMenu}>
            About
          </Link>
          <Link to="/contact" className="nav-button nav-button-ghost nav-secondary-link" onClick={closeMobileMenu}>
            Contact
          </Link>
        </div>

        <div className="nav-actions">
          <button type="button" className="nav-button nav-button-ghost theme-toggle-button" onClick={toggleTheme} title="Toggle theme">
            {isDark ? "☀️" : "🌙"}
          </button>
          {!loggedIn ? (
            <>
              <Link className="nav-button nav-button-ghost" to="/login" onClick={closeMobileMenu}>
                Log In
              </Link>
              <Link className="nav-button nav-button-ghost" to="/register" onClick={closeMobileMenu}>
                Sign Up
              </Link>
              <Link className="nav-button nav-button-primary" to="/register" onClick={closeMobileMenu}>
                Start Learning Free
              </Link>
            </>
          ) : (
            <>
              {role === "admin" ? (
                <Link className="nav-user" to="/admin" onClick={closeMobileMenu}>
                  <span className="nav-user-name">{name || "User"}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  className="nav-user nav-user-button"
                  onClick={() => {
                    navigate("/dashboard");
                    onUserClick?.();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-user-name">{name || "User"}</span>
                </button>
              )}
              <button className="nav-button nav-button-ghost" onClick={() => { logout(); closeMobileMenu(); }}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      </nav>
    </>
  );
}
