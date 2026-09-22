import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import API from "../api/axios";
import ComprehensionRenderer from "../components/renderers/ComprehensionRenderer";
import SummaryRenderer from "../components/renderers/SummaryRenderer";
import ObjectiveRenderer from "../components/renderers/ObjectiveRenderer";
import EssayRenderer from "../components/renderers/EssayRenderer";

export default function AssessmentExam() {
  const { isDark } = useTheme();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState(0);

  const pageWrapperClass = isDark ? "p-6 bg-slate-950 min-h-screen" : "p-6 bg-gray-100 min-h-screen";
  const panelClass = isDark ? "max-w-4xl mx-auto bg-slate-900 text-slate-100" : "max-w-4xl mx-auto bg-white text-slate-950";
  const headerClass = isDark ? "flex justify-between items-center bg-slate-800 p-4 shadow rounded mb-4" : "flex justify-between items-center bg-white p-4 shadow rounded mb-4";
  const timerClass = isDark ? "text-red-400 font-bold" : "text-red-600 font-bold";
  const warningClass = isDark ? "text-red-300 font-bold mb-3" : "text-red-600 font-bold mb-3";

  const attemptId = window.location.pathname.split("/").pop();

  useEffect(() => {
    const normalizeAnswerValue = (value) => {
      if (value === undefined || value === null) return "";
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
      if (Array.isArray(value)) return value.map(normalizeAnswerValue).filter(Boolean).join("\n");
      if (typeof value === "object") return normalizeAnswerValue(value.studentAnswer ?? value.answer ?? value.value ?? "");
      return String(value).trim();
    };

    const buildInitialAnswers = (data) => {
      const initial = {};
      (data.questions || []).forEach((q) => {
        if (q.questionId) initial[q.questionId] = "";
        if (Array.isArray(q.questions)) {
          q.questions.forEach((sub) => {
            if (sub.questionId) initial[sub.questionId] = "";
          });
        }
        if (Array.isArray(q.summary?.questions)) {
          q.summary.questions.forEach((sub) => {
            if (sub.questionId) initial[sub.questionId] = "";
          });
        }
      });
      (data.answers || []).forEach((answer) => {
        const questionId = answer.questionId || answer.question?.questionId || answer.question?._id;
        if (questionId) {
          initial[String(questionId)] = normalizeAnswerValue(answer.studentAnswer ?? answer.answer ?? answer.value ?? answer);
        }
      });
      return initial;
    };

    const loadAssessment = async () => {
      const assessmentData = sessionStorage.getItem("currentAssessment");
      if (assessmentData) {
        const data = JSON.parse(assessmentData);
        setAttempt(data);
        setAnswers(buildInitialAnswers(data));
        const initialSeconds = typeof data.timeLeft !== "undefined" && data.timeLeft !== null
          ? Number(data.timeLeft)
          : typeof data.timeLimit !== "undefined" && data.timeLimit !== null
          ? Number(data.timeLimit) * 60
          : 0;
        setTimeLeft(initialSeconds);
        setLoading(false);
        return;
      }

      try {
        const res = await API.get(`/assessments/attempt/${attemptId}`);
        const data = res.data.attempt || res.data;
        if (data) {
          setAttempt(data);
          setAnswers(buildInitialAnswers(data));
          const initialSeconds = typeof data.timeLeft !== "undefined" && data.timeLeft !== null
            ? Number(data.timeLeft)
            : typeof data.timeLimit !== "undefined" && data.timeLimit !== null
            ? Number(data.timeLimit) * 60
            : 0;
          setTimeLeft(initialSeconds);
          setLoading(false);
          return;
        }
      } catch (err) {
        // fallback to render error below
      }

      setError("Assessment data not found. Please start the assessment again.");
      setLoading(false);
    };

    loadAssessment();
  }, [attemptId]);

  // This should be called after starting the assessment
  const initializeAssessment = (attemptData) => {
    setAttempt(attemptData);
    const initial = {};
    (attemptData.questions || []).forEach((q) => {
      if (q.questionId) initial[q.questionId] = "";
      if (Array.isArray(q.questions)) {
        q.questions.forEach((sub) => {
          if (sub.questionId) initial[sub.questionId] = "";
        });
      }
      if (Array.isArray(q.summary?.questions)) {
        q.summary.questions.forEach((sub) => {
          if (sub.questionId) initial[sub.questionId] = "";
        });
      }
    });
    setAnswers(initial);
    setTimeLeft(attemptData.timeLimit * 60);
  };

  useEffect(() => {
    if (!attempt) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitAssessment(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (!attemptId) return;
    const interval = setInterval(() => {
      if (timeLeft > 0) {
        API.patch(`/assessments/${attemptId}/timeleft`, { timeLeft }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [attemptId, timeLeft]);

  useEffect(() => {
    const handleBlur = () => {
      setWarnings((w) => {
        const newW = w + 1;
        alert(`⚠️ Warning ${newW}/3: Do not leave exam tab`);
        if (newW >= 3) submitAssessment(true);
        return newW;
      });
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const getQuestionType = (q) => String(q?.questionType || q?.type || "").toLowerCase();

  const isSummaryGroup = (q) => {
    const type = getQuestionType(q);
    return (
      type.includes("summary") ||
      !!q?.summary ||
      !!q?.summaryText ||
      (Array.isArray(q?.summary?.questions) && q.summary.questions.length > 0)
    );
  };

  const isComprehensionGroup = (q) => {
    const type = getQuestionType(q);
    if (type.includes("summary")) return false;
    return (
      type.includes("comprehension") ||
      !!q?.passage ||
      !!q?.passageText ||
      !!q?.sourceText ||
      !!q?.textToSummarize ||
      (Array.isArray(q?.questions) && q.questions.some((sub) => sub.passage || sub.passageText || sub.sourceText || sub.textToSummarize))
    );
  };

  const groupQuestionsBySectionPassage = (items, isSectionFn) => {
    const groups = [];

    items.forEach((item) => {
      if (!isSectionFn(item)) return;

      const sectionKey = String(
        item.sectionName || item.section || item.partName || item.part || item.summary?.sectionTitle || item.summary?.title || ""
      ).trim();
      const passageKey = String(
        item.passage || item.passageText || item.sourceText || item.textToSummarize || item.summary?.passage || ""
      ).trim();

      const existingGroup = groups.find(
        (group) => group.sectionKey === sectionKey && group.passageKey === passageKey
      );

      if (existingGroup) {
        if (Array.isArray(item.questions) && item.questions.length > 0) {
          existingGroup.questions = existingGroup.questions || [];
          existingGroup.questions.push(...item.questions);
        } else if (Array.isArray(item.summary?.questions) && item.summary.questions.length > 0) {
          existingGroup.summary = existingGroup.summary || { ...item.summary, questions: [] };
          existingGroup.summary.questions.push(...item.summary.questions);
        } else {
          existingGroup.questions = existingGroup.questions || [];
          existingGroup.questions.push(item);
        }
        existingGroup.instruction = existingGroup.instruction || item.instruction;
        existingGroup.section_title = existingGroup.section_title || item.section_title || item.title || item.sectionName;
      } else {
        const cloned = { ...item };
        if (Array.isArray(item.questions)) {
          cloned.questions = [...item.questions];
        }
        if (Array.isArray(item.summary?.questions)) {
          cloned.summary = { ...item.summary, questions: [...item.summary.questions] };
        }
        cloned.sectionKey = sectionKey;
        cloned.passageKey = passageKey;
        groups.push(cloned);
      }
    });

    return groups.map(({ sectionKey, passageKey, ...rest }) => rest);
  };

  const comprehensionGroups = groupQuestionsBySectionPassage((attempt.questions || []).filter(isComprehensionGroup), isComprehensionGroup);
  const summaryGroups = groupQuestionsBySectionPassage((attempt.questions || []).filter(isSummaryGroup), isSummaryGroup);

  const submitAssessment = async (skipConfirmation = false) => {
    try {
      const mergedAnswers = { ...answers };
      const domTextareas = Array.from(document.querySelectorAll('textarea[data-question-id]'));
      domTextareas.forEach((ta) => {
        const qid = ta.getAttribute('data-question-id');
        if (qid) mergedAnswers[qid] = ta.value;
      });

      const submitted = [];
      (attempt.questions || []).forEach((q, idx) => {
        if (Array.isArray(q.questions)) {
          q.questions.forEach((sub) => {
            submitted.push({ questionIndex: idx, questionId: sub.questionId, studentAnswer: mergedAnswers[sub.questionId] || "" });
          });
        } else if (Array.isArray(q.summary?.questions)) {
          q.summary.questions.forEach((sub) => {
            submitted.push({ questionIndex: idx, questionId: sub.questionId, studentAnswer: mergedAnswers[sub.questionId] || "" });
          });
        } else {
          submitted.push({ questionIndex: idx, questionId: q.questionId, studentAnswer: mergedAnswers[q.questionId] || "" });
        }
      });

      const unanswered = submitted.filter((item) => !String(item.studentAnswer || "").trim()).length;
      if (unanswered > 0) {
        setError(`Submitting ${submitted.length - unanswered}/${submitted.length} answered questions...`);
      }

      await API.post(`/assessments/submit/${attemptId}`, { answers: submitted });

      // trigger AI marking for the attempt (best-effort)
      try {
        await API.post(`/assessments/${attemptId}/ai-mark`);
      } catch (markErr) {
        console.warn('AI marking trigger failed', markErr?.response?.data || markErr.message || markErr);
      }

      alert("Assessment submitted successfully");
      window.location.href = `/attempt/${attemptId}`;
    } catch (err) {
      alert(err.response?.data?.message || "Submission failed");
    }
  };

  if (loading) {
    return <div className={pageWrapperClass}>Loading assessment...</div>;
  }

  if (error || !attempt) {
    return <div className={`${pageWrapperClass} text-red-500`}>{error || "Assessment not found"}</div>;
  }

  const objectiveQuestions = (attempt.questions || []).filter(
    (q) => !isComprehensionGroup(q) && !isSummaryGroup(q)
  );

  return (
    <div className={pageWrapperClass}>
      <div className={panelClass}>
        {/* Header */}
        <div className={headerClass}>
          <h1 className="font-bold text-xl">Assessment</h1>
          <div className={timerClass}>
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          <button
            onClick={submitAssessment}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Submit
          </button>
        </div>

        {/* Warning */}
        {warnings > 0 && (
          <div className="text-red-600 font-bold mb-3">
            ⚠️ Warnings: {warnings}/3
          </div>
        )}

        {/* Questions / Renderers */}
        <div className="space-y-4">
          {comprehensionGroups.length > 0 && (
            <ComprehensionRenderer
              groups={comprehensionGroups}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              attemptId={attemptId}
              partName={attempt.partName || attempt.selectedPart}
            />
          )}

          {summaryGroups.length > 0 && (
            <SummaryRenderer
              groups={summaryGroups}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              attemptId={attemptId}
              partName={attempt.partName || attempt.selectedPart}
            />
          )}

          {objectiveQuestions.length > 0 && (
            <ObjectiveRenderer
              questions={objectiveQuestions}
              answers={answers}
              onAnswerChange={handleAnswerChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}