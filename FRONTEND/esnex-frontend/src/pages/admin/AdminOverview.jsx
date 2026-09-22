import { useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useWindowSize } from "./adminUtils";

export default function AdminOverview() {
  const { width: windowWidth } = useWindowSize();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth < 1024;

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [coursesRes, quizzesRes, usersRes] = await Promise.all([
        API.get("/courses").catch(() => ({ data: { courses: [] } })),
        API.get("/quizzes").catch(() => ({ data: { quizzes: [] } })),
        API.get("/auth/users").catch(() => ({ data: { users: [] } })),
      ]);

      setCourses(coursesRes.data.courses || []);
      setQuizzes(quizzesRes.data.quizzes || []);
      setUsers(usersRes.data.users || []);
      setAttempts([
        { _id: "a1", student: { name: "Sainey Badjie" }, quiz: { title: "Math Quiz 1" }, score: 50, total: 50, status: "submitted", createdAt: new Date() },
        { _id: "a2", student: { name: "John Doe" }, quiz: { title: "Science Quiz 1" }, score: 48, total: 50, status: "submitted", createdAt: new Date() },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const userCount = users.length;
  const courseCount = courses.length;
  const assessmentCount = quizzes.length;
  const attemptCount = attempts.length;
  const certificateCount = attempts.filter((attempt) => attempt.score >= 50).length;
  const completionRate = attemptCount ? Math.round((attempts.filter((attempt) => attempt.status === "submitted").length / attemptCount) * 100) : 0;

  const recentUsers = users.slice(0, 5);
  const recentAttempts = attempts.slice(0, 5);

  const stats = [
    { label: "Users", value: userCount, detail: "Active users" },
    { label: "Courses", value: courseCount, detail: "Live courses" },
    { label: "Assessments", value: assessmentCount, detail: "Available quizzes" },
    { label: "Attempts", value: attemptCount, detail: "Exam attempts" },
    { label: "Certificates", value: certificateCount, detail: "Qualified completions" },
    { label: "Completion", value: `${completionRate}%`, detail: "Submission rate" },
  ];

  if (loading) {
    return <div style={{ padding: "2rem", color: "#94a3b8" }}>Loading overview...</div>;
  }

  return (
    <div style={{ padding: isMobile ? "1rem" : isTablet ? "1.5rem" : "2rem" }}>
      <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)" }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.25rem", color: "#e2e8f0" }}>
            <p style={{ margin: 0, fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#94a3b8" }}>{stat.label}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: isMobile ? "1.5rem" : "2rem", fontWeight: 700 }}>{stat.value}</p>
            <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.75rem" : "0.85rem" }}>{stat.detail}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: isMobile ? "1rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "2fr 1fr", marginTop: isMobile ? "1rem" : "1.5rem" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.25rem", color: "#e2e8f0" }}>User snapshot</h2>
          <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Recent accounts and enrolment totals.</p>
          <div style={{ display: "grid", gap: isMobile ? "0.5rem" : "0.75rem" }}>
            {recentUsers.map((user) => (
              <div key={user._id} style={{ borderRadius: "1rem", backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? "0.75rem" : "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#fff", fontWeight: 600, fontSize: isMobile ? "0.9rem" : "1rem" }}>{user.name}</p>
                  <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.8rem" : "0.9rem", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <span style={{ color: "#bfdbfe", fontSize: isMobile ? "0.75rem" : "0.85rem", backgroundColor: "rgba(59,130,246,0.12)", padding: "0.25rem 0.5rem", borderRadius: "999px" }}>{user.enrolledCourses || 0} enrolled</span>
                    <span style={{ color: "#bbf7d0", fontSize: isMobile ? "0.75rem" : "0.85rem", backgroundColor: "rgba(34,197,94,0.12)", padding: "0.25rem 0.5rem", borderRadius: "999px" }}>{user.completedAssessments || 0} assessments</span>
                  </div>
                </div>
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: isMobile ? "0.8rem" : "0.95rem", marginLeft: "0.5rem" }}>{user.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.25rem", color: "#e2e8f0" }}>Recent Attempts</h2>
          <div style={{ marginTop: "1rem", display: "grid", gap: isMobile ? "0.5rem" : "0.75rem" }}>
            {recentAttempts.map((attempt) => (
              <div key={attempt._id} style={{ borderRadius: "1rem", backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? "0.75rem" : "1rem" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#fff", fontSize: isMobile ? "0.9rem" : "1rem" }}>{attempt.quiz?.title || "Unknown quiz"}</p>
                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>{attempt.student?.name || "Unknown student"} • {attempt.status}</p>
                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.75rem" : "0.9rem" }}>Score: {attempt.score ?? 0}/{attempt.total ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
