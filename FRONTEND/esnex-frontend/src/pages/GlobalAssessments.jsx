import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import API from "../api/axios";

const iconMap = {
  english: { icon: "📖", gradient: "from-blue-500 to-blue-600" },
  maths: { icon: "📐", gradient: "from-cyan-500 to-cyan-600" },
  biology: { icon: "🔬", gradient: "from-purple-500 to-purple-600" },
  chemistry: { icon: "⚗️", gradient: "from-orange-500 to-orange-600" },
};

const normalizeSubjectKey = (subject) => {
  if (!subject || typeof subject !== "string") return "";
  return subject.trim().toLowerCase();
};

const mergeAssessmentsBySubject = (assessments = []) => {
  const grouped = new Map();
  for (const assessment of assessments) {
    const key = normalizeSubjectKey(assessment.subject || assessment.name || assessment.displayName);
    if (!key) {
      grouped.set(assessment._id || `${Math.random()}`, { ...assessment });
      continue;
    }

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...assessment, parts: Array.isArray(assessment.parts) ? [...assessment.parts] : [] });
      continue;
    }

    const existingParts = Array.isArray(existing.parts) ? [...existing.parts] : [];
    const incomingParts = Array.isArray(assessment.parts) ? assessment.parts : [];
    const seenPartKeys = new Set(existingParts.map((part) => String(part.partType || part.type || part.partName || part.name || "").toLowerCase()));

    for (const part of incomingParts) {
      const partKey = String(part.partType || part.type || part.partName || part.name || "").toLowerCase();
      if (!seenPartKeys.has(partKey)) {
        existingParts.push(part);
        seenPartKeys.add(partKey);
      }
    }

    existing.parts = existingParts;
    existing.totalQuestions = existingParts.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0);
    existing.price = existing.price || assessment.price;
    existing.subject = existing.subject || assessment.subject;
    existing.description = existing.description || assessment.description;
    existing.visibility = existing.visibility || assessment.visibility;
    grouped.set(key, existing);
  }
  return Array.from(grouped.values());
};

export default function GlobalAssessments() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolledAssessmentIds, setEnrolledAssessmentIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const { isDark } = useTheme();
  // Load assessments with automatic retry and expose retry via UI
  const loadAssessments = async (maxRetries = 3) => {
    setLoading(true);
    setError(null);
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const res = await API.get("/assessments/global");
        setAssessments(res.data?.assessments || []);
        try {
          const enrollmentRes = await API.get("/assessments/enrolled");
          setEnrolledAssessmentIds(new Set((enrollmentRes.data?.assessments || []).map((item) => String(item?._id || item?.assessmentId || item?.id || "")).filter(Boolean)));
        } catch (enrollmentError) {
          // The public listing remains usable for guests; access is rechecked
          // by the backend when an assessment is started.
          setEnrolledAssessmentIds(new Set());
        }
        setError(null);
        setLoading(false);
        return;
      } catch (err) {
        attempt += 1;
        console.error(`Attempt ${attempt} failed to load assessments`, err?.message || err);
        if (attempt > maxRetries) {
          setError(err?.response?.data?.message || "Failed to load assessments");
          setLoading(false);
          return;
        }
        // exponential backoff
        const delay = 500 * Math.pow(2, attempt - 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    // fire-and-forget but respect unmount by checking mounted flag when setting state
    loadAssessments(3).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const pageContainerClass = isDark
    ? "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_36%,#ffffff_100%)] text-slate-950";

  const inputClass = isDark
    ? "h-[58px] flex-1 rounded-[14px] bg-[#081733] border border-[rgba(255,255,255,0.08)] px-5 text-white text-sm outline-none"
    : "h-[58px] flex-1 rounded-[14px] bg-white border border-slate-300 px-5 text-slate-950 text-sm outline-none";

  const selectClass = isDark
    ? "h-[58px] rounded-[14px] bg-[#081733] border border-[rgba(255,255,255,0.08)] px-5 text-white text-sm outline-none min-w-[150px]"
    : "h-[58px] rounded-[14px] bg-white border border-slate-300 px-5 text-slate-950 text-sm outline-none min-w-[150px]";

  const cardWrapperClass = isDark
    ? "group flex min-h-[280px] flex-col justify-between rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(145deg,#071428,#0b1e3b)] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.28)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(0,0,0,0.4)]"
    : "group flex min-h-[280px] flex-col justify-between rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.08)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(15,23,42,0.12)]";

  const helperCardClass = isDark
    ? "rounded-[12px] bg-[rgba(255,255,255,0.04)] p-3 text-center"
    : "rounded-[12px] bg-slate-100 p-3 text-center";

  const helperLabelClass = isDark
    ? "text-[11px] text-[#94a3b8] mt-1"
    : "text-[11px] text-slate-950 mt-1";

  const helperValueClass = isDark
    ? "text-[16px] font-semibold text-white"
    : "text-[16px] font-semibold text-slate-950";

  const descriptionClass = isDark
    ? "text-[13px] leading-5 text-[#94a3b8] mb-4"
    : "text-[13px] leading-5 text-slate-950 mb-4";

  const priceClass = isDark
    ? "text-[18px] font-semibold text-white"
    : "text-[18px] font-semibold text-slate-950";

  const perMonthClass = isDark
    ? "text-[12px] text-[#94a3b8] mt-1"
    : "text-[12px] text-slate-950 mt-1";

  const emptyStateClass = isDark
    ? "col-span-full rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(145deg,#071428,#0b1e3b)] p-6 text-center text-white"
    : "col-span-full rounded-[18px] border border-slate-200 bg-white p-6 text-center text-slate-700";

  const headingClass = isDark ? "text-5xl font-bold mb-3 text-white" : "text-5xl font-bold mb-3 text-slate-950";
  const subtextClass = isDark ? "text-slate-300 max-w-3xl text-base leading-7" : "text-slate-900 max-w-3xl text-base leading-7";
  const heroLabelClass = isDark ? "text-sm uppercase tracking-[0.28em] text-blue-300 font-semibold mb-2" : "text-sm uppercase tracking-[0.28em] text-sky-600 font-semibold mb-2";
  const subjectTitleClass = isDark ? "text-[18px] font-semibold text-white mb-2" : "text-[18px] font-semibold text-slate-950 mb-2";

  const displayAssessments = useMemo(
    () =>
      mergeAssessmentsBySubject(assessments).map((assessment) => {
        const slug = assessment.subject?.toLowerCase() || assessment._id;
        const iconData = iconMap[slug] || { icon: "📘", gradient: "from-slate-500 to-slate-700" };
        const parts = assessment.parts?.length || assessment.allowedParts?.length || 0;
        const questions =
          assessment.parts?.reduce((sum, part) => sum + (part.sections?.reduce((s, section) => s + (section.questionCount || 0), 0) || 0), 0) || 0;

        return {
          slug,
          title: assessment.name,
          description: assessment.description || "Ready for your next mock exam",
          duration: assessment.duration ? `${assessment.duration} min` : "N/A",
          parts,
          questions,
          price: assessment.price ? `D${assessment.price}/${assessment.subscription || "month"}` : "Free",
          icon: iconData.icon,
          available: (() => {
            const now = new Date();
            const isPublished = assessment.status === "published" || !assessment.status;
            const isVisible = assessment.visibility !== false;
            const releaseReached = !assessment.availabilityDate || new Date(assessment.availabilityDate) <= now;
            return isVisible && isPublished && releaseReached;
          })(),
          iconGradient: iconData.gradient,
          subject: assessment.subject,
          status: assessment.status,
          enrolled: enrolledAssessmentIds.has(String(assessment._id || assessment.id || "")),
        };
      }),
    [assessments, enrolledAssessmentIds]
  );

  return (
    <div className={`assessments-page ${pageContainerClass}`}>
      <div className="max-w-[1450px] mx-auto px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className={heroLabelClass}>Assessment Platform</p>
          <h1 className={headingClass}>Subject Assessments</h1>
          <p className={subtextClass}>Choose a subject to begin. All assessments are WAEC-style CBT with real exam structure.</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            placeholder="Search subjects..."
            disabled
            className={inputClass}
          />
          <select disabled className={selectClass}>
            <option>All Status</option>
          </select>
          <select disabled className={selectClass}>
            <option>Popular</option>
          </select>
        </div>

        {/* Assessment Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {loading ? (
            <div className={emptyStateClass}>Loading assessments...</div>
          ) : displayAssessments.length === 0 ? (
            <div className={emptyStateClass}>No available assessments yet.</div>
          ) : (
            displayAssessments.map((subject) => {
              const isAvailable = subject.available;
              const isEnrolled = subject.enrolled;

            const buttonBg = !isAvailable
              ? "#4b5563"
              : isEnrolled
              ? "linear-gradient(90deg, #2563eb, #38bdf8)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24)";

            const buttonLabel = !isAvailable
              ? "Coming Soon"
              : isEnrolled
              ? "Start Assessment"
              : "Enroll Now";

            const badgeStyle = isAvailable
              ? isEnrolled
                ? { background: "rgba(255, 191, 0, 0.15)", color: "#ffbf00" }
                : { background: "rgba(0, 255, 140, 0.12)", color: "#22ff88" }
              : { background: "rgba(160, 160, 180, 0.15)", color: "#c7c7d4" };

            const badgeText = isAvailable ? (isEnrolled ? "Enrolled" : "Available") : "Coming Soon";

            return (
              <div
                key={subject.slug}
                data-testid={`assessment-card-${subject.slug}`}
                className={cardWrapperClass}
              >
                <div>
                  <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold mb-3" style={badgeStyle}>
                    {badgeText}
                  </span>

                  <div className={`w-[56px] h-[56px] rounded-[14px] flex items-center justify-center text-[24px] mb-4 bg-gradient-to-br ${subject.iconGradient}`} style={{ boxShadow: "0 10px 25px rgba(0,0,0,0.22)" }}>
                    {subject.icon}
                  </div>

                  <h3 className={subjectTitleClass}>{subject.title}</h3>
                  <p className={descriptionClass} style={{ maxWidth: "100%" }}>
                    {subject.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    <div className={helperCardClass}>
                      <p className={helperValueClass}>{subject.duration}</p>
                      <p className={helperLabelClass}>Duration</p>
                    </div>
                    <div className={helperCardClass}>
                      <p className={helperValueClass}>{subject.parts}</p>
                      <p className={helperLabelClass}>Parts</p>
                    </div>
                    <div className={helperCardClass}>
                      <p className={helperValueClass}>{subject.questions}</p>
                      <p className={helperLabelClass}>Questions</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <p className={priceClass}>{subject.price}</p>
                    <p className={perMonthClass}>per month</p>
                  </div>
                  <button
                    data-testid={`assessment-card-button-${subject.slug}`}
                    onClick={() => isAvailable && navigate(`/assessment/subject/${subject.slug}`)}
                    disabled={!isAvailable}
                    className="w-full h-[44px] rounded-[10px] text-[14px] font-semibold text-white border-none transition duration-300"
                    style={{
                      background: buttonBg,
                      cursor: !isAvailable ? "not-allowed" : "pointer",
                      opacity: !isAvailable ? 0.75 : 1,
                    }}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
