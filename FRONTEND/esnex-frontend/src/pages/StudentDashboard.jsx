import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../api/axios";
import messageAPI from "../api/messageAPI";
import heroLogo from "../assets/hero.png";
import { useAuth } from "../context/AuthContext";
import { getName } from "../utils/auth";
import { useTheme } from "../context/ThemeContext";
import UserProgress from "./UserProgress";
import "../styles/student-dashboard.css";

const useWindowSize = () => {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1024 });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
};

const sidebarItems = [
  { label: "Dashboard", section: "home", icon: "🏠" },
  { label: "My Courses", section: "courses", icon: "📚" },
  { label: "Assessments", section: "assessments", icon: "📝" },
  { label: "Practice Quiz", section: "quiz", icon: "❓" },
  { label: "Progress", section: "progress", icon: "📊" },
  { label: "Certificates", section: "certificates", icon: "🏆" },
  { label: "Results", section: "results", icon: "📈" },
  { label: "Messages", section: "messages", icon: "💬" },
  { label: "Settings", section: "settings", icon: "⚙️" },
];

const DEFAULT_ASSESSMENTS = [
  { slug: "english", name: "English", icon: "📖", questions: 120, duration: 60, description: "WASSCE Objective, Theory & Oral" },
  { slug: "maths", name: "Mathematics", icon: "📐", questions: 80, duration: 90, description: "Objective Mathematics sections" },
  { slug: "biology", name: "Biology", icon: "🔬", questions: 100, duration: 60, description: "Coming soon, stay tuned" },
  { slug: "chemistry", name: "Chemistry", icon: "⚗️", questions: 100, duration: 60, description: "Practical-based questions" },
];

export default function StudentDashboard() {
  const { width: windowWidth } = useWindowSize();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const userName = getName();

  const [activeView, setActiveView] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [myCourses, setMyCourses] = useState([]);
  const [results, setResults] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [enrolledAssessments, setEnrolledAssessments] = useState([]);
  const [assessmentProgress, setAssessmentProgress] = useState([]);
  const [assessmentSummaries, setAssessmentSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const { isDark, toggleTheme } = useTheme();
  const [streak, setStreak] = useState(7);
  const [pendingAssessments, setPendingAssessments] = useState(2);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");
  const sidebarRef = useRef(null);

  const isMobile = windowWidth < 768;

  const markNotificationRead = (index) => {
    setNotificationsList((prevList) => {
      const updated = prevList.map((item, idx) =>
        idx === index ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() } : item
      );
      try {
        localStorage.setItem('sent_notifications', JSON.stringify(updated));
      } catch (e) {
        // ignore storage failures
      }
      return updated;
    });
  };

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (!sidebarOpen || !isMobile || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(document.querySelectorAll(focusableSelector)).filter(
      (el) => sidebar.contains(el) || el.classList.contains("dashboard-sidebar-overlay")
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
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
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const userEmail = typeof window !== "undefined" ? sessionStorage.getItem("email") || "" : "";

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordChangeMessage("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordChangeMessage("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeMessage("New password must be at least 8 characters.");
      return;
    }

    setPasswordChangeLoading(true);

    try {
      const { data } = await API.put("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordChangeMessage(data.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success(data.message || "Password changed successfully");
    } catch (error) {
      setPasswordChangeMessage(error?.response?.data?.message || "Unable to change password.");
      toast.error(error?.response?.data?.message || "Unable to change password.");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  useEffect(() => {
    if (activeView !== 'messages') return;
    try {
      const stored = JSON.parse(localStorage.getItem('sent_notifications') || '[]');
      setNotificationsList(
        (stored || []).map((item) => ({
          ...item,
          isRead: item.isRead ?? false,
        }))
      );
    } catch (e) {
      setNotificationsList([]);
    }
  }, [activeView]);

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
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [coursesRes, resultsRes, quizzesRes, assessmentsRes, certificatesRes, progressRes] = await Promise.all([
        API.get("/enrollments/my-courses").catch(() => ({ data: [] })),
        API.get("/quizzes/results").catch(() => ({ data: [] })),
        API.get("/quizzes").catch(() => ({ data: [] })),
        API.get("/assessments/enrolled").catch(() => ({ data: { assessments: [] } })),
        API.get("/certificates/my").catch(() => ({ data: { certificates: [] } })),
        API.get("/assessments/student/progress").catch(() => ({ data: { success: true, summary: {}, progress: [] } })),
      ]);

      setMyCourses(coursesRes.data || []);
      setResults(resultsRes.data || []);
      setQuizzes(quizzesRes.data || []);
      setCertificates(certificatesRes.data?.certificates || []);

      const enrolledAssessments = (assessmentsRes.data?.assessments || []).map((assessment) => ({
        _id: assessment._id,
        name: assessment.name,
        slug: assessment.subject,
        icon: "📝",
        questions: assessment.totalQuestions || 0,
        duration: assessment.duration,
      }));

      setEnrolledAssessments(enrolledAssessments);
      const progress = Array.isArray(progressRes.data?.progress) ? progressRes.data.progress : [];
      const summaries = Array.isArray(progressRes.data?.assessmentSummaries) ? progressRes.data.assessmentSummaries : [];
      setAssessmentProgress(progress);
      setAssessmentSummaries(summaries);
      setPendingAssessments((progress.filter((item) => item.status === "in-progress").length || 2));
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prevOpen) => !prevOpen);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getCoursePath = (course) => {
    const courseId = course?.courseId || course?.course?._id || course?.course;
    return courseId ? `/course/${courseId}` : "/courses";
  };

  const handleContinueLearning = (course) => {
    const path = getCoursePath(course);
    navigate(path);
  };

  const handleContinueToFirstCourse = () => {
    if (myCourses.length > 0) {
      handleContinueLearning(myCourses[0]);
    } else {
      navigate("/courses");
    }
  };

  const getCertificateQrUrl = (text) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${encodeURIComponent(text)}`;

  const downloadCertificate = (cert) => {
    const certificateName = cert.courseName || cert.title || "certificate";
    const certificateId = cert.certificateId || cert.verificationId || "CERTIFICATE";
    const issuedDateText = cert.issuedDate
      ? new Date(cert.issuedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "N/A";

    const qrPayloadText = [
      "ESNEX TECHNOLOGIES CERTIFICATE",
      "",
      `Certificate ID: ${certificateId}`,
      `Student: ${cert.studentName || "Student Name"}`,
      `Course: ${certificateName}`,
      `Issued Date: ${issuedDateText}`,
      `Status: ${cert.status || "Valid"}`,
      "",
      `Verification: ${window.location.origin}/verify-certificate/${certificateId}`,
      "",
      "Scan this QR code to verify the certificate.",
    ].join("\n");

    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${certificateName} Certificate</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { font-family: 'Poppins', Arial, sans-serif; margin: 0; background: linear-gradient(135deg, #07111f 0%, #0f172a 45%, #111827 100%); color: #0f172a; }
            .page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
            .outer-shell { width: 100%; max-width: 1120px; min-height: 794px; background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 55%, #f8fbff 100%); border-radius: 28px; padding: 18px; border: 2px solid #111827; box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18); }
            .top-bar { height: 10px; border-radius: 999px; background: linear-gradient(90deg, #0b2e83, #1e73e8, #d4af37); margin-bottom: 14px; }
            .card { width: 100%; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); border-radius: 24px; padding: 28px; box-shadow: 0 24px 56px rgba(15, 23, 42, 0.12); border: 8px solid #0b2e83; outline: 2px solid #d4af37; outline-offset: 4px; position: relative; overflow: hidden; }
            .card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top, rgba(212,175,55,0.08), transparent 35%), linear-gradient(135deg, rgba(11,46,131,0.02), transparent 30%); pointer-events: none; }
            .brand { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; position: relative; z-index: 1; }
            .brand-badge { width: 74px; height: 74px; border-radius: 18px; background: linear-gradient(135deg, #1e40af, #2563eb); color: #fff; display: grid; place-items: center; box-shadow: 0 18px 40px rgba(37, 99, 235, 0.28); overflow: hidden; }
            .brand-text { text-align: center; }
            .brand-eyebrow { margin: 0; color: #0b2e83; text-transform: uppercase; letter-spacing: 0.25em; font-size: 0.78rem; font-weight: 800; font-family: 'Playfair Display', Georgia, serif; }
            .brand-sub { margin: 6px 0 0; color: #334155; font-size: 0.88rem; }
            .title-wrap { text-align: center; margin-top: 18px; position: relative; z-index: 1; }
            .title-label { margin: 0; color: #475569; font-size: 0.98rem; text-transform: uppercase; letter-spacing: 0.18em; }
            .title { margin: 8px 0 0; font-size: 3.4rem; letter-spacing: 0.18em; color: #0b2e83; font-weight: 800; font-family: 'Playfair Display', Georgia, serif; text-shadow: 0 1px 0 rgba(255,255,255,0.85); }
            .accent-ribbon { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
            .accent-pill { padding: 7px 12px; border-radius: 999px; background: linear-gradient(135deg, #0b2e83, #1e73e8); color: #fff; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800; box-shadow: 0 10px 24px rgba(30, 64, 175, 0.25); }
            .cert-body { text-align: center; padding: 0 10px; margin-top: 18px; position: relative; z-index: 1; }
            .subtitle { margin: 0; color: #475569; font-size: 1rem; }
            .student-name { margin: 12px 0 0; color: #0b2e83; font-size: 3rem; font-weight: 700; font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.02; }
            .course-name { margin: 12px 0 0; color: #1e73e8; font-size: 1.8rem; font-weight: 800; font-family: 'Poppins', Arial, sans-serif; }
            .footer-row { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 24px; align-items: flex-end; margin-top: 24px; position: relative; z-index: 1; }
            .meta-card { display: grid; gap: 12px; }
            .meta-item { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 16px; background: linear-gradient(135deg, #f8fbff, #eef2ff); border: 1px solid #dbe4f0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.7); }
            .meta-icon { width: 66px; height: 66px; border-radius: 16px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); display: grid; place-items: center; color: #1d4ed8; font-size: 1.05rem; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }
            .meta-label { margin: 0; color: #64748b; font-size: 0.92rem; }
            .meta-value { margin: 4px 0 0; color: #0f172a; font-weight: 800; font-size: 1rem; }
            .qr-box { display: grid; place-items: center; padding: 14px; background: linear-gradient(180deg, #ffffff, #f8fbff); border-radius: 20px; border: 1px solid #dbe4f0; box-shadow: 0 14px 32px rgba(37, 99, 235, 0.08); max-width: 220px; justify-self: end; }
            .qr-label { margin: 10px 0 0; color: #475569; font-size: 0.82rem; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.12em; }
            .qr-note { margin: 6px 0 0; color: #475569; font-size: 0.75rem; text-align: center; word-break: break-word; }
            .seal { width: 118px; height: 118px; border-radius: 50%; border: 4px solid #d4af37; background: radial-gradient(circle at 30% 30%, #fff9e6 0%, #f5d97a 45%, #d4af37 100%); color: #0b2e83; display: grid; place-items: center; text-align: center; box-shadow: 0 14px 28px rgba(212,175,55,0.25), inset 0 4px 8px rgba(255,255,255,0.65); font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1.15; margin: 0 auto; }
            .seal strong { display: block; font-size: 0.72rem; }
            .footer-strip { margin-top: 16px; padding-top: 10px; border-top: 1px solid #dbe4f0; color: #475569; font-size: 0.78rem; display: flex; gap: 14px; justify-content: center; align-items: center; flex-wrap: wrap; position: relative; z-index: 1; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="outer-shell">
              <div class="top-bar"></div>
              <div class="card">
                <div class="brand">
                  <div class="brand-badge" style="overflow:hidden;">
                    <img src="${heroLogo}" alt="ESNEX logo" style="width:100%;height:100%;object-fit:cover;display:block;" />
                  </div>
                  <div class="brand-text">
                    <p class="brand-eyebrow">ESNEX TECHNOLOGIES</p>
                    <p class="brand-sub">Innovate · Develop · Transform</p>
                  </div>
                </div>

                <div class="title-wrap">
                  <p class="title-label">Certificate of Completion</p>
                  <h1 class="title">CERTIFICATE</h1>
                  <div class="accent-ribbon">
                    <span class="accent-pill">Official ESNEX Training</span>
                  </div>
                </div>

                <div class="cert-body">
                  <p class="subtitle">This is to certify that</p>
                  <p class="student-name">${cert.studentName || "Student Name"}</p>
                  <p class="subtitle">has successfully completed</p>
                  <p class="course-name">${certificateName}</p>
                  <p class="subtitle">under the training program conducted by ESNEX TECHNOLOGIES</p>
                  <div style="display:grid;justify-items:center;gap:8px;margin-top:12px;">
                    <div class="seal"><strong>Verified</strong>Certificate</div>
                    <span style="color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.18em;">Gold Verification Seal</span>
                  </div>
                </div>

                <div class="footer-row">
                  <div class="meta-card">
                    <div class="meta-item">
                      <div class="meta-icon">📅</div>
                      <div>
                        <p class="meta-label">Date Issued</p>
                        <p class="meta-value">${issuedDateText}</p>
                      </div>
                    </div>
                    <div class="meta-item">
                      <div class="meta-icon">🆔</div>
                      <div>
                        <p class="meta-label">Certificate ID</p>
                        <p class="meta-value">${certificateId}</p>
                      </div>
                    </div>
                  </div>

                  <div class="qr-box" style="max-width: 150px; padding: 10px; align-self: end;">
                    <img src="${getCertificateQrUrl(qrPayloadText)}" alt="Certificate QR Code" style="width: 96px; height: 96px; border-radius: 10px;" />
                    <p class="qr-label">Scan to Verify</p>
                    <p class="qr-note">${certificateId}</p>
                  </div>
                </div>
                <div class="footer-strip">🌐 www.esnex.com  •  ✉️ esnextechnologies@gmail.com  •  📍 Latrikunda Sabiji, The Gambia</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${certificateName.replace(/\s+/g, "-")}-${certificateId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dashboardStats = [
    { icon: "📚", label: "Courses Enrolled", value: myCourses.length, color: "#38bdf8" },
    { icon: "📝", label: "Assessments Taken", value: assessmentProgress.filter((item) => ["submitted", "pending-review", "marked", "completed"].includes(item.status)).length, color: "#ec4899" },
    { icon: "✅", label: "In Progress", value: assessmentProgress.filter((item) => item.status === "in-progress").length, color: "#10b981" },
    { icon: "🏆", label: "Certificates Earned", value: certificates.length, color: "#f59e0b" },
  ];

  const getAssessmentDisplayName = (item, fallbackIndex = 1) => {
    if (item?.assessmentName) return item.assessmentName;
    const match = enrolledAssessments.find((assessment) => String(assessment._id) === String(item?.assessmentId));
    if (match?.name) return match.name;
    return item?.selectedPart ? `Assessment - ${item.selectedPart}` : `Assessment ${fallbackIndex}`;
  };

  const upcomingTasks = [
    { title: "Math Assessment", due: "Tomorrow, 10:00 AM", icon: "📐", subject: "Mathematics" },
    { title: "Chemistry Quiz", due: "Friday, 2:00 PM", icon: "🧪", subject: "Chemistry" },
    { title: "Certificate Exam", due: "Next Week", icon: "🎓", subject: "General" },
  ];

  // Learning Progress Analytics Data
  const analyticsData = {
    weeklyStudyTime: [12, 18, 14, 22, 19, 15, 20],
    assessmentsTaken: [2, 3, 2, 4, 3, 5, 4],
    averageScore: 78.5,
    completionPercentage: 65,
  };

  // Render Progress Analytics Section
  const ProgressAnalytics = () => (
    <section className="dashboard-section">
      <h2>Learning Progress</h2>
      <div className="dashboard-analytics-grid">
        {/* Weekly Study Time */}
        <div className="dashboard-analytics-card">
          <div className="analytics-header">
            <h3>Weekly Study Time</h3>
            <span>Hours</span>
          </div>
          <div className="analytics-chart-simple">
            {analyticsData.weeklyStudyTime.map((hours, idx) => (
              <div key={idx} className="chart-bar" style={{ height: `${(hours / 25) * 100}%` }} title={`${hours}h`} />
            ))}
          </div>
          <p className="analytics-subtitle">Average: 16.7 hours/week</p>
        </div>

        {/* Assessments Taken */}
        <div className="dashboard-analytics-card">
          <div className="analytics-header">
            <h3>Assessments Taken</h3>
            <span>Count</span>
          </div>
          <div className="analytics-chart-simple">
            {analyticsData.assessmentsTaken.map((count, idx) => (
              <div key={idx} className="chart-bar" style={{ height: `${(count / 5) * 100}%` }} title={`${count}`} />
            ))}
          </div>
          <p className="analytics-subtitle">Total: 23 assessments</p>
        </div>

        {/* Average Score */}
        <div className="dashboard-analytics-card analytics-score">
          <div className="score-circle">
            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="8" />
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke="url(#scoreGradient)" 
                strokeWidth="8"
                strokeDasharray={`${(analyticsData.averageScore / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="score-text">
              <strong>{analyticsData.averageScore.toFixed(1)}%</strong>
              <span>Avg Score</span>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="dashboard-analytics-card analytics-completion">
          <div className="analytics-header">
            <h3>Overall Progress</h3>
            <span>{analyticsData.completionPercentage}%</span>
          </div>
          <div className="completion-bar">
            <div className="completion-fill" style={{ width: `${analyticsData.completionPercentage}%` }} />
          </div>
          <p className="analytics-subtitle">65% of your planned courses completed</p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="premium-dashboard">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && isMobile && (
        <button
          type="button"
          className="dashboard-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside ref={sidebarRef} className={`dashboard-sidebar ${sidebarOpen ? "dashboard-sidebar--open" : ""}`}>
        <div className="dashboard-sidebar-header">
          <div className="dashboard-brand-icon">E</div>
          <div className="dashboard-brand-text">
            <p>ESNEX</p>
            <p>Learn</p>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="dashboard-sidebar-close"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="dashboard-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.section}
              onClick={() => {
                setActiveView(item.section);
                if (isMobile) setSidebarOpen(false);
              }}
              className={`dashboard-nav-item ${activeView === item.section ? "dashboard-nav-item--active" : ""}`}
            >
              <span className="dashboard-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <button onClick={handleLogout} className="dashboard-logout-btn">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`dashboard-main ${sidebarOpen ? "dashboard-main--sidebar-open" : ""}`}>
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button className="dashboard-sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
              ☰
            </button>
            <div className="dashboard-search-box">
              <span>🔍</span>
              <label htmlFor="dashboard-search-input" className="sr-only">Search courses and assessments</label>
              <input id="dashboard-search-input" aria-label="Search courses and assessments" type="text" placeholder="Search courses, assessments..." />
            </div>
          </div>

          <div className="dashboard-topbar-right">
            <button 
              className="dashboard-icon-btn" 
              title="Messages"
              onClick={() => navigate("/messages")}
            >
              <span>🔔</span>
              {unreadCount > 0 && (
                <span className="dashboard-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <button onClick={toggleTheme} className="dashboard-icon-btn" title="Toggle theme">
              {isDark ? "☀️" : "🌙"}
            </button>
            <div className="dashboard-user-menu" onClick={toggleSidebar} style={{ cursor: "pointer" }}>
              <img src={`https://i.pravatar.cc/150?u=${userName}`} alt={userName} />
              <div>
                <p>{userName}</p>
                <span>Learner</span>
              </div>
              <span>▼</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Welcome Banner */}
          {activeView === "home" && (
            <>
              <section className="dashboard-welcome-banner">
                <div className="dashboard-welcome-content">
                  <h1>Welcome back, {userName}! 👋</h1>
                  <p>Continue learning and track your progress towards your goals.</p>
                  <div className="dashboard-welcome-stats">
                    <div className="dashboard-welcome-stat">
                      <strong>🔥 {streak}</strong>
                      <span>Day Streak</span>
                    </div>
                    <div className="dashboard-welcome-stat">
                      <strong>📋 {pendingAssessments}</strong>
                      <span>Pending Assessments</span>
                    </div>
                    <div className="dashboard-welcome-stat">
                      <strong>🏆 {certificates.length}</strong>
                      <span>Certificates Earned</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={handleContinueToFirstCourse}>Continue Learning</button>
                </div>
              </section>

              {/* Stats Cards */}
              <section className="dashboard-stats-section">
                <h2>Your Learning Stats</h2>
                <div className="dashboard-stats-grid">
                  {dashboardStats.map((stat) => (
                    <div key={stat.label} className="dashboard-stat-card">
                      <div className="dashboard-stat-icon-wrapper" style={{ background: `${stat.color}20` }}>
                        <span>{stat.icon}</span>
                      </div>
                      <div className="dashboard-stat-content">
                        <strong>{stat.value}</strong>
                        <p>{stat.label}</p>
                      </div>
                      <div className="dashboard-stat-progress">
                        <div className="dashboard-stat-progress-bar"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* My Courses */}
              <section className="dashboard-section">
                <div className="dashboard-section-header">
                  <h2>My Courses</h2>
                  <Link onClick={() => setActiveView("courses")} className="dashboard-view-all">View All →</Link>
                </div>
                <div className="dashboard-courses-grid">
                  {myCourses.slice(0, 3).map((course, idx) => (
                    <div key={idx} className="dashboard-course-card">
                      <div className="dashboard-course-image">
                        {course.course?.title?.charAt(0) || "C"}
                      </div>
                      <h3>{course.course?.title || `Course ${idx + 1}`}</h3>
                      <p className="dashboard-course-instructor">by Expert Instructor</p>
                      <div className="dashboard-progress-bar">
                        <div className="dashboard-progress-fill" style={{ width: `${40 + idx * 15}%` }}></div>
                      </div>
                      <p className="dashboard-progress-text">{40 + idx * 15}% complete</p>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleContinueLearning(course)}>Continue →</button>
                    </div>
                  ))}
                  {myCourses.length === 0 && (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--dashboard-text-muted)" }}>
                      <p>No courses enrolled yet. <Link to="/courses" style={{ color: "var(--dashboard-accent-bright)" }}>Browse courses</Link></p>
                    </div>
                  )}
                </div>
              </section>

              {/* Recent Assessments */}
              <section className="dashboard-section">
                <div className="dashboard-section-header">
                  <h2>Recent Assessments</h2>
                  <Link onClick={() => setActiveView("assessments")} className="dashboard-view-all">View All →</Link>
                </div>
                <div className="dashboard-assessments-list">
                  {assessmentSummaries.length > 0 ? assessmentSummaries.slice(0, 4).map((item, idx) => (
                    <div key={item.assessmentId || idx} className="dashboard-assessment-item">
                      <div className="dashboard-assessment-left">
                        <div className="dashboard-assessment-icon">📝</div>
                        <div>
                          <h4>{item.assessmentName || "Assessment"}</h4>
                          <p>{item.attemptCount} {item.attemptCount === 1 ? "attempt" : "attempts"} • Avg score {Math.round(Number(item.averageScore || 0))}%</p>
                        </div>
                      </div>
                      <div className="dashboard-assessment-score">
                        <strong>{Math.round(Number(item.averageScore || 0))}%</strong>
                        <span className="dashboard-badge-success">Summary</span>
                      </div>
                    </div>
                  )) : assessmentProgress.length > 0 ? assessmentProgress.slice(0, 4).map((item, idx) => {
                    const status = item.status === "in-progress" ? "In progress" : item.status === "submitted" ? "Submitted" : item.status === "pending-review" ? "Pending review" : item.status === "marked" ? "Marked" : "Completed";
                    return (
                      <div key={item._id || idx} className="dashboard-assessment-item">
                        <div className="dashboard-assessment-left">
                          <div className="dashboard-assessment-icon">📝</div>
                          <div>
                            <h4>{getAssessmentDisplayName(item, idx + 1)}</h4>
                            <p>{status} • {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "Recent"}</p>
                          </div>
                        </div>
                        <div className="dashboard-assessment-score">
                          <strong>{Math.round(Number(item.percentage || 0))}%</strong>
                          <span className={item.status === "in-progress" ? "dashboard-badge" : "dashboard-badge-success"}>{status}</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--dashboard-text-muted)" }}>
                      <p>No assessments taken yet</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Completed Courses & Upcoming Tasks */}
              <div className="dashboard-grid-two">
                {/* Completed Courses */}
                <section className="dashboard-section">
                  <div className="dashboard-section-header">
                    <h2>Completed Courses</h2>
                  </div>
                  <div className="dashboard-completed-grid">
                    {myCourses.slice(0, 2).map((course, idx) => (
                      <div key={idx} className="dashboard-completed-card">
                        <div className="dashboard-completed-badge">✔</div>
                        <h4>{course.course?.title || `Course ${idx + 1}`}</h4>
                        <p>Completed on May 5, 2025</p>
                        <button className="btn btn-ghost btn-sm">View Certificate</button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Upcoming Tasks */}
                <section className="dashboard-section">
                  <div className="dashboard-section-header">
                    <h2>Upcoming Tasks</h2>
                  </div>
                  <div className="dashboard-tasks-list">
                    {upcomingTasks.map((task, idx) => (
                      <div key={idx} className="dashboard-task-item">
                        <span className="dashboard-task-icon">{task.icon}</span>
                        <div className="dashboard-task-content">
                          <h4>{task.title}</h4>
                          <p>{task.due}</p>
                        </div>
                        <button className="btn btn-primary btn-xs">Start Now</button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Progress Analytics */}
              <ProgressAnalytics />
            </>
          )}

          {/* Certificates View */}
          {activeView === "certificates" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>My Certificates</h2>
                <p>Your earned certifications and achievements.</p>
              </div>
              <div className="dashboard-certificates-grid">
                {certificates.map((cert) => {
                  const issuedDate = cert.issuedDate
                    ? new Date(cert.issuedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "";
                  return (
                    <div key={cert._id} className="dashboard-certificate-card">
                      <span className="dashboard-certificate-badge">Verified</span>
                      <div className="dashboard-certificate-preview">🎓</div>
                      <p className="dashboard-certificate-label">Certificate of Completion</p>
                      <h3>{cert.courseName || cert.title || "Certificate"}</h3>
                      <p className="dashboard-certificate-date">Issued on {issuedDate}</p>
                      <p className="dashboard-certificate-id">ID: {cert.certificateId || cert.verificationId}</p>
                      <p className="dashboard-certificate-status">✓ {cert.status || "Valid"}</p>
                      <div className="dashboard-certificate-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/verify-certificate/${encodeURIComponent(cert.certificateId || cert.verificationId)}`)}>
                          View
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => downloadCertificate(cert)}>
                          ⬇ Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* My Courses View - Full */}
          {activeView === "courses" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>My Enrolled Courses</h2>
                <p>All courses you are currently enrolled in.</p>
              </div>
              <div className="dashboard-courses-grid">
                {myCourses.length > 0 ? myCourses.map((course, idx) => (
                  <div key={idx} className="dashboard-course-card">
                    <div className="dashboard-course-image">
                      {course.course?.title?.charAt(0) || "C"}
                    </div>
                    <h3>{course.course?.title || `Course ${idx + 1}`}</h3>
                    <p className="dashboard-course-instructor">by Expert Instructor</p>
                    <div className="dashboard-progress-bar">
                      <div className="dashboard-progress-fill" style={{ width: `${Math.random() * 80 + 20}%` }}></div>
                    </div>
                    <p className="dashboard-progress-text">{Math.floor(Math.random() * 80 + 20)}% complete</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleContinueLearning(course)}>Continue →</button>
                  </div>
                )) : (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "var(--dashboard-text-muted)" }}>
                    <p style={{ fontSize: "16px" }}>No courses enrolled yet</p>
                    <Link to="/courses" className="btn btn-primary" style={{ marginTop: "12px" }}>Browse Courses</Link>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Assessments View */}
          {activeView === "assessments" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Your Enrolled Assessments</h2>
                <p>Only assessments you have access to will appear here.</p>
              </div>
              <div className="dashboard-assessments-list">
                {enrolledAssessments.length > 0 ? (
                  enrolledAssessments.map((assessment, idx) => (
                    <div key={idx} className="dashboard-assessment-item">
                      <div className="dashboard-assessment-left">
                        <div className="dashboard-assessment-icon">{assessment.icon}</div>
                        <div>
                          <h4>{assessment.name}</h4>
                          <p>{assessment.questions} Questions • {assessment.duration} minutes</p>
                        </div>
                      </div>
                      <Link to={`/assessment/${assessment._id}`} className="btn btn-primary btn-sm">
                        Start Assessment
                      </Link>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--dashboard-text-muted)" }}>
                    <p style={{ marginBottom: "16px", fontSize: "16px" }}>You have no enrolled assessments yet.</p>
                    <Link to="/assessments" className="btn btn-primary">
                      Browse Assessments
                    </Link>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Results View */}
          {activeView === "results" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Your Assessment Results</h2>
                <p>Review your past assessment performance.</p>
              </div>
              <div className="dashboard-results-table">
                <div className="dashboard-results-header">
                  <span>Assessment</span>
                  <span>Score</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                {assessmentProgress.length > 0 ? assessmentProgress.slice(0, 5).map((item, idx) => (
                  <div key={item._id || idx} className="dashboard-results-row">
                    <span className="dashboard-results-cell">{getAssessmentDisplayName(item, idx + 1)}</span>
                    <span className="dashboard-results-cell">{Math.round(Number(item.percentage || 0))}%</span>
                    <span className="dashboard-results-cell">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "N/A")}</span>
                    <span className="dashboard-results-cell">
                      <span className={item.status === "in-progress" ? "dashboard-badge" : "dashboard-badge-success"}>{item.status === "in-progress" ? "In Progress" : "Completed"}</span>
                    </span>
                    <span className="dashboard-results-cell">
                      <button className="btn btn-ghost btn-xs" onClick={() => navigate(item.assessmentId ? `/assessment/${item.assessmentId}` : "/assessments")}>Review</button>
                    </span>
                  </div>
                )) : (
                  <div style={{ padding: "30px", textAlign: "center", color: "var(--dashboard-text-muted)", gridColumn: "1 / -1" }}>
                    <p>No results yet</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Settings View */}
          {activeView === "settings" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Account Settings</h2>
                <p>Change your password or request a reset PIN if you forget it.</p>
              </div>
              <div className="dashboard-settings-grid" style={{ display: "grid", gap: "1.5rem" }}>
                <div className="dashboard-settings-card" style={{ padding: "1.75rem", borderRadius: "1rem", background: "#ffffff", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)" }}>
                  <h3 style={{ marginBottom: "1rem" }}>Change Password</h3>
                  <p style={{ marginBottom: "1.5rem", color: "#475569" }}>
                    Enter your current password and choose a strong new password.
                  </p>
                  <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: "1rem" }}>
                    <label style={{ display: "grid", gap: "0.5rem" }}>
                      Current Password
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        style={{ padding: "0.9rem 1rem", borderRadius: "0.85rem", border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.5rem" }}>
                      New Password
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        style={{ padding: "0.9rem 1rem", borderRadius: "0.85rem", border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.5rem" }}>
                      Confirm New Password
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                        style={{ padding: "0.9rem 1rem", borderRadius: "0.85rem", border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={passwordChangeLoading}>
                      {passwordChangeLoading ? "Saving..." : "Save Password"}
                    </button>
                    {passwordChangeMessage && (
                      <p style={{ margin: 0, color: passwordChangeMessage.includes("success") ? "#16a34a" : "#dc2626" }}>
                        {passwordChangeMessage}
                      </p>
                    )}
                  </form>
                </div>

                <div className="dashboard-settings-card" style={{ padding: "1.75rem", borderRadius: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ marginBottom: "1rem" }}>Forgot Password?</h3>
                  <p style={{ marginBottom: "1.5rem", color: "#475569" }}>
                    Request a password reset PIN if you cannot remember your current password.
                  </p>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <div style={{ color: "#334155" }}>
                      <strong>Email</strong>
                      <p style={{ margin: 0, color: "#64748b" }}>{userEmail || "Not available"}</p>
                    </div>
                    <Link to="/forgot-password" className="btn btn-secondary btn-sm" style={{ width: "fit-content" }}>
                      Request Reset PIN
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Messages / Inbox View */}
          {activeView === "messages" && (
            <section className="dashboard-section">
              <div className="dashboard-section-header">
                <h2>Messages</h2>
                <p>Your notifications and announcements.</p>
              </div>
              <div className="dashboard-message-list">
                {notificationsList.length === 0 ? (
                  <div className="dashboard-message-empty">No messages yet.</div>
                ) : (
                  notificationsList.map((n, i) => (
                    <article
                      key={i}
                      className={`dashboard-message-card ${n.isRead ? '' : 'unread'}`}
                      onClick={() => markNotificationRead(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          markNotificationRead(i);
                        }
                      }}
                    >
                      <div className="dashboard-message-card-main">
                        <div className="dashboard-message-card-body">
                          <div className="dashboard-message-card-title-row">
                            <h3>{n.title || 'Notification'}</h3>
                            {!n.isRead && <span className="dashboard-message-unread-dot" aria-label="Unread message" />}
                          </div>
                          <p>{n.message}</p>
                        </div>
                        <div className="dashboard-message-card-meta">
                          <small>{n.sentAt ? new Date(n.sentAt).toLocaleString() : ''}</small>
                          <span className={`dashboard-message-badge ${n.priority === 'High' ? 'high' : 'normal'}`}>
                            {n.priority === 'High' ? 'High Priority' : 'Alert'}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Progress View */}
          {activeView === "progress" && (
            <UserProgress compact />
          )}

          {/* Quiz View */}
          {activeView === "quiz" && (
            <section className="dashboard-section">
              <h2>Practice Quizzes</h2>
              <div className="dashboard-grid">
                {quizzes.length > 0 ? quizzes.map((quiz) => (
                  <div key={quiz._id} className="dashboard-card" style={{ cursor: "pointer" }} onClick={() => navigate(`/quiz/${quiz._id}`)}>
                    <div className="card-header">
                      <h3>{quiz.title}</h3>
                      <span className="card-badge">{quiz.quizCategory}</span>
                    </div>
                    <p className="card-description">{quiz.description}</p>
                    <div className="card-meta">
                      <span>Duration: {quiz.duration} min</span>
                      <span>Questions: {quiz.questionsCount}</span>
                      <span>Total Marks: {quiz.totalMarks}</span>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: "30px", textAlign: "center", color: "var(--dashboard-text-muted)", gridColumn: "1 / -1" }}>
                    <p>No quizzes available yet</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="dashboard-mobile-nav">
          <button onClick={() => setActiveView("home")} className={activeView === "home" ? "active" : ""}>
            <span>🏠</span>
            <small>Home</small>
          </button>
          <button onClick={() => setActiveView("courses")} className={activeView === "courses" ? "active" : ""}>
            <span>📚</span>
            <small>Courses</small>
          </button>
          <button onClick={() => setActiveView("assessments")} className={activeView === "assessments" ? "active" : ""}>
            <span>📝</span>
            <small>Assess</small>
          </button>
          <button onClick={() => setActiveView("certificates")} className={activeView === "certificates" ? "active" : ""}>
            <span>🏆</span>
            <small>Certs</small>
          </button>
          <button onClick={() => setActiveView("settings")} className={activeView === "settings" ? "active" : ""}>
            <span>⚙️</span>
            <small>Settings</small>
          </button>
        </nav>
      )}
    </div>
  );
}
