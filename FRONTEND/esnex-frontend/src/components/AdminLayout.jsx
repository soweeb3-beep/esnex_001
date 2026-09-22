import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { getName, logout } from "../utils/auth";
import messageAPI from "../api/messageAPI";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { label: "Overview", section: "overview", to: "/admin", icon: "🏠" },
  { label: "Homepage", section: "homepage", to: "/admin/homepage", icon: "🖥️" },
  { label: "Users", section: "users", to: "/admin/users", icon: "👥" },    { label: "Enroll", section: "enroll", to: "/admin/enroll", icon: "➕" },  { label: "Courses", section: "courses", to: "/admin/courses", icon: "📚" },
  { label: "Lecturers", section: "lecturers", to: "/admin/lecturers", icon: "🎓" },
  { label: "Students", section: "students", to: "/admin/students", icon: "👨‍🎓" },
  { label: "Assessments", section: "assessments", to: "/admin/assessments", icon: "📝" },
  { label: "Section Quizzes", section: "section-quizzes", to: "/admin/section-quizzes", icon: "🧠" },
  { label: "Attempts", section: "attempts", to: "/admin/attempts", icon: "🎯" },
  { label: "Notifications", section: "notifications", to: "/admin/notifications", icon: "🔔" },
  { label: "Payments", section: "payments", to: "/admin/payments", icon: "💳" },
  { label: "Certificates", section: "certificates", to: "/admin/certificates", icon: "📜" },
  { label: "Roles", section: "roles", to: "/admin/roles", icon: "🛡️" },
  { label: "Analytics", section: "analytics", to: "/admin/analytics", icon: "📊" },
];

export default function AdminLayout() {
  const name = getName() || "Admin";
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const sidebarToggleRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();

  const searchSuggestions = [
    { label: "Students", to: "/admin/users" },
    { label: "Courses", to: "/admin/courses" },
    { label: "Lecturers", to: "/admin/lecturers" },
    { label: "Assessments", to: "/admin/assessments" },
    { label: "Section Quizzes", to: "/admin/section-quizzes" },
    { label: "Certificates", to: "/admin/certificates" },
    { label: "Payments", to: "/admin/payments" },
    { label: "Notifications", to: "/admin/notifications" },
    { label: "Analytics", to: "/admin/analytics" },
    { label: "Homepage CMS", to: "/admin/homepage" },
    { label: "Role permissions", to: "/admin/roles" },
  ];

  const filteredSuggestions = searchValue.trim()
    ? searchSuggestions.filter((item) => item.label.toLowerCase().includes(searchValue.trim().toLowerCase()))
    : [];

  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (path.includes("/admin/homepage")) return "homepage";
    if (path.includes("/admin/users")) return "users";
    if (path.includes("/admin/enroll")) return "enroll";
    if (path.includes("/admin/courses")) return "courses";
    if (path.includes("/admin/lecturers")) return "lecturers";
    if (path.includes("/admin/students")) return "students";
    if (path.includes("/admin/assessments")) return "assessments";
    if (path.includes("/admin/section-quizzes")) return "section-quizzes";
    if (path.includes("/admin/attempts")) return "attempts";
    if (path.includes("/admin/notifications")) return "notifications";
    if (path.includes("/admin/payments")) return "payments";
    if (path.includes("/admin/certificates")) return "certificates";
    if (path.includes("/admin/roles")) return "roles";
    if (path.includes("/admin/analytics")) return "analytics";
    return "overview";
  }, [location.pathname]);

  const activeSectionLabel = useMemo(() => {
    const found = navItems.find((n) => n.section === activeSection);
    return found ? found.label : 'Admin';
  }, [activeSection]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    if (!isSidebarOpen) {
      document.body.style.overflow = '';
      return;
    }

    const focusableElements = sidebar ? Array.from(sidebar.querySelectorAll(focusableSelector)) : [];
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    document.body.style.overflow = 'hidden';
    firstFocusable?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
        sidebarToggleRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !sidebar) {
        return;
      }

      const active = document.activeElement;
      if (!sidebar.contains(active)) {
        event.preventDefault();
        firstFocusable?.focus();
        return;
      }

      if (event.shiftKey && active === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }

      if (!event.shiftKey && active === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    const onFocusIn = (event) => {
      if (sidebar && !sidebar.contains(event.target)) {
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const { data } = await messageAPI.getUnreadCount();
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    };

    fetchUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = () => {
    navigate("/admin/messages");
  };

  return (
    <div className="admin-layout">
      <a href="#admin-main" className="sr-only sr-only-focusable">Skip to main content</a>
      <aside
        id="admin-sidebar"
        ref={sidebarRef}
        className={`admin-sidebar ${isSidebarOpen ? "admin-sidebar--open" : ""}`}
      >
        <div className="admin-sidebar-header">
          <div className="admin-brand-icon">E</div>
          <div className="admin-brand-text">
            <p>ESNEX</p>
            <p>Admin Panel</p>
          </div>
          <button
            ref={sidebarToggleRef}
            aria-label="Toggle sidebar"
            aria-expanded={isSidebarOpen}
            aria-controls="admin-sidebar"
            onClick={() => setIsSidebarOpen((open) => !open)}
            className="admin-sidebar-toggle-mobile"
          >
            {isSidebarOpen ? "✕" : "≡"}
          </button>
        </div>

        <div className="admin-sidebar-nav" role="navigation" aria-label="Admin sidebar navigation">
          {navItems.map((item) => {
            const active = activeSection === item.section;
            const itemClass = active ? "admin-nav-link active" : "admin-nav-link";

            return (
              <Link key={item.label} to={item.to} className={itemClass}>
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {active && <span className="admin-nav-dot">•</span>}
              </Link>
            );
          })}
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-card">
            <p>Super Admin</p>
            <p>{name}</p>
            <p>Full Access</p>
          </div>
          <button onClick={logout} className="admin-logout-button">
            Logout
          </button>
        </div>
      </aside>

{isSidebarOpen && (
          <button
            type="button"
            className="admin-backdrop"
            aria-label="Close menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

      <main id="admin-main" className="admin-main" tabIndex={-1}>
        <div className="admin-main-header">
          <div className="admin-main-search-row">
            <button
              aria-expanded={isSidebarOpen}
              aria-controls="admin-sidebar"
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="admin-sidebar-toggle"
            >
              ≡
            </button>
            <div className="admin-search-box">
              <label htmlFor="admin-search-input" className="sr-only">Search admin</label>
              <input
                id="admin-search-input"
                aria-label="Search admin: students, lecturers, courses, assessments"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                type="search"
                placeholder="Search students, lecturers, courses, assessments..."
                className="admin-search-input"
              />
              <span className="admin-search-shortcut">Ctrl + K</span>
              {searchValue.trim() && (
                <div className="admin-search-suggestions">
                  {filteredSuggestions.length > 0 ? (
                    filteredSuggestions.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="admin-search-suggestion"
                        onClick={() => {
                          setSearchValue(item.label);
                          navigate(item.to);
                        }}
                      >
                        <span>{item.label}</span>
                        <span>Go</span>
                      </button>
                    ))
                  ) : (
                    <div className="admin-search-suggestion">No matches yet. Try another keyword.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="admin-header-actions">
            <button 
              type="button"
              className="admin-theme-toggle"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            <button 
              className="admin-notification-button" 
              aria-label="Notifications"
              onClick={handleNotificationClick}
              title="View your messages"
            >
              🔔
              {unreadCount > 0 && (
                <span className="admin-notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <div className="admin-profile-pill">
              <div className="admin-profile-avatar">A</div>
              <div className="admin-profile-info">
                <p>{name}</p>
                <p>Super Administrator</p>
              </div>
            </div>
          </div>
        </div>

        <section className="admin-content-shell">
          <h1 className="admin-page-title">{activeSectionLabel}</h1>
          <Outlet context={{ searchTerm: searchValue }} />
        </section>
      </main>
    </div>
  );
}
