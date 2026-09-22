import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import "../styles/student-dashboard.css";

const getCourseId = (course) => course?.courseId || course?.course?._id || course?.course || null;

export default function UserProgress({ compact = false }) {
  const [courseProgress, setCourseProgress] = useState([]);
  const [assessmentProgress, setAssessmentProgress] = useState([]);
  const [assessmentSummary, setAssessmentSummary] = useState({ totalAttempts: 0, inProgressCount: 0, completedCount: 0, averageScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      try {
        setLoading(true);

        const [coursesRes, assessmentRes] = await Promise.all([
          API.get("/enrollments/my-courses").catch(() => ({ data: [] })),
          API.get("/assessments/student/progress").catch(() => ({ data: { success: true, progress: [], assessmentSummaries: [] } })),
        ]);

        if (cancelled) return;

        const courseList = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const resolvedCourseProgress = await Promise.all(
          courseList.map(async (course) => {
            const courseId = getCourseId(course);
            if (!courseId) {
              return {
                courseId: null,
                title: course?.course?.title || "Course",
                progress: { completedLessons: [], percentage: 0 },
                totalLessons: 0,
                completedCount: 0,
                completed: false,
              };
            }

            try {
              const { data } = await API.get(`/progress/${courseId}`);
              return {
                ...data,
                courseId,
                title: course?.course?.title || data?.courseTitle || "Course",
              };
            } catch (error) {
              return {
                enrolled: false,
                courseId,
                title: course?.course?.title || "Course",
                progress: { completedLessons: [], percentage: 0 },
                totalLessons: 0,
                completedCount: 0,
                completed: false,
              };
            }
          })
        );

        setCourseProgress(resolvedCourseProgress);
        setAssessmentProgress(Array.isArray(assessmentRes.data?.progress) ? assessmentRes.data.progress : []);
        setAssessmentSummary(assessmentRes.data?.summary || { totalAttempts: 0, inProgressCount: 0, completedCount: 0, averageScore: 0 });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, []);

  const courseStats = useMemo(() => {
    const activeEntries = courseProgress.filter((item) => Number(item.totalLessons || 0) > 0 || Number(item.progress?.percentage || 0) > 0);

    const averageCourseProgress = activeEntries.length
      ? Math.round(activeEntries.reduce((total, item) => total + Number(item.progress?.percentage ?? item.percentage ?? 0), 0) / activeEntries.length)
      : 0;

    const completedCourses = activeEntries.filter((item) => item.completed || (Number(item.totalLessons || 0) > 0 && Number(item.completedCount || 0) >= Number(item.totalLessons || 0))).length;
    const inProgressCourses = activeEntries.filter((item) => !item.completed && Number(item.progress?.percentage || 0) > 0).length;

    return {
      averageCourseProgress,
      completedCourses,
      inProgressCourses,
      totalCourses: activeEntries.length,
    };
  }, [courseProgress]);

  const assessmentAverage = useMemo(() => {
    if (typeof assessmentSummary?.averageScore === "number" && !Number.isNaN(assessmentSummary.averageScore)) {
      return Math.round(assessmentSummary.averageScore);
    }
    if (!assessmentProgress.length) return 0;
    const total = assessmentProgress.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
    return Math.round(total / assessmentProgress.length);
  }, [assessmentProgress, assessmentSummary]);

  const assessmentStats = useMemo(() => ({
    totalTaken: Number(assessmentSummary?.totalAttempts ?? assessmentProgress.length ?? 0),
    inProgress: Number(assessmentSummary?.inProgressCount ?? assessmentProgress.filter((item) => item.status === "in-progress").length ?? 0),
    completed: Number(assessmentSummary?.completedCount ?? assessmentProgress.filter((item) => ["submitted", "pending-review", "marked", "completed"].includes(item.status)).length ?? 0),
    averageScore: assessmentAverage,
  }), [assessmentAverage, assessmentProgress, assessmentSummary]);

  if (loading) {
    return (
      <section className="dashboard-section" style={{ minHeight: compact ? "220px" : "320px", display: "grid", placeItems: "center" }}>
        <div className="dashboard-message-empty">Loading your progress...</div>
      </section>
    );
  }

  const wrapperClass = compact ? "dashboard-section" : "dashboard-content";

  return (
    <div className={wrapperClass} style={compact ? {} : { maxWidth: "1200px", margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <section className="dashboard-section" style={{ marginBottom: "1.5rem" }}>
        <div className="dashboard-section-header">
          <h2>User Progress</h2>
          <Link to="/courses" className="dashboard-view-all">Browse courses →</Link>
        </div>

        <div className="dashboard-stats-grid">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#38bdf820" }}>
              <span>📚</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{courseStats.totalCourses}</strong>
              <p>Active Courses</p>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#10b98120" }}>
              <span>✅</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{courseStats.averageCourseProgress}%</strong>
              <p>Course Completion</p>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#f59e0b20" }}>
              <span>🏆</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{courseStats.completedCourses}</strong>
              <p>Completed</p>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#8b5cf620" }}>
              <span>📝</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{assessmentStats.totalTaken}</strong>
              <p>Assessments Taken</p>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#f97316" }}>
              <span>📊</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{assessmentStats.averageScore}%</strong>
              <p>Avg. Score</p>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section" style={{ marginBottom: "1.5rem" }}>
        <div className="dashboard-section-header">
          <h2>Course Progress</h2>
          <span className="dashboard-badge-success">{courseStats.inProgressCourses} active</span>
        </div>

        <div className="dashboard-courses-grid">
          {courseProgress.length > 0 ? courseProgress.map((item, idx) => {
            const percent = Number(item.progress?.percentage ?? item.percentage ?? 0);
            const totalLessons = Number(item.totalLessons || 0);
            const completedCount = Number(item.completedCount || item.progress?.completedLessons?.length || 0);

            return (
              <div key={item.courseId || idx} className="dashboard-course-card">
                <div className="dashboard-course-image">{(item.title || "C").charAt(0).toUpperCase()}</div>
                <h3>{item.title || `Course ${idx + 1}`}</h3>
                <p className="dashboard-course-instructor">{totalLessons ? `${completedCount}/${totalLessons} lessons completed` : "Progress tracking enabled"}</p>
                <div className="dashboard-progress-bar">
                  <div className="dashboard-progress-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="dashboard-progress-text">{percent}% complete</p>
                <Link to={item.courseId ? `/course/${item.courseId}` : "/courses"} className="btn btn-secondary btn-sm">
                  Continue →
                </Link>
              </div>
            );
          }) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", color: "var(--dashboard-text-muted)" }}>
              <p>No course progress available yet.</p>
              <Link to="/courses" className="btn btn-primary" style={{ marginTop: "12px" }}>Explore courses</Link>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Assessment Progress</h2>
          <Link to="/assessments" className="dashboard-view-all">View assessments →</Link>
        </div>

        <div className="dashboard-stats-grid" style={{ marginBottom: "1.25rem" }}>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#10b98120" }}>
              <span>✅</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{assessmentStats.completed}</strong>
              <p>Completed</p>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon-wrapper" style={{ background: "#60a5fa20" }}>
              <span>⏳</span>
            </div>
            <div className="dashboard-stat-content">
              <strong>{assessmentStats.inProgress}</strong>
              <p>In Progress</p>
            </div>
          </div>
        </div>

        <div className="dashboard-assessments-list">
          {assessmentProgress.length > 0 ? assessmentProgress.slice(0, 6).map((item, idx) => {
            const isExpiredStatus = item.status === "expired" || item.accessExpired || item.subscriptionStatus === "expired" || item.status === "cancelled";
            const statusText = isExpiredStatus
              ? "Access ended"
              : item.status === "in-progress"
                ? "In progress"
                : item.status === "submitted"
                  ? "Submitted"
                  : item.status === "pending-review"
                    ? "Pending review"
                    : item.status === "marked"
                      ? "Marked"
                      : "Recent attempt";

            return (
              <div key={item._id || idx} className="dashboard-assessment-item">
                <div className="dashboard-assessment-left">
                  <div className="dashboard-assessment-icon">📝</div>
                  <div>
                    <h4>{item.assessmentName || "Assessment"}</h4>
                    <p>
                      {statusText}
                      {item.updatedAt ? ` • ${new Date(item.updatedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="dashboard-assessment-score">
                  <strong>{isExpiredStatus ? "—" : `${Math.round(Number(item.percentage || 0))}%`}</strong>
                  <span className={isExpiredStatus ? "dashboard-badge dashboard-badge-danger" : (item.status === "in-progress" ? "dashboard-badge" : "dashboard-badge-success")}>{isExpiredStatus ? "Expired" : (item.status === "in-progress" ? "Active" : "Done")}</span>
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--dashboard-text-muted)" }}>
              <p>No assessment activity yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
