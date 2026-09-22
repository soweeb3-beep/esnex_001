import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const subjectIcons = {
  maths: "📐",
  mathematics: "📐",
  english: "📖",
  ict: "💻",
  "information & communication technology": "💻",
  science: "🧪",
  history: "📚",
  geography: "🗺️",
  physics: "⚛️",
  chemistry: "🧬",
  biology: "🔬",
  programming: "🐍",
  "web development": "🌐",
  javascript: "🟨",
  react: "⚛️",
  python: "🐍",
  java: "☕",
  sql: "🗄️",
  "c#": "C#",
  typescript: "📘",
  angular: "🔴",
  html: "🔧",
  css: "🎨",
  git: "🔀",
  default: "📝",
};

const getSubjectGradient = (subject) => {
  const subjectLower = subject?.toLowerCase() || "";
  if (subjectLower.includes("maths") || subjectLower.includes("math")) return "from-purple-600 to-blue-600";
  if (subjectLower.includes("english")) return "from-blue-600 to-cyan-600";
  if (subjectLower.includes("ict") || subjectLower.includes("technology")) return "from-indigo-600 to-blue-600";
  if (subjectLower.includes("python")) return "from-yellow-600 to-blue-600";
  if (subjectLower.includes("javascript")) return "from-yellow-500 to-orange-600";
  if (subjectLower.includes("react")) return "from-cyan-500 to-blue-600";
  if (subjectLower.includes("sql")) return "from-orange-600 to-red-600";
  if (subjectLower.includes("java")) return "from-red-600 to-orange-600";
  return "from-blue-600 to-purple-600";
};

const countQuestions = (assessment) => {
  if (!assessment?.parts || !Array.isArray(assessment.parts) || assessment.parts.length === 0) {
    return assessment.totalQuestions || assessment.totalMarks || 0;
  }

  return assessment.parts.reduce((partTotal, part) => {
    if (!part?.sections || !Array.isArray(part.sections)) {
      return partTotal;
    }
    return partTotal + part.sections.reduce((sectionTotal, section) => sectionTotal + (Number(section.questionCount) || 0), 0);
  }, 0);
};

export default function AssessmentCard({ assessment, onStatusChange, viewType = "grid", assessmentType = "quiz" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(assessment.completed || false);

  const enrolled = assessment.enrolled || assessment.isEnrolledAssessment;
  const isCompleted = completed;
  const icon = subjectIcons[assessment.subject?.toLowerCase()] || subjectIcons.default;
  const gradient = getSubjectGradient(assessment.subject);
  const durationLabel = assessment.duration ? `${assessment.duration} mins` : "Duration unset";
  const totalQuestions = useMemo(() => countQuestions(assessment), [assessment]);
  const partsLabel = assessment.parts?.length ? `${assessment.parts.length} parts` : assessment.allowedParts?.length ? `${assessment.allowedParts.length} parts` : "Multiple parts";
  const assessmentName = assessment.name || assessment.title || `${assessment.subject || "Subject"} Assessment`;
  const description = assessment.description || `Get monthly access to ${assessment.subject || "selected"} assessments.`;
  const levelClass = assessment.difficulty === "Advanced"
    ? "assessment-difficulty-advanced"
    : assessment.difficulty === "Intermediate"
    ? "assessment-difficulty-intermediate"
    : "assessment-difficulty-beginner";
  const typeLabel = assessmentType === "global" || assessment.type === "global" ? "Global assessment" : assessment.type === "course" ? "Course assessment" : null;

  const actionLabel = isCompleted
    ? "Completed"
    : enrolled
    ? "Start Assessment"
    : "Enroll to Assessment";

  const statusLabel = isCompleted ? `Completed — ${assessment.score ?? 0}%` : enrolled ? "Enrolled" : "";
  const statusClass = isCompleted ? "completed" : enrolled ? "enrolled" : "";

  const handleStartAssessment = () => {
    if (assessmentType === "global" || assessment.type === "global") {
      if (assessment?.subject) {
        const slug = assessment.subject.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        navigate(`/assessment/subject/${slug}`);
      } else {
        navigate(`/assessment/${assessment._id}?type=global`);
      }
    } else {
      navigate(`/quiz/${assessment._id}`);
    }
  };

  const handleEnroll = () => {
    navigate(`/payment/${assessment._id}`, {
      state: {
        course: assessment,
        accessType: "assessment",
      },
    });
  };

  if (viewType === "list") {
    return (
      <div className="assessment-list-item">
        <div className="assessment-list-main">
          <div className="assessment-list-icon">{icon}</div>
          <div className="assessment-list-content">
            <div className="assessment-list-header">
              <div>
                <h3 className="assessment-list-title">{assessmentName}</h3>
                <p className="assessment-list-description">{description}</p>
                {typeLabel && <span className="assessment-card-tag assessment-list-tag">{typeLabel}</span>}
              </div>
              <span className={`assessment-badge ${levelClass}`}>{assessment.difficulty || "Beginner"}</span>
            </div>
            <div className="assessment-list-meta">
              <span>{durationLabel}</span>
              <span>{partsLabel}</span>
              <span>{totalQuestions} questions</span>
            </div>
          </div>
        </div>

        <div className="assessment-list-actions">
          {statusLabel && (
            <div className={`assessment-status-pill ${statusClass}`}>
              {statusLabel}
            </div>
          )}
          <button
            onClick={isCompleted ? undefined : enrolled ? handleStartAssessment : handleEnroll}
            disabled={loading || isCompleted}
            className={`assessment-card-button ${isCompleted ? "completed" : enrolled ? "start" : "enroll"} ${loading ? "loading" : ""}`}
          >
            {loading ? "Processing..." : actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-card assessment-card-dark">
      <div className="assessment-card-heading">
        <div className="assessment-card-heading-left">
          <div className={`assessment-card-icon bg-gradient-to-br ${gradient}`}>{icon}</div>
          <div className="assessment-card-info">
            <h3>{assessmentName}</h3>
            <p>{description}</p>
          </div>
        </div>
        <div className="assessment-card-heading-right">
          {typeLabel && <span className="assessment-card-tag">{typeLabel}</span>}
          <span className={`assessment-badge ${levelClass}`}>{assessment.difficulty || "Beginner"}</span>
        </div>
      </div>

      <div className="assessment-card-details">
        <div className="assessment-detail-row">
          <span>Duration</span>
          <strong>{durationLabel}</strong>
        </div>
        <div className="assessment-detail-row">
          <span>Parts</span>
          <strong>{partsLabel}</strong>
        </div>
        <div className="assessment-detail-row">
          <span>Total Questions</span>
          <strong>{totalQuestions}</strong>
        </div>
      </div>

      <div className="assessment-card-price-row">
        <span className="assessment-price-label">Monthly access</span>
        <strong className="assessment-price">D10/month</strong>
      </div>

      {statusLabel && (
        <div className="assessment-card-status">
          <span className={`assessment-status ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      )}

      <button
        onClick={isCompleted ? undefined : enrolled ? handleStartAssessment : handleEnroll}
        disabled={loading || isCompleted}
        className={`assessment-card-button ${isCompleted ? "completed" : enrolled ? "start" : "enroll"} ${loading ? "loading" : ""}`}
      >
        {loading ? "Processing..." : actionLabel}
      </button>
    </div>
  );
}
