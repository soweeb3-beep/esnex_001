import { useEffect, useState } from "react";
import API from "../api/axios";
import AssessmentAccessModal from "../components/AssessmentAccessModal";

export default function QuizExam() {
  const [quizMeta, setQuizMeta] = useState(null);
  const [quiz, setQuiz] = useState(null);
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

  const quizId = window.location.pathname.split("/").pop();

  /* =========================
     FETCH QUIZ METADATA
  ========================= */
  const fetchQuizMeta = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/quizzes/${quizId}`);
      const quizData = res.data.quiz;
      setQuizMeta(quizData);
      setSelectedPart(getInitialSelectedPart(quizData));
    } catch (err) {
      setStatusMessage(err.response?.data?.message || "Unable to load assessment metadata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizMeta();
  }, []);

  const startAttempt = async () => {
    if (!acceptedRules) {
      setStatusMessage("Please accept the rules before starting the assessment.");
      return;
    }

    if (!selectedPart) {
      setStatusMessage("Select a section before starting.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post(`/quizzes/start/${quizId}`, { selectedPart });
      const { quiz: quizData, attemptId: id } = res.data;
      setQuiz(quizData);
      setAttemptId(id);
      setAnswers(new Array(quizData.questions.length).fill(""));
      setTimeLeft((Number(quizData.timeLimit ?? quizData.duration ?? 0) || 0) * 60);
      setStarted(true);
      setSubmissionResult(null);
      setStatusMessage("");
      enterFullScreen();
    } catch (err) {
      if (err.response?.status === 403) {
        setShowAccessModal(true);
        setStatusMessage("");
      } else {
        setStatusMessage(err.response?.data?.message || "Unable to start the assessment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getPartCode = (partString) => {
    if (!partString || typeof partString !== "string") return null;
    const normalized = partString.trim().toLowerCase();
    if (normalized === "a" || normalized === "objective") return "A";
    if (normalized === "b" || normalized === "theory") return "B";
    if (normalized === "c" || normalized === "oral") return "C";
    if (normalized === "d" || normalized === "practical" || normalized === "pratical") return "D";
    return normalized.toUpperCase().slice(0, 1);
  };

  const getPartQuestionCount = (partCode) => {
    const part = (quizMeta?.parts || []).find((part) => getPartCode(part.partName || part.partType || part.type) === partCode);
    if (!part) return 0;
    const totalQuestions = Number(part.totalQuestions || 0);
    if (totalQuestions > 0) return totalQuestions;
    return (part.sections || []).reduce((sum, section) => sum + Number(section.questionCount || 0), 0);
  };

  const partCSubjects = ["english", "chemistry", "physics", "biology", "computer science", "agriculture", "computer studies", "food science"];
  const normalizeSubject = (quizMeta?.subject || quizMeta?.title || "").toLowerCase();
  const hasPartCQuestions = getPartQuestionCount("C") > 0;
  const qualifiesForPartC = partCSubjects.some((subject) => normalizeSubject.includes(subject));
  const configuredParts = quizMeta?.allowedParts?.length ? quizMeta.allowedParts.map((part) => getPartCode(part)).filter(Boolean) : ["A", "B"];
  const showPartC = configuredParts.includes("C") || hasPartCQuestions || qualifiesForPartC;
  const availableParts = [...configuredParts];
  if (showPartC && !availableParts.includes("C")) {
    availableParts.push("C");
  }
  const uniqueAvailableParts = availableParts.filter((part, index, arr) => arr.indexOf(part) === index);

  const partLabels = {
    A: "Part A — Objectives",
    B: "Part B — Theory",
    C: "Part C — Oral",
  };

  const partDescriptions = {
    A: "Multiple choice questions",
    B: "Written answer / long answer",
    C: "Listening / oral section",
  };

  const selectedPartQuestions = getPartQuestionCount(selectedPart);
  const selectedPartHasQuestions = selectedPartQuestions > 0;

  function getInitialSelectedPart(quiz) {
    if (!quiz) return "A";
    const allowed = (quiz.allowedParts || ["A", "B"]).map((part) => part.toUpperCase());
    if (allowed.includes("A")) return "A";
    if (allowed.includes("B")) return "B";
    if (allowed.includes("C")) return "C";
    return uniqueAvailableParts[0] || "A";
  }

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
          submitQuiz();
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
    const handleBlur = () => {
      setWarnings((w) => {
        const newW = w + 1;

        alert(`⚠️ Warning ${newW}/3: Do not leave exam tab`);

        if (newW >= 3) submitQuiz();

        return newW;
      });
    };

    const handleContextMenu = (e) => e.preventDefault();

    const blockKeys = (e) => {
      if (e.ctrlKey && (e.key === "c" || e.key === "v")) {
        e.preventDefault();
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", blockKeys);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", blockKeys);
    };
  }, []);

  useEffect(() => {
    if (!started || selectedPart !== "A" || submissionResult) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "You must submit the objective assessment or wait for the timer to finish.";
    };

    const handlePopState = () => {
      if (started && selectedPart === "A" && !submissionResult) {
        alert("You can only leave this objective assessment by submitting or waiting for timeout.");
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
  }, [started, selectedPart, submissionResult]);

  /* =========================
     HANDLE ANSWERS
  ========================= */
  const handleChange = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  /* =========================
     SUBMIT QUIZ
  ========================= */
  async function submitQuiz() {
    try {
      const res = await API.post(`/quizzes/submit/${attemptId}`, {
        answers,
      });

      const { score, total, percentage, status } = res.data;
      setSubmissionResult({ score, total, percentage, status, part: selectedPart });
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
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return <div className="p-6">Loading assessment...</div>;
  }

  if (submissionResult) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-white p-6 shadow rounded-lg max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Assessment Complete</h1>
          <p className="text-gray-600 mb-6">
            You have completed <strong>{partLabels[submissionResult.part] || submissionResult.part}</strong>.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Score</p>
              <p className="text-4xl font-bold text-slate-900">{submissionResult.score}</p>
              <p className="text-sm text-slate-500">out of {submissionResult.total}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Percentage</p>
              <p className="text-4xl font-bold text-slate-900">{submissionResult.percentage}%</p>
              <p className="text-sm text-slate-500">Result: {submissionResult.status}</p>
            </div>
          </div>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    if (!quizMeta) {
      return <div className="p-6">{statusMessage || "Assessment not found."}</div>;
    }

    const parts = uniqueAvailableParts;

    return (
      <div className="quiz-selection-page">
        <div className="quiz-selection-shell">
          <div className="quiz-selection-header">
            <div>
              <p className="quiz-selection-label">Choose Assessment Part</p>
              <h1 className="quiz-selection-title">{quizMeta.title}</h1>
              <p className="quiz-selection-copy">
                {quizMeta.description || "Select the appropriate part for this assessment and start when ready."}
              </p>
            </div>
            <div className="quiz-selection-meta">
              <span>Course:</span>
              <strong>{quizMeta.course?.title || "General Assessment"}</strong>
            </div>
          </div>

          <div className="quiz-part-grid">
            {parts.map((part) => {
              const partQuestionCount = getPartQuestionCount(part);
              const hasQuestions = partQuestionCount > 0;

              return (
                <button
                  key={part}
                  type="button"
                  className={`quiz-part-card ${selectedPart === part ? "selected" : ""} ${!hasQuestions ? "disabled" : ""}`}
                  onClick={() => hasQuestions && setSelectedPart(part)}
                  disabled={!hasQuestions}
                >
                  <div className="quiz-part-top">
                    <span className="quiz-part-label">{partLabels[part] || `Part ${part}`}</span>
                    <span className="quiz-part-tag">{partDescriptions[part] || "Section"}</span>
                  </div>
                  <p className="quiz-part-description">
                    {part === "A"
                      ? "Multiple choice questions"
                      : part === "B"
                      ? "Written answer / long answer"
                      : "Listening / oral section"}
                  </p>
                  <div className="quiz-part-footer">
                    <span>{hasQuestions ? `${partQuestionCount} questions` : "Unavailable"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="quiz-assessment-info">
            <div className="quiz-assessment-rules">
              <h2>Assessment Rules</h2>
              <ul>
                <li>Do not leave the assessment tab; three departures will submit your attempt.</li>
                <li>The timer starts when you begin the selected part.</li>
                <li>Only one attempt is allowed per part.</li>
                <li>Answer questions carefully and follow instructions.</li>
              </ul>
            </div>

            <label className="quiz-accept-rules">
              <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)} />
              <span>I have read and accept the assessment rules.</span>
            </label>

            {statusMessage && <div className="quiz-status-message">{statusMessage}</div>}

            <button
              onClick={startAttempt}
              disabled={!acceptedRules || !selectedPart || !selectedPartHasQuestions}
              className={`quiz-start-button ${!acceptedRules || !selectedPart || !selectedPartHasQuestions ? "disabled" : ""}`}
            >
              Start {partLabels[selectedPart] || `Part ${selectedPart}`}
            </button>

            {!selectedPartHasQuestions && (
              <div className="quiz-warning-message">
                {selectedPart === "C" && !hasPartCQuestions
                  ? "Part C is reserved for practical/oral papers and is not available for this assessment yet."
                  : "No questions are available for this section. Please choose another part."}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredQuestions = (quiz?.questions || [])
    .map((q, index) => ({ q, index }))
    .filter((item) => (item.q.part || "A").toUpperCase() === selectedPart);

  return (
    <>
      <div className="p-6 bg-gray-100 min-h-screen">

        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-4 shadow rounded mb-4">

          <h1 className="font-bold text-xl">{quiz.title}</h1>

          <div className="text-red-600 font-bold">
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>

          <button
            onClick={submitQuiz}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Submit
          </button>
        </div>

        {/* WARNING */}
        {warnings > 0 && (
          <div className="text-red-600 font-bold mb-3">
            ⚠️ Warnings: {warnings}/3
          </div>
        )}

        {/* QUESTIONS */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-yellow-800 rounded">
              <p className="font-semibold">No questions are available in this section yet.</p>
              <p className="mt-1">Try another part, or contact your instructor if this part should contain questions.</p>
            </div>
          ) : (
            filteredQuestions.map(({ q, index }, i) => (
              <div key={`${index}-${q.question}`} className="bg-white p-4 shadow rounded">
                <h3 className="font-bold mb-2">
                  {i + 1}. {q.question}
                </h3>

                {q.type === "mcq" && (
                  <div className="space-y-2">
                    {q.options.map((opt, idx) => (
                      <label key={idx} className="block">
                        <input
                          type="radio"
                          name={`q-${index}`}
                          checked={answers[index] === opt}
                          onChange={() => handleChange(index, opt)}
                        />
                        <span className="ml-2">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {(q.type === "theory" || q.type === "essay" || q.type === "text" || q.questionType === "text") && (
                  <textarea
                    className="border p-2 w-full"
                    rows="4"
                    value={answers[index]}
                    onChange={(e) => handleChange(index, e.target.value)}
                  />
                )}

                {q.type === "math" && (
                  <input
                    className="border p-2 w-full"
                    value={answers[index]}
                    onChange={(e) => handleChange(index, e.target.value)}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showAccessModal && quizMeta && (
        <AssessmentAccessModal
          quiz={quizMeta}
          onClose={() => setShowAccessModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}