import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import AssessmentCard from "../components/AssessmentCard";

const defaultPrices = {
  python: 1200,
  react: 2500,
  javascript: 1400,
  node: 2200,
  uiux: 2800,
  aws: 2000,
  security: 1800,
  marketing: 2300,
};

export default function Quiz() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedDuration, setSelectedDuration] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [assessmentStatuses, setAssessmentStatuses] = useState({});

  const categories = ["all", "Programming", "Frontend", "Cloud", "Security", "Design"];
  const levels = ["all", "Beginner", "Intermediate", "Advanced"];
  const durations = ["all", "Under 30", "30 - 60", "60+"];

  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        const res = await API.get("/quizzes");
        setQuizzes(res.data.quizzes || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load quizzes");
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, []);

  const enrichQuiz = (quiz) => {
    const title = quiz.title?.toLowerCase() || "";
    let category = "Programming";
    let level = "Intermediate";
    let price = 1800;
    let icon = "📝";

    if (title.includes("python")) {
      category = "Programming";
      level = "Beginner";
      price = defaultPrices.python;
      icon = "🐍";
    } else if (title.includes("react")) {
      category = "Frontend";
      level = "Intermediate";
      price = defaultPrices.react;
      icon = "⚛️";
    } else if (title.includes("javascript")) {
      category = "Frontend";
      level = "Beginner";
      price = defaultPrices.javascript;
      icon = "🟨";
    } else if (title.includes("node")) {
      category = "Programming";
      level = "Intermediate";
      price = defaultPrices.node;
      icon = "🟩";
    } else if (title.includes("ui") || title.includes("ux")) {
      category = "Design";
      level = "Intermediate";
      price = defaultPrices.uiux;
      icon = "🎨";
    } else if (title.includes("aws")) {
      category = "Cloud";
      level = "Beginner";
      price = defaultPrices.aws;
      icon = "☁️";
    } else if (title.includes("security") || title.includes("cyber")) {
      category = "Security";
      level = "Intermediate";
      price = defaultPrices.security;
      icon = "🔒";
    } else if (title.includes("marketing")) {
      category = "Design";
      level = "Beginner";
      price = defaultPrices.marketing;
      icon = "📈";
    }

    const duration = quiz.duration || 30;
    const locked = title.includes("security") || title.includes("advanced");
    return { ...quiz, category, level, price, icon, duration, locked };
  };

  const enrichedQuizzes = quizzes.map(enrichQuiz);

  const quizzesWithStatus = useMemo(
    () => enrichedQuizzes.map((quiz) => ({
      ...quiz,
      ...assessmentStatuses[quiz._id],
    })),
    [enrichedQuizzes, assessmentStatuses]
  );

  const filteredQuizzes = quizzesWithStatus
    .filter((quiz) => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = quiz.title.toLowerCase().includes(query) || quiz.description?.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === "all" || quiz.category === selectedCategory;
      const matchesLevel = selectedLevel === "all" || quiz.level === selectedLevel;
      const matchesDuration =
        selectedDuration === "all" ||
        (selectedDuration === "Under 30" && quiz.duration < 30) ||
        (selectedDuration === "30 - 60" && quiz.duration >= 30 && quiz.duration <= 60) ||
        (selectedDuration === "60+" && quiz.duration > 60);

      return matchesSearch && matchesCategory && matchesLevel && matchesDuration;
    })
    .sort((a, b) => {
      if (sortBy === "popular") return (b.questions.length || 0) - (a.questions.length || 0);
      if (sortBy === "newest") return new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now());
      if (sortBy === "duration") return a.duration - b.duration;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedQuizzes = filteredQuizzes.slice(startIndex, startIndex + itemsPerPage);

  const enrolledCount = filteredQuizzes.filter((quiz) => quiz.enrolled).length;
  const completedCount = filteredQuizzes.filter((quiz) => quiz.completed).length;
  const lockedCount = filteredQuizzes.filter((quiz) => quiz.locked && !quiz.enrolled).length;
  const availableForEnrollment = filteredQuizzes.filter((quiz) => !quiz.enrolled).length;

  const updateAssessmentStatus = (id, updates) => {
    setAssessmentStatuses((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates,
      },
    }));
  };

  return (
    <div className="assessments-page">
      <section className="assessments-hero">
        <div>
          <div className="hero-label">Available Assessments</div>
          <h1>Choose the best assessment, enroll, then start right away.</h1>
          <p>Find the perfect quiz by category, level, or duration. Enroll in one click and track your progress instantly.</p>
        </div>
        <div className="hero-cta">
          <div className="hero-stats">
            <span>{filteredQuizzes.length}</span>
            <p>assessments</p>
          </div>
          <Link className="topbar-button" to="/register">
            Register Now
          </Link>
        </div>
      </section>

      <section className="assessments-controls">
        <div className="assessment-search">
          <input
            type="text"
            placeholder="Search by title, subject, or category..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="assessment-filters">
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Levels</option>
            {levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select value={selectedDuration} onChange={(e) => { setSelectedDuration(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Durations</option>
            {durations.map((duration) => (
              <option key={duration} value={duration}>{duration}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="popular">Popular</option>
            <option value="newest">Newest</option>
            <option value="duration">Duration</option>
          </select>
        </div>
      </section>

      <section className="assessments-cards-grid">
        {loading ? (
          <div className="assessments-empty-state">Loading assessments...</div>
        ) : error ? (
          <div className="assessments-empty-state assessments-error">{error}</div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="assessments-empty-state">No assessments match your filters.</div>
        ) : (
          paginatedQuizzes.map((quiz) => (
            <AssessmentCard key={quiz._id} assessment={quiz} onStatusChange={updateAssessmentStatus} />
          ))
        )}
      </section>

      <div className="assessments-footer-row">
        <div className="assessments-pagination">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button key={page} onClick={() => setCurrentPage(page)} className={page === currentPage ? "active" : ""}>
              {page}
            </button>
          ))}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
            ›
          </button>
        </div>
        <div className="assessments-summary">
          <p>{filteredQuizzes.length} assessments available</p>
          <p>{availableForEnrollment} awaiting enrollment</p>
          {lockedCount > 0 && <p>{lockedCount} locked assessments</p>}
        </div>
      </div>

      <section className="assessments-bottom-banner">
        <div>
          <h3>Don't have an account?</h3>
          <p>Register now to track your progress, earn certificates, and access all features.</p>
        </div>
        <Link className="banner-button" to="/register">
          Enroll Now
        </Link>
      </section>
    </div>
  );
}
