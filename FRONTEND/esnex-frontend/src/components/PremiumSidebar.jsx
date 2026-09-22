import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { getRole, getName, logout } from "../utils/auth";
import "../styles/premium-sidebar.css";

export default function PremiumSidebar({ isOpen = false, onClose = () => {} }) {
  const role = getRole();
  const name = getName() || "User";
  const location = useLocation();

  const studentNavItems = [
    { label: "Dashboard", to: "/dashboard", icon: "📊" },
    { label: "Courses", to: "/courses", icon: "📚" },
    { label: "Quizzes", to: "/quizzes", icon: "✏️" },
    { label: "Assessments", to: "/assessments", icon: "📋" },
    { label: "Progress", to: "/progress", icon: "📈" },
  ];

  const adminNavItems = [
    { label: "Dashboard", to: "/admin", icon: "📊" },
    { label: "Users", to: "/admin/users", icon: "👥" },
    { label: "Courses", to: "/admin/courses", icon: "📚" },
    { label: "Analytics", to: "/admin/analytics", icon: "📈" },
  ];

  const navItems = role === "admin" ? adminNavItems : studentNavItems;

  const isActive = (path) => location.pathname === path;
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(document.querySelectorAll(focusableSelector)).filter(
      (el) => sidebar.contains(el) || el.classList.contains("sidebar-overlay")
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const activeIndex = focusableElements.indexOf(document.activeElement);
      if (event.shiftKey) {
        if (activeIndex === 0 || document.activeElement === sidebar) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (activeIndex === focusableElements.length - 1) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    firstFocusable?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Sidebar */}
      <aside ref={sidebarRef} className={`premium-sidebar ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <div className="sidebar-brand-icon">E</div>
            <div className="sidebar-brand-text">
              <span>ESNEX</span>
              <small>{role === "admin" ? "Admin" : "Learn"}</small>
            </div>
          </Link>
          <button 
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link ${isActive(item.to) ? "active" : ""}`}
              onClick={onClose}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <p className="user-name">{name}</p>
              <p className="user-role">{role === "admin" ? "Administrator" : "Student"}</p>
            </div>
          </div>
          <button 
            className="sidebar-logout"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
    </>
  );
}
