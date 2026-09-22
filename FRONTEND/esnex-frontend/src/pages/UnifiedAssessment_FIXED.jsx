import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "../api/axios";
import AssessmentAccessModal from "../components/AssessmentAccessModal";

export default function UnifiedAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const subjectSlug = params.subject || null;
  const assessmentId = !subjectSlug ? params.id : null;
  const isSubjectMode = Boolean(subjectSlug);

  const [assessmentMeta, setAssessmentMeta] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [selectedPart, setSelectedPart] = useState("A");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [hasServerEnrollment, setHasServerEnrollment] = useState(false);
  const leaveCountRef = useRef(0);

  const assessmentType = isSubjectMode ? "subject" : new URLSearchParams(window.location.search).get("type") || "global";

  /* =========================
     FETCH ASSESSMENT METADATA
  ========================= */
  const fetchAssessmentMeta = async () => {
    try {
      setLoading(true);
      setStatusMessage("");
      const endpoint = isSubjectMode
        ? `/assessments/global/subject/${subjectSlug}`
        : assessmentType === "global"
        ? `/assessments/global/${assessmentId}`
        : `/assessments/${assessmentId}`;
      const res = await API.get(endpoint);
      const data = res.data.assessment;
      setAssessmentMeta(data);
      setSelectedPart(getInitialSelectedPart(data));
    } catch (err) {
      setStatusMessage(err.response?.data?.message || "Unable to load assessment metadata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessmentMeta();
  }, [subjectSlug, assessmentId, assessmentType]);

  const fetchEnrollmentStatus = async () => {
    if (!assessmentMeta?._id) return;
    try {
      const res = await API.get("/assessments/enrolled");
      const enrolledAssessments = res.data.assessments || [];
      const enrolled = enrolledAssessments.some((item) =>
        item._id === assessmentMeta._id ||
        item.subject?.toString().toLowerCase() === assessmentMeta.subject?.toString().toLowerCase()
      );
      setHasServerEnrollment(Boolean(enrolled));
    } catch (err) {
      setHasServerEnrollment(false);
    }
  };

  useEffect(() => {
    fetchEnrollmentStatus();
  }, [assessmentMeta]);

  useEffect(() => {
    if (!assessmentMeta?._id) return;

    const refreshIfEnrollmentChanged = async () => {
      await fetchEnrollmentStatus();
    };

    const handleStorage = () => {
      // We don't rely on client-side storage for enrollment
      refreshIfEnrollmentChanged();
    };

    const handleFocus = () => {
      refreshIfEnrollmentChanged();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [assessmentMeta]);

  useEffect(() => {
    if (location.state?.paymentSuccess) {
      setStatusMessage(location.state.paymentMessage || "Payment successful! Access refreshed.");
      fetchAssessmentMeta();
      fetchEnrollmentStatus();
    }
  }, [location.state]);

  const assessmentPaid = useMemo(() => {
    if (!assessmentMeta) return false;
    return Boolean(
      assessmentMeta.isEnrolledAssessment ||
      assessmentMeta.price === 0 ||
      hasServerEnrollment
    );
  }, [assessmentMeta, hasServerEnrollment]);

  const startAttempt = async () => {
    if (!acceptedRules) {
      setStatusMessage("Please accept the rules before starting the assessment.");
      return;
    }

    if (!selectedPart || !uniqueAvailableParts.includes(selectedPart)) {
      setStatusMessage("Please select a valid assessment part.");
      return;
    }

    try {
      setLoading(true);
      const endpoint = isSubjectMode
        ? `/assessments/global/subject/${subjectSlug}/start`
        : assessmentType === "global"
        ? `/assessments/global/start/${assessmentId}`
        : `/assessments/course-section/start/${assessmentId}`;
      const res = await API.post(endpoint, { selectedPart, assessmentPaid });
      const { attemptId: id, questions: questionData, timeLimit } = res.data;
      const normalizedQuestions = (questionData || []).map((question) => ({
        ...question,
        part: question.part || selectedPart,
      }));
      setAssessment(normalizedQuestions);
      setAttemptId(id);
      setAnswers(new Array(normalizedQuestions.length).fill(""));
      const startingSeconds = (timeLimit ?? assessmentMeta?.timeLimit ?? assessmentMeta?.duration ?? 0) * 60;
      setTimeLeft(startingSeconds);
      setStartTime(Date.now());
      setStarted(true);
      setSubmissionResult(null);
      setStatusMessage("");
      enterFullScreen();
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        setShowAccessModal(true);
        setStatusMessage("");
      } else {
        setStatusMessage(err.response?.data?.message || "Unable to start the assessment.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     PART AVAILABILITY LOGIC
  ========================= */
  const mapPartStringToCode = (partString) => {
    if (!partString || typeof partString !== "string") return null;
    const normalized = partString.trim().toLowerCase();
    if (normalized === "a" || normalized === "objective") return "A";
    if (normalized === "b" || normalized === "theory") return "B";
    if (normalized === "c" || normalized === "oral") return "C";
    if (normalized === "d" || normalized === "practical" || normalized === "pratical") return "D";
    return normalized.toUpperCase().slice(0, 1);
  };

  const getPartCounts = (assessmentData) => {
    const parts = Array.isArray(assessmentData?.parts) ? assessmentData.parts : [];
    return parts.reduce(
      (counts, part) => {
        const partType = (part.partType || part.type || "").toString().toLowerCase();
        const count = Number(part.totalQuestions || part.questionCount || 0) || 0;
        if (partType === "objective") counts.objectiveCount += count;
        if (partType === "theory") counts.theoryCount += count;
        if (partType === "oral") counts.oralCount += count;
        if (partType === "practical") counts.practicalCount += count;
        return counts;
      },
      { objectiveCount: 0, theoryCount: 0, oralCount: 0, practicalCount: 0 }
    );
  };

  const parts = Array.isArray(assessmentMeta?.parts) ? assessmentMeta.parts : [];
  const configuredParts = assessmentMeta?.allowedParts?.length
    ? assessmentMeta.allowedParts.map(mapPartStringToCode).filter(Boolean)
    : assessmentMeta?.parts?.map((part, index) => String.fromCharCode(65 + index)) || ["A", "B"];
  const uniqueAvailableParts = [...new Set(configuredParts)];

  const { objectiveCount, theoryCount, oralCount, practicalCount } = getPartCounts(assessmentMeta);

  const partLabels = {
    A: "Part A — Objective",
    B: "Part B — Theory",
    C: "Part C — Oral English",
    D: "Part D — Practical",
  };

  const partDescriptions = {
    A: "Structured objective sections A–G",
    B: "Long answer and written response",
    C: "Oral English practice and prompts",
    D: "Practical and hands-on questions",
  };

  const selectedPartHasQuestions = selectedPart === "A"
    ? objectiveCount > 0
    : selectedPart === "B"
    ? theoryCount > 0
    : selectedPart === "C"
    ? oralCount > 0
    : selectedPart === "D"
    ? practicalCount > 0
    : false;

  const partsWithQuestions = uniqueAvailableParts.filter((part) =>
    part === "A" ? objectiveCount > 0
      : part === "B" ? theoryCount > 0
      : part === "C" ? oralCount > 0
      : part === "D" ? practicalCount > 0
      : false
  );

  const noPartsAvailable = assessmentPaid && partsWithQuestions.length === 0;
  const invalidPartSelection = assessmentPaid && !selectedPartHasQuestions;

  const exitAssessment = () => {
    setStarted(false);
    navigate(-1);
  };

  function getInitialSelectedPart(assessmentData) {
    if (!assessmentData) return "A";

    const {
      objectiveCount: initialObjectiveCount,
      theoryCount: initialTheoryCount,
      oralCount: initialOralCount,
      practicalCount: initialPracticalCount,
    } = getPartCounts(assessmentData);

    const allowed = (assessmentData.allowedParts || ["A", "B"]).map(mapPartStringToCode).filter(Boolean);
    const allowedWithQuestions = allowed.filter((part) =>
      part === "A" ? initialObjectiveCount > 0
        : part === "B" ? initialTheoryCount > 0
        : part === "C" ? initialOralCount > 0
        : part === "D" ? initialPracticalCount > 0
        : false
    );
    if (allowedWithQuestions.length > 0) return allowedWithQuestions[0];
    if (allowed.includes("A")) return "A";
    if (allowed.includes("B")) return "B";
    if (allowed.includes("C")) return "C";
    if (allowed.includes("D")) return "D";
    return allowed[0] || "A";
  }

  const getGrade = (percentage) => {
    if (percentage >= 75) return { grade: "A1", point: "1", label: "Excellent" };
    if (percentage >= 70) return { grade: "B2", point: "2", label: "Good" };
    if (percentage >= 65) return { grade: "B3", point: "3", label: "Good" };
    if (percentage >= 60) return { grade: "C4", point: "4", label: "Credit" };
    if (percentage >= 55) return { grade: "C5", point: "5", label: "Credit" };
    if (percentage >= 50) return { grade: "C6", point: "6", label: "Credit" };
    if (percentage >= 45) return { grade: "D7", point: "7", label: "Pass" };
    if (percentage >= 40) return { grade: "E8", point: "8", label: "Pass" };
    return { grade: "F9", point: "9", label: "Fail" };
  };

  /* =========================
     FULLSCREEN MODE
  ========================= */
  const enterFullScreen = () => {
    document.documentElement.requestFullscreen?.();
  };

  /* =========================
     TIMER
  ========================= */
  useEffect(() => {
    if (!timeLeft || !started) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, started]);

  /* =========================
     ANTI CHEATING SYSTEM
  ========================= */
  useEffect(() => {
    if (!started) return;

    const handleLeave = () => {
      leaveCountRef.current += 1;
      setWarnings(leaveCountRef.current);
      setStatusMessage("Do not leave this tab during the assessment.");
      if (leaveCountRef.current >= 2) {
        submitAssessment();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        handleLeave();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleLeave);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleLeave);
    };
  }, [started]);

  useEffect(() => {
    if (!started || submissionResult) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "You must submit the assessment or wait for the timer to finish.";
    };

    const handlePopState = () => {
      if (started && !submissionResult) {
        alert("You can only leave this assessment by submitting or waiting for timeout.");
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [started, submissionResult]);

  /* =========================
     HANDLE ANSWERS
  ========================= */
  const handleChange = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  /* =========================
     SUBMIT ASSESSMENT
  ========================= */
  async function submitAssessment() {
    if (!attemptId || attemptId === "null") {
      setStatusMessage("Assessment attempt not found. Please restart the assessment.");
      return;
    }

    const isBlankAnswer = (answer) => {
      if (answer === null || answer === undefined) return true;
      if (typeof answer === "string") return answer.trim() === "";
      if (Array.isArray(answer)) return answer.length === 0;
      if (typeof answer === "object") return Object.keys(answer).length === 0;
      return false;
    };

    const unansweredCount = answers.filter((answer) => isBlankAnswer(answer)).length;
    const totalQuestions = assessment?.length || answers.length || 0;

    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''} out of ${totalQuestions}.\n\nDo you want to submit anyway?`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const res = await API.post(`/assessments/submit/${attemptId}`, { answers });
      const score = res.data.score ?? res.data.result?.totalMarks ?? 0;
      const total = res.data.total ?? res.data.attempt?.total ?? assessmentMeta?.questions?.length ?? 0;
      const correct = res.data.correct ?? res.data.result?.correct ?? 0;
      const wrong = total - correct;
      const percentage = res.data.percentage ?? res.data.result?.percentage ?? 0;
      const status = res.data.status ?? (res.data.result?.passed ? "PASS" : "FAIL") ?? "";
      const elapsedSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const elapsedRemainingSeconds = elapsedSeconds % 60;
      const timeUsed = `${elapsedMinutes}min ${elapsedRemainingSeconds.toString().padStart(2, "0")}s`;
      const dateTaken = new Date().toLocaleDateString("en-GB");
      const duration = `${assessmentMeta?.duration ?? 0} min`;

      setSubmissionResult({
        score,
        total,
        percentage,
        status,
        part: selectedPart,
        correct,
        wrong,
        timeUsed,
        dateTaken,
        duration,
      });
      setStarted(false);
      document.exitFullscreen?.();
      setStatusMessage("");
    } catch (err) {
      alert(err.response?.data?.message || "Submission failed");
    }
  }

  const handlePaymentSuccess = () => {
    setShowAccessModal(false);
    setStatusMessage("✓ Assessment access granted! You can now start.");
    setAcceptedRules(false);
    // Re-check server enrollment state after successful payment
    fetchEnrollmentStatus();
  };

  const samplePreview = assessmentMeta?.samplePreview || [
    { title: "Section A: Objective", sample: "Read each question carefully and choose the best option." },
    { title: "Section B: Theory", sample: "Write a short explanation for the passage below." },
    { title: "Section C: Oral", sample: "Listen to the prompt and respond in your own words." },
  ];

  const instructions = assessmentMeta?.instructions || [
    "Read each question carefully and choose the best answer.",
    "Answer all questions before submitting.",
    "Manage your time wisely and review your answers when possible.",
  ];

  const actionLabel = assessmentPaid ? "Start Assessment" : "Enroll to Assessment";
  const questionWarnings = assessmentMeta?.questionWarnings || [];
  const noQuestionsForPart = assessmentPaid && invalidPartSelection;
  const buttonAction = async () => {
    if (assessmentPaid) {
      if (noPartsAvailable) {
        setStatusMessage("There are no available assessment parts with questions. Please return to the previous page.");
        return;
      }
      if (noQuestionsForPart) {
        setStatusMessage(`Part ${selectedPart} currently has no available questions. Please choose a different part or return to the previous page.`);
        return;
      }
      await startAttempt();
      return;
    }
    navigate(`/payment/${assessmentMeta._id}`, {
      state: {
        course: assessmentMeta,
        accessType: "assessment",
      },
    });
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return <div className="p-6">Loading assessment...</div>;
  }

  if (submissionResult && !reviewMode) {
    const gradeInfo = getGrade(submissionResult.percentage);
    const gradeColor = gradeInfo.grade === "F9" ? "text-red-600" : gradeInfo.grade === "E8" || gradeInfo.grade === "D7" ? "text-blue-600" : "text-green-600";
    
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-white p-6 shadow rounded-lg max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Assessment Complete</h1>
          <p className="text-gray-600 mb-6">
            You have completed <strong>{partLabels[submissionResult.part] || submissionResult.part}</strong>.
          </p>
          <div className="mb-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border-2 border-slate-200">
            <p className="text-sm text-slate-500 mb-2">Your Grade</p>
            <div className="flex flex-col items-center gap-3">
              <p className={`text-6xl font-bold ${gradeColor}`}>{gradeInfo.grade}</p>
              <p className="text-lg font-semibold text-slate-700">{gradeInfo.label}</p>
              <p className="text-sm text-slate-600">Point: {gradeInfo.point}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Marks Earned</p>
              <p className="text-4xl font-bold text-slate-900">{submissionResult.score}</p>
              <p className="text-sm text-slate-500">out of {submissionResult.total}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Percentage</p>
              <p className="text-4xl font-bold text-slate-900">{submissionResult.percentage}%</p>
              <p className="text-sm text-slate-500">Result: {submissionResult.status}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => setReviewMode(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-lg border border-slate-700"
            >
              Review assessment
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submissionResult && reviewMode) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-white p-6 shadow rounded-lg max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Review Your Assessment</h1>
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setReviewMode(false)}
              className="bg-slate-900 text-white px-5 py-3 rounded-lg"
            >
              Back to score
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="bg-blue-600 text-white px-5 py-3 rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SHOW QUESTIONS WHEN STARTED
  if (started && assessment && assessment.length > 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-400">
              {assessmentMeta?.subject?.toUpperCase()}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">{assessmentMeta?.title}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400">Time Left</p>
              <p className={`mt-1 text-3xl font-mono font-bold ${timeLeft < 300 ? "text-red-400" : "text-sky-400"}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </p>
            </div>
            <button
              onClick={submitAssessment}
              className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              ✈️ Submit Assessment
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {assessment.map((q, index) => (
              <div key={index} className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-100">
                      {q.question || q.text || "Question"}
                    </h3>
                    {answers[index] && (
                      <p className="mt-2 text-xs font-semibold text-emerald-400">✓ Answered: {answers[index]}</p>
                    )}
                  </div>
                </div>

                {(q.type === "mcq" || q.type === "objective" || q.questionType === "objective") && q.options && (
                  <div className="space-y-2 ml-11">
                    {q.options.map((option, i) => (
                      <label key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition">
                        <input
                          type="radio"
                          name={`q-${index}`}
                          value={option}
                          checked={answers[index] === option}
                          onChange={(e) => handleChange(index, e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-slate-200">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {(q.type === "theory" || q.type === "essay" || q.type === "text" || q.questionType === "text") && (
                  <textarea
                    value={answers[index] || ""}
                    onChange={(e) => handleChange(index, e.target.value)}
                    placeholder="Your answer here..."
                    className="ml-11 w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    rows={4}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: SHOW PREVIEW PAGE
  return (
    <div className="quiz-selection-page bg-slate-950 min-h-screen py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Assessment Preview</p>
              <h1 className="mt-4 text-4xl font-semibold text-white">{assessmentMeta?.displayName || assessmentMeta?.title}</h1>
              <p className="mt-4 max-w-2xl text-slate-400">{assessmentMeta?.description}</p>
            </div>
            <div className="rounded-3xl bg-slate-800/90 p-6 text-slate-200 shadow-lg">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Assessment Status</p>
              <p className="mt-3 text-2xl font-semibold text-white">{assessmentPaid ? "Paid" : "Not Enrolled"}</p>
              <p className="mt-2 text-sm text-slate-400">{assessmentPaid ? "Ready to start the exam." : "Enroll to start."}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Subject</p>
                <p className="mt-2 text-xl font-semibold text-white">{assessmentMeta?.subject}</p>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Duration</p>
                <p className="mt-2 text-xl font-semibold text-white">{assessmentMeta?.duration || 0} mins</p>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Parts</p>
                <p className="mt-2 text-xl font-semibold text-white">{parts.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Questions</p>
                <p className="mt-2 text-xl font-semibold text-white">{objectiveCount + theoryCount + oralCount}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-800/80 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Instructions</h2>
              <ol className="space-y-3 text-slate-300">
                {instructions.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-sky-300">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>

              {assessmentPaid && (
                <div className="mt-6 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="accept-rules"
                    checked={acceptedRules}
                    onChange={(e) => setAcceptedRules(e.target.checked)}
                    className="h-4 w-4 text-sky-600 bg-slate-700 border-slate-600 rounded"
                  />
                  <label htmlFor="accept-rules" className="text-sm text-slate-300">
                    I have read and accept the assessment rules.
                  </label>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-xl">
              <h2 className="text-xl font-semibold text-white">Ready to Start?</h2>
              <button
                type="button"
                onClick={buttonAction}
                disabled={loading || noQuestionsForPart}
                className="mt-6 w-full rounded-3xl bg-sky-500 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              >
                {loading ? "Processing..." : actionLabel}
              </button>
              {statusMessage && (
                <p className="mt-4 text-sm text-red-400">{statusMessage}</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white">Status</h3>
              <div className="mt-4 space-y-3 text-slate-300">
                <div className="flex justify-between rounded-2xl bg-slate-800/80 px-4 py-3">
                  <span>Enrollment</span>
                  <strong>{assessmentPaid ? "✓ Paid" : "Pending"}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {questionWarnings.length > 0 && (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-950/80 p-4 text-sm text-amber-100">
            <h3 className="font-semibold text-amber-200 mb-2">⚠️ Warnings</h3>
            <ul className="list-disc pl-5 space-y-1">
              {questionWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AssessmentAccessModal
        isOpen={showAccessModal}
        assessmentId={assessmentMeta?._id}
        onClose={() => setShowAccessModal(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
