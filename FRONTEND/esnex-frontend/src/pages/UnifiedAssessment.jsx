import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "../api/axios";
import AssessmentAccessModal from "../components/AssessmentAccessModal";
import TheoryResultPage from "../components/TheoryResultPage";

export default function UnifiedAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const subjectSlug = params.subject || null;
  const normalizedSubjectSlug = subjectSlug ? subjectSlug.trim().toLowerCase() : null;
  const routeAssessmentId = params.assessmentId || params.id || null;
  const assessmentId = !subjectSlug ? routeAssessmentId : null;
  const routePartParam = params.part || null;
  const routeSegments = location.pathname.split("/").filter(Boolean);
  const routeSection = routeSegments[3] || null;
  const routeSubsection = routeSegments[4] || null;
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
  const [showEssayModal, setShowEssayModal] = useState(false);
  const [essayTypes, setEssayTypes] = useState(["letter", "article", "debate", "story"]);
  const [selectedEssayType, setSelectedEssayType] = useState(null);
  const [essayQuestions, setEssayQuestions] = useState([]);
  const [selectedEssayQuestionId, setSelectedEssayQuestionId] = useState(null);
  const [oralTypes, setOralTypes] = useState([]);
  const [selectedOralType, setSelectedOralType] = useState("");
  const [selectedOralYear, setSelectedOralYear] = useState("");
  const [submissionResult, setSubmissionResult] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewMarks, setReviewMarks] = useState([]);
  const [visitedQuestions, setVisitedQuestions] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const lastAudioTimeRef = useRef(0);
  const audioSaveIntervalRef = useRef(null);
  const timeLeftRef = useRef(timeLeft);
  const answersRef = useRef(answers);
  const currentlyVisibleQuestionRef = useRef(0);
  const [resumePromptData, setResumePromptData] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [connectionStatus, setConnectionStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
  const [connectionMessage, setConnectionMessage] = useState("");
  const saveStatusTimerRef = useRef(null);
  const [hasServerEnrollment, setHasServerEnrollment] = useState(false);
  const [enrollmentInfo, setEnrollmentInfo] = useState(null);
  const [currentlyVisibleQuestion, setCurrentlyVisibleQuestion] = useState(0);
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);
  const questionRefs = useRef([]);
  const mainScrollRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const leaveCountRef = useRef(0);
  const [showWhyModal, setShowWhyModal] = useState(false);

  useEffect(() => {
    if (!showWhyModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowWhyModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWhyModal]);

  const [routeDrivenLoading, setRouteDrivenLoading] = useState(false);
  const [routeDrivenError, setRouteDrivenError] = useState(null);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (audioSaveIntervalRef.current) clearInterval(audioSaveIntervalRef.current);
    };
  }, []);

  const handlePlayAudio = (question, index) => {
    if (!question?.audio) return;
    if (playingAudioIndex === index && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
      setPlayingAudioIndex(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }

    const player = new Audio(question.audio);
    player.onended = () => setPlayingAudioIndex(null);
    player.play().catch(() => {
      setPlayingAudioIndex(null);
    });
    audioPlayerRef.current = player;
    setPlayingAudioIndex(index);
  };

  const assessmentType = isSubjectMode ? "subject" : new URLSearchParams(window.location.search).get("type") || "global";

  const getQuestionOptions = (q) => {
    if (!q?.options) return [];
    if (Array.isArray(q.options)) return q.options;
    if (typeof q.options === "object") return Object.values(q.options).filter((opt) => opt !== undefined && opt !== null);
    return [];
  };

  const isChoiceQuestion = (q) => {
    const options = getQuestionOptions(q);
    return options.length > 0;
  };

  const isTextEntryQuestion = (q) => {
    const type = (q?.type || q?.questionType || "").toString().toLowerCase();
    const textTypes = [
      "theory",
      "essay",
      "comprehension",
      "summary",
      "text",
      "textarea",
      "long-answer",
      "long answer",
      "letter",
      "article",
      "story",
      "debate",
      "oral",
    ];
    if (textTypes.includes(type)) return true;
    if (!q?.options && Boolean(q?.prompt || q?.question || q?.text)) return true;
    if (q?.passage || Array.isArray(q?.questions) || (q?.summary && Array.isArray(q?.summary.questions))) return true;
    return false;
  };

  const isTheoryLikeQuestion = (q) => {
    const type = (q?.type || q?.questionType || "").toString().toLowerCase();
    const theoryTypes = [
      "theory",
      "essay",
      "comprehension",
      "summary",
      "reading",
      "oral",
      "text",
      "textarea",
      "long-answer",
      "long answer",
    ];
    return theoryTypes.some((term) => type.includes(term));
  };

  const shouldUseTheoryResults = (questions = []) => {
    if (!Array.isArray(questions) || questions.length === 0) return false;
    return questions.some(isTheoryLikeQuestion);
  };

  const normalizeSectionKey = (value) => String(value || "").trim().toLowerCase();
  const getSectionMeta = (sectionKey) => {
    if (!Array.isArray(selectedPartMeta?.sections)) return null;
    const normalizedKey = normalizeSectionKey(sectionKey);
    return selectedPartMeta.sections.find((section) => {
      const candidate = normalizeSectionKey(section.key || section.name || section.sectionName || section.title || section.heading);
      return (
        candidate &&
        (candidate === normalizedKey || normalizedKey.includes(candidate) || candidate.includes(normalizedKey))
      );
    }) || null;
  };

  const getQuestionText = (question) => {
    if (!question || typeof question !== "object") return "";
    return String(question.prompt || question.question || question.text || question.title || question.name || "").trim();
  };

  const getQuestionMediaSrc = (question) => {
    if (!question || typeof question !== "object") return null;
    const media = question.image || question.diagram || question.illustration || question.media || null;
    return typeof media === "string" ? media.trim() || null : media;
  };

  const getQuestionPassage = (question, sectionMeta) => {
    if (!question || typeof question !== "object") return null;
    const passage = question.passage || question.passageText || question.sourceText || question.textToSummarize || question.material || question.body || question.summary?.passage;
    if (passage) return passage;
    if (sectionMeta?.passage) return sectionMeta.passage;
    if (sectionMeta?.summary?.passage) return sectionMeta.summary.passage;
    if (sectionMeta?.summary?.questions && sectionMeta.summary.questions.length > 0) {
      const firstSummaryQuestion = sectionMeta.summary.questions[0];
      if (firstSummaryQuestion?.passage) return firstSummaryQuestion.passage;
    }
    return null;
  };

  const getSectionKey = (question) => {
    if (!question || typeof question !== "object") return "";
    return String(question.sectionName || question.section || question.partName || question.part || "").trim();
  };

  const getSectionStartIndex = (sectionName) => {
    if (!assessment || !Array.isArray(assessment)) return -1;
    return assessment.findIndex((q) => getSectionKey(q) === sectionName);
  };

  const isFirstQuestionInSection = (index) => {
    if (!assessment || !Array.isArray(assessment) || index == null) return false;
    const sectionName = getSectionKey(assessment[index]);
    return getSectionStartIndex(sectionName) === index;
  };

  const formatTimeAmount = (seconds) => {
    const minutes = Math.max(0, Math.floor(seconds / 60));
    if (minutes === 0) return "less than a minute";
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  };

  const updateSaveStatus = (status) => {
    setSaveStatus(status);
    if (status === "saved") {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const clearCurrentAttemptCache = (id) => {
    try {
      window.localStorage.removeItem('currentAttemptId');
      if (id) window.localStorage.removeItem(`attempt_${id}`);
    } catch (e) {
      console.warn("Unable to clear attempt cache", e);
    }
  };

  const syncAttemptState = async () => {
    if (!attemptId || !navigator.onLine) return;
    setConnectionStatus("syncing");
    setConnectionMessage("Syncing answers...");
    updateSaveStatus("saving");

    try {
      await API.post(`/assessments/${attemptId}/answer`, {
        timeLeft: timeLeftRef.current,
        currentQuestionIndex: currentlyVisibleQuestionRef.current,
      });
      setConnectionStatus("online");
      setConnectionMessage("Synced successfully.");
      updateSaveStatus("saved");
    } catch (error) {
      console.warn("Reconnect sync failed", error);
      setConnectionStatus("offline");
      setConnectionMessage("Unable to sync yet. Answers will remain saved locally.");
      updateSaveStatus("error");
    }
  };

  const handleOfflineMode = () => {
    setConnectionStatus("offline");
    setConnectionMessage("Connection lost. Answers will be saved locally. Reconnecting...");
    updateSaveStatus("idle");
  };

  const handleOnlineMode = async () => {
    setConnectionStatus("online");
    setConnectionMessage("Connection restored. Syncing answers...");
    await syncAttemptState();
  };

  const applyResumeAttempt = (attempt, persistedState) => {
    const qs = attempt.questions || [];
    const finalAnswers = Array.isArray(persistedState?.answers) && persistedState.answers.length === qs.length
      ? persistedState.answers
      : mapSavedAnswersToQuestions(qs, attempt.answers || []);

    setAssessment(qs.map((q) => ({ ...q, part: q.part || q.partName || selectedPart })));
    setAttemptId(attempt._id || attempt.id || attempt.attemptId || null);
    setAnswers(finalAnswers);
    setReviewMarks(new Array(qs.length).fill(false));
    const initialVisited = new Array(qs.length).fill(false);
    finalAnswers.forEach((answer, index) => {
      if (!isBlankAnswer(answer)) initialVisited[index] = true;
    });
    if (qs.length > 0) initialVisited[0] = true;
    setVisitedQuestions(initialVisited);
    setStarted(true);
    const restoredTimeLeft = persistedState?.timeLeft != null ? Number(persistedState.timeLeft) : Number(attempt.timeLeft) || 0;
    const restoredStartTime = persistedState?.startedAt
      ? new Date(persistedState.startedAt).getTime()
      : attempt.startedAt
      ? new Date(attempt.startedAt).getTime()
      : Date.now();
    setTimeLeft(restoredTimeLeft);
    setStartTime(Number.isFinite(restoredStartTime) ? restoredStartTime : Date.now());
    if (attempt.fullAudio) {
      try {
        setTimeout(() => initGlobalOralAudio(attempt.fullAudio), 100);
        lastAudioTimeRef.current = Number(attempt.audioCurrentTime || 0);
      } catch (e) {
        console.warn("Failed to restore oral audio", e);
      }
    }
  };

  const handleStartNewAttempt = () => {
    if (resumePromptData?.attemptId) clearCurrentAttemptCache(resumePromptData.attemptId);
    setResumePromptData(null);
    setStatusMessage("You can start a new attempt from the assessment menu.");
  };

  const handleResumeAttempt = async () => {
    if (!resumePromptData) return;
    const { attempt } = resumePromptData;
    const persistedAnswerState = (() => {
      try {
        return window.localStorage.getItem(`attempt_${resumePromptData.attemptId}`)
          ? JSON.parse(window.localStorage.getItem(`attempt_${resumePromptData.attemptId}`))
          : null;
      } catch (e) {
        return null;
      }
    })();
    applyResumeAttempt(attempt, persistedAnswerState);
    setResumePromptData(null);
    setStatusMessage("Resumed your in-progress assessment.");
    await syncAttemptState();
  };

  useEffect(() => {
    const handleOnline = () => {
      handleOnlineMode();
    };
    const handleOffline = () => {
      handleOfflineMode();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [attemptId]);

  const isPassageSection = (question) => {
    return (
      question && typeof question === "object" &&
      (Array.isArray(question.questions) || (question.summary && Array.isArray(question.summary.questions))) &&
      (Array.isArray(question.passage) || typeof question.passage === "string")
    );
  };

  const normalizeAnswerValue = (answer) => {
    if (answer === null || answer === undefined) return "";
    if (typeof answer === "string" || typeof answer === "number" || Array.isArray(answer)) return answer;
    if (typeof answer === "object") {
      return answer.studentAnswer ?? answer.answer ?? answer.value ?? "";
    }
    return String(answer);
  };

  const mapSavedAnswersToQuestions = (questions, savedAnswers) => {
    if (!Array.isArray(questions)) return [];
    const answerMap = new Map();
    if (Array.isArray(savedAnswers)) {
      savedAnswers.forEach((item) => {
        if (!item) return;
        const key = item.questionId || item.question?.questionId || item.question?._id || item._id;
        if (key != null) answerMap.set(String(key), item);
        if (item.questionIndex != null) answerMap.set(`index:${Number(item.questionIndex)}`, item);
      });
    }

    return questions.map((question, index) => {
      const sectionQuestions = getSectionQuestions(question);
      const questionKey = String(question._id || question.questionId || question.id || index);
      const savedGroup = answerMap.get(questionKey) || answerMap.get(`index:${Number(index)}`) || answerMap.get(String(index));
      const groupText = savedGroup != null ? normalizeAnswerValue(savedGroup.studentAnswer ?? savedGroup.answer ?? savedGroup.value ?? savedGroup) : null;

      if (Array.isArray(sectionQuestions) && sectionQuestions.length > 0) {
        const splitParts = typeof groupText === "string"
          ? groupText
              .split(/\r?\n/)
              .map((part) => part.replace(/^[a-zA-Z]\.\s*/, "").trim())
          : [];

        return sectionQuestions.map((subQuestion, subIndex) => {
          const subKey = subQuestion.questionId || subQuestion._id || subQuestion.id || null;
          let saved = subKey ? answerMap.get(String(subKey)) : null;
          if (saved == null && splitParts.length === sectionQuestions.length) {
            return splitParts[subIndex] || "";
          }
          if (saved == null) return "";
          return normalizeAnswerValue(saved.studentAnswer ?? saved.answer ?? saved.value ?? saved);
        });
      }

      if (savedGroup == null) return "";
      return normalizeAnswerValue(savedGroup.studentAnswer ?? savedGroup.answer ?? savedGroup.value ?? savedGroup);
    });
  };

  const getSectionQuestions = (question) => {
    if (!question || typeof question !== "object") return [];
    if (Array.isArray(question.questions) && question.questions.length > 0) return question.questions;
    if (question.summary && Array.isArray(question.summary.questions)) return question.summary.questions;
    return [];
  };

  const getPassageInstructions = (question, sectionMeta) => {
    return (
      question?.instruction ||
      question?.summary?.instruction ||
      sectionMeta?.instructions ||
      sectionMeta?.instruction ||
      ""
    );
  };

  /* =========================
     FETCH ASSESSMENT METADATA
  ========================= */
  const fetchAssessmentMeta = async () => {
    try {
      setLoading(true);
      setStatusMessage("");
      const endpoint = isSubjectMode
        ? `/assessments/global/subject/${normalizedSubjectSlug}`
        : assessmentType === "global"
        ? `/assessments/global/${assessmentId}`
        : `/assessments/${assessmentId}`;
      const res = await API.get(endpoint);
      const data = res.data.assessment;
      // If we loaded an assessment by id but it actually belongs to a subject,
      // redirect to the subject-based route so the start flow uses the correct endpoints.
      if (!isSubjectMode && data?.subject) {
        navigate(`/assessment/subject/${data.subject}`);
        return;
      }
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

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  // Route-driven flow: when the URL includes /assessment/:assessmentId/:part/... load or show selectors
  useEffect(() => {
    if (!assessmentMeta) return;

    const segments = location.pathname.split("/").filter(Boolean);
    // Subject route example: ['assessment','subject','english','theory','essay','letter']
    // Assessment by id route example: ['assessment','123','theory','essay','letter']
    const part = routePartParam || (isSubjectMode ? segments[3] : segments[2]) || null;
    const section = isSubjectMode ? segments[4] || null : segments[3] || null;
    const subsection = isSubjectMode ? segments[5] || null : segments[4] || null;

    // If part is theory with no section, we just show the theory selector (no load)
    if (!part) return;
    if (String(part).toLowerCase() === "theory" && !section) return;
    if (String(part).toLowerCase() === "theory" && String(section).toLowerCase() === "essay" && !subsection) return;

    // Otherwise start the part to create an attempt and load questions
    const startPart = async () => {
      try {
        setRouteDrivenError(null);
        setRouteDrivenLoading(true);

        const payload = { subject: assessmentMeta?.subject || subjectSlug || "", partName: part };
        if (section) payload.section = section;
        if (subsection) payload.subsection = subsection;
        // If theory->essay->type, include essayType
        if (String(part).toLowerCase() === "theory" && String(section).toLowerCase() === "essay" && subsection) {
          payload.essayType = subsection;
        }
        // For oral parts, include selected oralType/year if provided via location.state
        if (String(part).toLowerCase() === "oral" && location.state?.oralType) {
          payload.oralType = location.state.oralType;
          if (location.state.oralYear) payload.oralYear = location.state.oralYear;
        }

        const res = await API.post(`/assessments/global/assessment/start-part`, payload);
        const data = res.data || {};
        const qs = data.questions || [];
        const persistedAnswerState = (() => {
          try {
            return data.attemptId ? JSON.parse(window.localStorage.getItem(`attempt_${data.attemptId}`) || "null") : null;
          } catch (e) {
            return null;
          }
        })();

        const restoredAnswers = mapSavedAnswersToQuestions(qs, data.answers || []);
        const initialAnswers = Array.isArray(restoredAnswers) && restoredAnswers.length === qs.length
          ? restoredAnswers
          : new Array(qs.length).fill("");

        const localAnswerFallback = Array.isArray(persistedAnswerState?.answers) && persistedAnswerState.answers.length === qs.length
          ? persistedAnswerState.answers
          : null;

        const finalAnswers = localAnswerFallback || initialAnswers;

        setAttemptId(data.attemptId || null);
        if (data.attemptId) {
          try { window.localStorage.setItem('currentAttemptId', String(data.attemptId)); } catch (e) {}
        }

        setAssessment(qs);
        setAnswers(finalAnswers);
        setReviewMarks(new Array(qs.length).fill(false));
        const initialVisited = new Array(qs.length).fill(false);
        finalAnswers.forEach((answer, index) => {
          if (!isBlankAnswer(answer)) initialVisited[index] = true;
        });
        if (qs.length > 0) initialVisited[0] = true;
        setVisitedQuestions(initialVisited);
        setStarted(true);
        const initialTimeValue = Number(data.timeLeft ?? persistedAnswerState?.timeLeft ?? data.timeLimit ?? data.duration ?? 0) || 0;
        setTimeLeft(initialTimeValue);
        setStartTime(persistedAnswerState?.startedAt || Date.now());
        if (data.fullAudio) {
          try {
            initGlobalOralAudio(data.fullAudio);
          } catch (e) {
            console.error("Failed to init oral audio", e);
          }
        }
      } catch (err) {
        console.error("Start part failed", err);
        setRouteDrivenError(err.response?.data?.message || "Unable to start this part");
      } finally {
        setRouteDrivenLoading(false);
      }
    };

    startPart();
  }, [assessmentMeta, location.pathname, routePartParam]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    currentlyVisibleQuestionRef.current = currentlyVisibleQuestion;
  }, [currentlyVisibleQuestion]);

  useEffect(() => {
    if (!attemptId) return;
    try {
      window.localStorage.setItem(`attempt_${attemptId}`, JSON.stringify({
        answers,
        timeLeft,
        currentQuestionIndex: currentlyVisibleQuestion,
        lastSaved: Date.now(),
        startedAt: startTime,
      }));
    } catch (e) {
      console.warn("Unable to persist attempt locally", e);
    }
  }, [attemptId, answers, timeLeft, currentlyVisibleQuestion, startTime]);

  useEffect(() => {
    if (!started || !attemptId) return;
    const interval = setInterval(() => {
      if (!navigator.onLine) {
        setConnectionStatus("offline");
        setConnectionMessage("Offline: local progress saved. Reconnecting...");
        updateSaveStatus("idle");
        return;
      }
      syncAttemptState();
    }, 30000);

    return () => clearInterval(interval);
  }, [attemptId, started]);

  const fetchEnrollmentStatus = async () => {
    if (!assessmentMeta?._id) return;
    try {
      const res = await API.get("/assessments/enrolled");
      const enrolledAssessments = res.data.assessments || [];
      const match = enrolledAssessments.find((item) => {
        const assessmentId = item._id ? String(item._id) : null;
        const expectedId = assessmentMeta._id ? String(assessmentMeta._id) : null;
        const enrolledById = assessmentId && expectedId && assessmentId === expectedId;
        const enrolledBySubject = item.subject && assessmentMeta.subject
          ? item.subject.toString().toLowerCase() === assessmentMeta.subject.toString().toLowerCase()
          : false;
        return enrolledById || enrolledBySubject;
      });

      setHasServerEnrollment(Boolean(match));
      setEnrollmentInfo(match || null);
    } catch (err) {
      setHasServerEnrollment(false);
      setEnrollmentInfo(null);
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

    const handleStorage = (event) => {
      if (!event.key || event.key === "assessmentEnrollments") {
        refreshIfEnrollmentChanged();
      }
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

  // Restore an in-progress attempt if present in localStorage/server
  useEffect(() => {
    const tryRestore = async () => {
      if (routePartParam) return;
      try {
        const saved = window.localStorage.getItem('currentAttemptId');
        if (!saved) return;
        const id = String(saved);
        const res = await API.get(`/assessments/attempt/${id}`);
        const attempt = res.data.attempt || res.data;
        if (!attempt) return;
        if (attempt.status && attempt.status !== 'in-progress') {
          window.localStorage.removeItem('currentAttemptId');
          return;
        }

        const attemptPart = attempt.selectedPart || attempt.partName || "Unknown";
        const partNames = {
          A: "Objective",
          B: "Theory",
          C: "Oral",
          D: "Practical",
          objective: "Objective",
          theory: "Theory",
          oral: "Oral",
          practical: "Practical",
        };
        const attemptSubject = attempt.subject || assessmentMeta?.subject || assessmentMeta?.title || "Assessment";

        setResumePromptData({
          attemptId: attempt._id || id,
          attempt,
          subject: attemptSubject,
          partName: attemptPart,
          partLabel: partNames[attemptPart] || attemptPart,
          timeLeft: Number(attempt.timeLeft) || 0,
        });
      } catch (err) {
        // ignore
      }
    };
    tryRestore();
  }, [routePartParam, assessmentMeta]);

  useEffect(() => {
    if (location.state?.paymentSuccess) {
      setStatusMessage(location.state.paymentMessage || "Payment successful! Access refreshed.");
      fetchAssessmentMeta();
      fetchEnrollmentStatus();
    }
  }, [location.state]);

  useEffect(() => {
    const loadOralTypes = async () => {
      if (!assessmentMeta?.subject || selectedPart !== "C") {
        setOralTypes([]);
        setSelectedOralType("");
        return;
      }
      if (String(assessmentMeta.subject).toLowerCase() !== "english") {
        setOralTypes([]);
        setSelectedOralType("");
        return;
      }

      try {
        const endpoint = `/assessments/global/subject/${String(assessmentMeta.subject || "").trim().toLowerCase()}/oral-types`;
        const res = await API.get(endpoint);
        const types = res.data.types || [];
        setOralTypes(types);

        const currentType = types.find((type) => type.key === selectedOralType);
        if (types.length && !currentType) {
          const defaultType = types[0];
          setSelectedOralType(defaultType.key || "");
          setSelectedOralYear((defaultType.years && defaultType.years[0]) || "");
        } else if (currentType) {
          setSelectedOralYear((currentType.years && currentType.years[0]) || "");
        }
      } catch (error) {
        setOralTypes([]);
        setSelectedOralType("");
        setSelectedOralYear("");
      }
    };

    loadOralTypes();
  }, [assessmentMeta?.subject, selectedPart]);


  /* =========================
     SCROLL DETECTION FOR CURRENT QUESTION
  ========================= */
  useEffect(() => {
    if (!started || !assessment || assessment.length === 0) return;

    const handleScroll = () => {
      if (!mainScrollRef.current) return;

      const scrollContainer = mainScrollRef.current;
      const scrollTop = scrollContainer.scrollTop;
      const containerRect = scrollContainer.getBoundingClientRect();
      const containerHeight = scrollContainer.clientHeight;
      const midPoint = scrollTop + containerHeight / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      questionRefs.current.forEach((ref, index) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const refTop = rect.top - containerRect.top + scrollTop;
        const refMiddle = refTop + rect.height / 2;
        const distance = Math.abs(refMiddle - midPoint);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setCurrentlyVisibleQuestion(closestIndex);
      setVisitedQuestions((prev) => {
        const next = Array.isArray(prev) && prev.length === assessment.length ? [...prev] : new Array(assessment.length).fill(false);
        next[closestIndex] = true;
        return next;
      });
    };

    const scrollElement = mainScrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll);
      handleScroll(); // Initial call
      return () => scrollElement.removeEventListener("scroll", handleScroll);
    }
  }, [started, assessment]);

  const assessmentPaid = useMemo(() => {
    if (!assessmentMeta) return false;
    return Boolean(
      assessmentMeta.isEnrolledAssessment ||
      assessmentMeta.price === 0 ||
      hasServerEnrollment
    );
  }, [assessmentMeta, hasServerEnrollment]);

  const accessPriceLabel = assessmentMeta
    ? `D${assessmentMeta.price || 10}/${assessmentMeta.subscription || "month"}`
    : "D10/month";

  const remainingDaysText = useMemo(() => {
    if (!enrollmentInfo || enrollmentInfo.daysRemaining == null) return null;
    if (enrollmentInfo.daysRemaining <= 0) return "Expires today";
    if (enrollmentInfo.daysRemaining === 1) return "1 day remaining";
    return `${enrollmentInfo.daysRemaining} days remaining`;
  }, [enrollmentInfo]);

  const startAttempt = async () => {
    try { window.__lastStartAttempt = {calledAt: Date.now(), selectedPart, selectedEssayType, selectedEssayQuestionId}; } catch(e){}
    if (!acceptedRules) {
      setStatusMessage("Please accept the rules before starting the assessment.");
      return;
    }

    if (!selectedPart || !uniqueAvailableParts.includes(selectedPart)) {
      setStatusMessage("Please select a valid assessment part.");
      return;
    }

    if (selectedPartMeta?.partType?.toString().toLowerCase() === "oral" && oralTypes.length > 0 && !selectedOralType) {
      setStatusMessage("Please select an oral exam type before starting the assessment.");
      return;
    }

    try {
      setLoading(true);
      const endpoint = isSubjectMode
        ? `/assessments/global/subject/${normalizedSubjectSlug}/start`
        : assessmentType === "global"
        ? `/assessments/global/start/${assessmentId}`
        : `/assessments/course-section/start/${assessmentId}`;
      const selectedPartCode = mapPartStringToCode(selectedPart) || selectedPart;
      const payload = {
        selectedPart: selectedPartCode,
        assessmentPaid,
        assessmentId: assessmentMeta?._id,
      };
      if (selectedEssayType) payload.essayType = selectedEssayType;
      if (selectedEssayQuestionId) payload.essayQuestionId = selectedEssayQuestionId;
      if (selectedOralType) payload.oralType = selectedOralType;
      if (selectedOralYear) payload.oralYear = selectedOralYear;
      const res = await API.post(endpoint, payload);
      const attempt = res.data.attempt || (res.data.questions ? { _id: res.data.attemptId || null, questions: res.data.questions } : null);
      const timeLimit = res.data.timeLimit;
      const id = attempt?._id || attempt?.id || res.data.attemptId || null;
      const questionData = attempt?.questions || res.data.questions || [];
      const normalizedQuestions = (questionData || []).map((question) => ({
        ...question,
        part: question.part || question.partName || selectedPartCode,
      }));
      setAssessment(normalizedQuestions);
      setAttemptId(id);
      try { window.localStorage.setItem('currentAttemptId', String(id)); } catch (e) {}
      // initialize answers: use empty string for single questions, or an array for passage/sub-question groups
      const initialAnswers = normalizedQuestions.map((q) => {
        const subs = getSectionQuestions(q);
        if (Array.isArray(subs) && subs.length > 0) return new Array(subs.length).fill("");
        return "";
      });
      setAnswers(initialAnswers);
      setReviewMarks(new Array(normalizedQuestions.length).fill(false));
      const initialVisited = new Array(normalizedQuestions.length).fill(false);
      if (normalizedQuestions.length > 0) initialVisited[0] = true;
      setVisitedQuestions(initialVisited);
      const startingSeconds = (timeLimit ?? assessmentMeta?.timeLimit ?? assessmentMeta?.duration ?? 0) * 60;
      setTimeLeft(startingSeconds);
      setStartTime(Date.now());
      setStarted(true);
      // If server provided a fullAudio for oral parts, initialize global audio player
      if (res.data.fullAudio) {
        try {
          initGlobalOralAudio(res.data.fullAudio);
        } catch (e) {
          console.error('Failed to init oral audio', e);
        }
      }
      setSubmissionResult(null);
      setStatusMessage("");
      enterFullScreen();
      return true;
    } catch (err) {
      if (err.response?.status === 402 || err.response?.status === 403 || err.response?.status === 401) {
        // Payment required or subscription expired
        const responseData = err.response?.data;
        if (responseData?.requiresPayment) {
          setStatusMessage("");
          setShowAccessModal(true);
        } else {
          setStatusMessage(err.response?.data?.message || "Access denied. Please enroll first.");
        }
      } else {
        setStatusMessage(err.response?.data?.message || "Unable to start the assessment.");
      }
      return false;
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
        const sectionQuestionCount = Array.isArray(part.sections)
          ? part.sections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0)
          : 0;
        const count = sectionQuestionCount || Number(part.totalQuestions || part.questionCount || 0) || 0;
        if (partType === "objective") counts.objectiveCount += count;
        if (partType === "theory") counts.theoryCount += count;
        if (partType === "oral") counts.oralCount += count;
        if (partType === "practical") counts.practicalCount += count;
        return counts;
      },
      { objectiveCount: 0, theoryCount: 0, oralCount: 0, practicalCount: 0 }
    );
  };

  const getPartLetter = (part, index) => {
    const explicit = mapPartStringToCode(part.partType || part.type || part.partName || part.name || "");
    if (explicit) return explicit;
    return String.fromCharCode(65 + index);
  };

  const parts = Array.isArray(assessmentMeta?.parts) ? assessmentMeta.parts : [];
  const partLetters = parts.map((part, index) => getPartLetter(part, index));
  const allowedPartCodes = Array.isArray(assessmentMeta?.allowedParts)
    ? assessmentMeta.allowedParts.map(mapPartStringToCode).filter(Boolean)
    : [];
  const configuredParts = [...new Set([...(partLetters.length > 0 ? partLetters : ["A", "B"]), ...allowedPartCodes])];
  const uniqueAvailableParts = configuredParts.filter((code) => code && code.length === 1);

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

  const selectedPartIndex = partLetters.indexOf(selectedPart) >= 0
    ? partLetters.indexOf(selectedPart)
    : Math.max(0, Math.min(parts.length - 1, selectedPart.charCodeAt(0) - 65));
  const selectedPartMeta = Array.isArray(parts) ? parts[selectedPartIndex] || parts[0] : null;
  const selectedPartQuestionCount = selectedPartMeta?.sections?.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0) || 0;
  const selectedPartDuration = Number(selectedPartMeta?.duration || assessmentMeta?.duration || 0);

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

    // Prefer the theory part when theory questions exist and are available,
    // since this subject is expected to use essay grading and WAEC rubric flow.
    const preferredOrder = ["B", "A", "C", "D"];
    for (const part of preferredOrder) {
      if (allowedWithQuestions.includes(part)) return part;
    }

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
    if (!started) return;

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
  }, [started]);

  /* =========================
     ANTI CHEATING SYSTEM
     - Attach visibilitychange to `document` (standards-compliant)
     - Report tab switches to backend `/tab-switch` and follow backend action
  ========================= */
  useEffect(() => {
    if (!started) return;

    const handleLeave = async () => {
      // Prefer server-side decision; fall back to local warning if network fails
      try {
        if (!attemptId) return;
        const resp = await API.post(`/assessments/${attemptId}/tab-switch`);
        const data = resp?.data || {};
        setWarnings(data.warnings || 0);
        setStatusMessage("Do not leave this tab during the assessment.");
        if (data.action === "auto-submit") {
          submitAssessment(true);
        }
      } catch (err) {
        console.warn("Tab switch reporting failed, falling back to client-side warning", err);
        leaveCountRef.current += 1;
        setWarnings(leaveCountRef.current);
        setStatusMessage("Do not leave this tab during the assessment.");
        // Do NOT auto-submit client-side; rely on server when possible
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        handleLeave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleLeave);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleLeave);
    };
  }, [started, attemptId]);

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

  // Stronger navigation prevention while assessment is in progress
  useEffect(() => {
    if (!started || submissionResult) return;

    const preventNavigationClick = (e) => {
      try {
        const anchor = e.target.closest && e.target.closest('a');
        if (anchor && anchor.getAttribute) {
          const href = anchor.getAttribute('href');
          if (href && href !== '#' && !href.startsWith('javascript:')) {
            e.preventDefault();
            alert('You cannot leave the assessment while it is in progress. Please submit or wait for timeout.');
          }
        }
        // prevent logout or navigation buttons
        const btn = e.target.closest && e.target.closest('button');
        if (btn && /logout|log out/i.test(btn.textContent || '')) {
          e.preventDefault();
          alert('You cannot log out during an in-progress assessment.');
        }
      } catch (err) {
        // ignore
      }
    };

    const preventNavKeys = (e) => {
      // common navigation shortcuts: Ctrl+R, F5, Ctrl+W, Alt+Left
      if ((e.ctrlKey && e.key && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'w')) || e.key === 'F5' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        alert('Navigation is disabled during the assessment. Use the submit button.');
      }
      // block Ctrl+Tab (browser tab switch) -- best-effort
      if (e.ctrlKey && e.key && e.key.toLowerCase() === 'tab') {
        e.preventDefault();
      }
    };

    const reinforceHistory = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch (e) {}
    };

    document.addEventListener('click', preventNavigationClick, true);
    window.addEventListener('keydown', preventNavKeys, true);
    const histInterval = setInterval(reinforceHistory, 1000);

    return () => {
      document.removeEventListener('click', preventNavigationClick, true);
      window.removeEventListener('keydown', preventNavKeys, true);
      clearInterval(histInterval);
    };
  }, [started, submissionResult]);

  /* =========================
     HANDLE ANSWERS
  ========================= */
  const handleChange = (index, value, subIndex = null) => {
    const updated = Array.isArray(answers) ? [...answers] : [];
    // handle sub-question answer updates (answers[index] is an array)
    if (subIndex !== null) {
      const bucket = Array.isArray(updated[index]) ? [...updated[index]] : [];
      bucket[subIndex] = value;
      updated[index] = bucket;
    } else {
      updated[index] = value;
    }
    setAnswers(updated);
    // keep a ref to the latest answers for synchronous access (eg. auto-submit)
    answersRef.current = updated;
    updateSaveStatus("saving");

    if (!started || !attemptId) return;

    const question = assessment?.[index] || {};
    let questionId = question.questionId || question._id || question.id || index;
    if (subIndex !== null && Array.isArray(question.questions) && question.questions[subIndex]) {
      questionId = question.questions[subIndex].questionId || question.questions[subIndex]._id || question.questions[subIndex].id || questionId;
    }
    const partName = routePartParam || selectedPart || null;
    const payload = {
      answer: { studentAnswer: value },
      questionId,
      questionIndex: index,
      partName,
      sectionName: routeSection || routeSubsection || null,
      currentQuestionIndex: currentlyVisibleQuestionRef.current,
      timeLeft: timeLeftRef.current,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
    };

    if (!navigator.onLine) {
      setConnectionStatus("offline");
      setConnectionMessage("You are offline. Answers will be saved locally until reconnect.");
      return;
    }

    API.post(`/assessments/${attemptId}/answer`, payload)
      .then(() => {
        updateSaveStatus("saved");
        setConnectionStatus("online");
        setConnectionMessage("✓ Saved");
      })
      .catch((error) => {
        console.warn("Answer autosave failed", error);
        setConnectionStatus("offline");
        setConnectionMessage("Unable to sync answer. Saved locally.");
        updateSaveStatus("error");
      });
  };

  // keep answersRef in sync with state changes
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const toggleReviewMark = (index) => {
    const updated = Array.isArray(reviewMarks) ? [...reviewMarks] : [];
    updated[index] = !updated[index];
    setReviewMarks(updated);
  };

  const isBlankAnswer = (answer) => {
    if (answer === null || answer === undefined) return true;
    if (typeof answer === "string") return answer.trim() === "";
    if (Array.isArray(answer)) return answer.every(isBlankAnswer);
    if (typeof answer === "object") return Object.values(answer).every(isBlankAnswer);
    return false;
  };

  const scrollToQuestion = (index) => {
    const target = questionRefs.current[index];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setVisitedQuestions((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next[index] = true;
      return next;
    });
  };

  const answeredCount = useMemo(() => {
    if (!answers || !Array.isArray(answers)) return 0;
    return answers.filter((answer) => {
      if (answer === null || answer === undefined) return false;
      if (typeof answer === "string") return answer.trim() !== "";
      if (Array.isArray(answer)) return answer.length > 0;
      if (typeof answer === "object") return Object.keys(answer).length > 0;
      return true;
    }).length;
  }, [answers]);

  const markedCount = useMemo(() => {
    if (!Array.isArray(reviewMarks)) return 0;
    return reviewMarks.filter(Boolean).length;
  }, [reviewMarks]);

  const unansweredCount = useMemo(() => {
    if (!assessment || !Array.isArray(assessment)) return 0;
    return Math.max(0, assessment.length - answeredCount);
  }, [assessment, answeredCount]);

  const sectionPartItems = useMemo(() => {
    if (!assessmentMeta?.parts || !Array.isArray(assessmentMeta.parts)) return [];
    return assessmentMeta.parts.map((part, index) => ({
      title: part.partName || part.title || part.type || `Part ${String.fromCharCode(65 + index)}`,
      count: Number(part.totalQuestions ?? part.questionCount ?? 0),
    }));
  }, [assessmentMeta]);

  const nextQuestionIndex = useMemo(() => {
    if (!answers || !Array.isArray(answers)) return 0;
    const firstBlank = answers.findIndex((answer) => {
      if (answer === null || answer === undefined) return true;
      if (typeof answer === "string") return answer.trim() === "";
      if (Array.isArray(answer)) return answer.length === 0;
      if (typeof answer === "object") return Object.keys(answer).length === 0;
      return false;
    });
    return firstBlank === -1 ? (assessment?.length ? assessment.length - 1 : 0) : firstBlank;
  }, [answers, assessment]);

  const questionProgressPercentage = useMemo(() => {
    if (!assessment || !Array.isArray(assessment) || assessment.length === 0) return 0;
    return Math.round((answeredCount / assessment.length) * 100);
  }, [assessment, answeredCount]);

  const visitedCount = useMemo(() => {
    if (!Array.isArray(visitedQuestions)) return 0;
    return visitedQuestions.filter(Boolean).length;
  }, [visitedQuestions]);

  const notVisitedCount = useMemo(() => {
    if (!assessment || !Array.isArray(assessment)) return 0;
    return Math.max(0, assessment.length - visitedCount);
  }, [assessment, visitedCount]);

  const currentQuestion = assessment?.[currentlyVisibleQuestion] || null;
  const currentSectionName = currentQuestion?.sectionName || currentQuestion?.section || currentQuestion?.partName || currentQuestion?.part || "Section A";

  const sectionQuestionInfo = useMemo(() => {
    if (!assessment || !Array.isArray(assessment)) {
      return { total: 0, answered: 0, unanswered: 0 };
    }

    const normalizedSection = currentSectionName.toString();
    let total = 0;
    let answered = 0;

    assessment.forEach((q, index) => {
      const questionSection = q.sectionName || q.section || q.partName || q.part || "";
      if (questionSection.toString() !== normalizedSection) return;
      total += 1;
      const answer = answers[index];
      if (answer === null || answer === undefined) return;
      if (typeof answer === "string" && answer.trim() === "") return;
      if (Array.isArray(answer) && answer.length === 0) return;
      if (typeof answer === "object" && Object.keys(answer).length === 0) return;
      answered += 1;
    });

    return {
      total,
      answered,
      unanswered: Math.max(0, total - answered),
    };
  }, [assessment, answers, currentSectionName]);

  const sectionProgressPercentage = useMemo(() => {
    if (!sectionQuestionInfo || sectionQuestionInfo.total === 0) return 0;
    return Math.round((sectionQuestionInfo.answered / sectionQuestionInfo.total) * 100);
  }, [sectionQuestionInfo]);

  const markedForReviewCount = useMemo(() => {
    if (!Array.isArray(reviewMarks)) return 0;
    return reviewMarks.filter(Boolean).length;
  }, [reviewMarks]);

  const getQuestionAnswerState = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };

  const questionStatusCounts = useMemo(() => {
    if (!assessment || !Array.isArray(assessment)) return { answered: 0, notAnswered: 0, notVisited: 0, review: 0 };
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let review = 0;

    assessment.forEach((question, index) => {
      const answeredValue = getQuestionAnswerState(answers[index]);
      const visited = Boolean(visitedQuestions?.[index]);
      const isReview = Boolean(reviewMarks?.[index]);

      if (isReview) review += 1;
      if (!visited) {
        notVisited += 1;
      } else if (!answeredValue) {
        notAnswered += 1;
      }
      if (answeredValue) answered += 1;
    });

    return { answered, notAnswered, notVisited, review };
  }, [assessment, answers, visitedQuestions, reviewMarks]);

  const questionSectionSummary = useMemo(() => {
    if (!assessment || !Array.isArray(assessment)) return { title: "", total: 0, answered: 0, unanswered: 0, progress: 0 };
    const sectionKey = currentQuestion?.sectionName || currentQuestion?.section || currentQuestion?.partName || currentQuestion?.part || "Section A";
    const sectionQuestions = assessment.map((q, index) => ({ q, index })).filter(({ q }) => {
      const questionSection = q.sectionName || q.section || q.partName || q.part || "";
      return questionSection === sectionKey;
    });
    const total = sectionQuestions.length;
    const answered = sectionQuestions.reduce((sum, { index }) => sum + (getQuestionAnswerState(answers[index]) ? 1 : 0), 0);
    const unanswered = Math.max(0, total - answered);
    return {
      title: sectionKey,
      total,
      answered,
      unanswered,
      progress: total ? Math.round((answered / total) * 100) : 0,
    };
  }, [assessment, answers, currentQuestion]);

  const getQuestionStatus = (index) => {
    if (!assessment || !Array.isArray(assessment)) return "notVisited";
    const isReview = Boolean(reviewMarks?.[index]);
    if (isReview) return "review";
    const visited = Boolean(visitedQuestions?.[index]);
    const answered = getQuestionAnswerState(answers[index]);
    if (!visited) return "notVisited";
    if (!answered) return "notAnswered";
    return "answered";
  };

  const questionStatusLabel = (index) => {
    const status = getQuestionStatus(index);
    if (status === "review") return "Review";
    if (status === "notVisited") return "Not Visited";
    if (status === "notAnswered") return "Not Answered";
    return "Answered";
  };

  const getAnsweredCount = (answersArray = []) => {
    return answersArray.filter((answer) => !isBlankAnswer(answer?.studentAnswer ?? answer)).length;
  };

  const getTotalMarksFromAnswers = (answersArray = []) => {
    return answersArray.reduce((sum, a) => sum + (Number(a?.totalMarks) || 0), 0);
  };

  const normalizeRubricKey = (category) =>
    category?.toString().trim().replace(/\s+/g, " ").replace(/[\/ _]/g, "").toLowerCase();

  const getCategoryLabel = (category) => {
    const normalized = normalizeRubricKey(category);
    switch (normalized) {
      case "wordcount":
        return "Word Count";
      case "content":
        return "Content";
      case "organization":
        return "Organization";
      case "expression":
        return "Expression";
      case "mechanicalaccuracy":
      case "mechanical_accuracy":
        return "Mechanical Accuracy";
      case "salutationformat":
      case "salutation/format":
      case "salutation_format":
        return "Salutation / Format";
      default:
        return category
          .toString()
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
    }
  };

  const getCategoryTotalMarks = (category, rubricObj = {}, categoryTotalMarks = {}) => {
    if (!category) return 0;
    if (categoryTotalMarks?.[category] !== undefined) return Number(categoryTotalMarks[category]);
    if (rubricObj?.[category] !== undefined) return Number(rubricObj[category]);
    const label = getCategoryLabel(category);
    if (categoryTotalMarks?.[label] !== undefined) return Number(categoryTotalMarks[label]);
    if (rubricObj?.[label] !== undefined) return Number(rubricObj[label]);

    const normalized = normalizeRubricKey(category);
    switch (normalized) {
      case "wordcount":
        return 5;
      case "content":
        return 10;
      case "organization":
        return 10;
      case "expression":
        return 10;
      case "mechanicalaccuracy":
      case "mechanical_accuracy":
        return 15;
      case "salutationformat":
      case "salutation/format":
      case "salutation_format":
        return 5;
      default:
        return 0;
    }
  };

  /* =========================
     SUBMIT ASSESSMENT
  ========================= */
  async function submitAssessment(skipConfirmation = false) {
    if (!attemptId || attemptId === "null") {
      setStatusMessage("Assessment attempt not found. Please restart the assessment.");
      return;
    }

    const unansweredCount = answers.filter((answer) => isBlankAnswer(answer)).length;
    const totalQuestions = assessment?.length || answers.length || 0;

    if (!skipConfirmation && unansweredCount > 0) {
      const confirmMsg = `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''} out of ${totalQuestions}.\n\nSubmit anyway?`;
      const confirmed = window.confirm(confirmMsg);
      if (!confirmed) return;
    } else if (unansweredCount > 0) {
      setStatusMessage(`Submitting ${totalQuestions - unansweredCount}/${totalQuestions} answered questions...`);
    }

    try {
      const sourceAnswers = Array.isArray(answersRef.current) ? answersRef.current : (Array.isArray(answers) ? answers : []);
      const questionSource = Array.isArray(assessment) ? assessment : [];
      const payloadAnswers = [];

      const normalizeAnswerInput = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
        if (Array.isArray(value)) return value.map(normalizeAnswerInput).join("\n");
        if (typeof value === "object") return normalizeAnswerInput(value.studentAnswer ?? value.answer ?? value.value ?? "");
        return String(value).trim();
      };

      const formatGroupAnswers = (value) => {
        if (Array.isArray(value)) return value.map(normalizeAnswerInput);
        if (typeof value === "string") {
          const parts = value
            .split(/\r?\n/)
            .map((part) => part.replace(/^[a-zA-Z]\.\s*/, "").trim());
          return parts;
        }
        return [];
      };

      (Array.isArray(sourceAnswers) ? sourceAnswers : []).forEach((ans, idx) => {
        const q = questionSource[idx] || {};
        const questionIndex = q.questionIndex != null ? Number(q.questionIndex) : Number(idx);
        const sectionQuestions = getSectionQuestions(q);

        if (Array.isArray(sectionQuestions) && sectionQuestions.length > 0) {
          const values = formatGroupAnswers(ans);
          sectionQuestions.forEach((subQuestion, subIndex) => {
            const studentAnswer = normalizeAnswerInput(values[subIndex] ?? "");
            payloadAnswers.push({
              questionIndex,
              questionId: subQuestion.questionId || subQuestion._id || subQuestion.id || undefined,
              studentAnswer,
            });
          });
          return;
        }

        let studentAnswer = normalizeAnswerInput(ans);
        payloadAnswers.push({
          questionIndex,
          questionId: q.questionId || q._id || q.id || undefined,
          studentAnswer,
        });
      });

      const res = await API.post(`/assessments/submit/${attemptId}`, { answers: payloadAnswers });
      const payloadTotal = payloadAnswers.length || (assessment?.length || 0);
      const correct = Number.isFinite(Number(res.data.correct))
        ? Number(res.data.correct)
        : Number.isFinite(Number(res.data.result?.correct))
        ? Number(res.data.result.correct)
        : (Number.isFinite(Number(res.data.score)) ? Math.round(Number(res.data.score)) : 0);

      const total = Number.isFinite(Number(res.data.total))
        ? Number(res.data.total)
        : Number.isFinite(Number(res.data.result?.total))
        ? Number(res.data.result.total)
        : payloadTotal;

      const wrong = total - correct;
      const percentage = Number.isFinite(Number(res.data.percentage))
        ? Number(res.data.percentage)
        : total > 0
        ? (correct / total) * 100
        : 0;
      const status = res.data.status ?? (res.data.result?.passed ? "PASS" : "FAIL") ?? "";
      const elapsedSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const elapsedRemainingSeconds = elapsedSeconds % 60;
      const timeUsed = `${elapsedMinutes}min ${elapsedRemainingSeconds.toString().padStart(2, "0")}s`;
      const dateTaken = new Date().toLocaleDateString("en-GB");
      const duration = `${assessmentMeta?.duration ?? 0} min`;

      setSubmissionResult({
        score: Math.round(correct),
        total: Number(total),
        percentage,
        status,
        part: selectedPart,
        correct: Math.round(correct),
        wrong: Number(wrong),
        timeUsed,
        dateTaken,
        duration,
        reviewQuestions: res.data.result?.questions || assessment,
        reviewAnswers: res.data.result?.answers || [],
      });

      let finalAttempt = null;
      try {
        setStatusMessage("Running AI mark and fetching final results...");
        const markRes = await API.post(`/assessments/${attemptId}/ai-mark`);
        finalAttempt = markRes.data.attempt || markRes.data;
        if (finalAttempt) {
          setAttemptDetails(finalAttempt);
          const updatedScore = Number.isFinite(Number(finalAttempt.correct))
            ? Number(finalAttempt.correct)
            : Array.isArray(finalAttempt.answers)
            ? finalAttempt.answers.filter((a) => a && a.isCorrect).length
            : Number.isFinite(Number(finalAttempt.obtainedMarks))
            ? Math.round(Number(finalAttempt.obtainedMarks))
            : submissionResult?.score ?? 0;

          const updatedTotal = Number.isFinite(Number(finalAttempt.total))
            ? Number(finalAttempt.total)
            : Array.isArray(finalAttempt.answers)
            ? finalAttempt.answers.length
            : submissionResult?.total ?? payloadAnswers.length;

          const updatedPercentage = Number.isFinite(Number(finalAttempt.percentage))
            ? Number(finalAttempt.percentage)
            : updatedTotal > 0
            ? (updatedScore / updatedTotal) * 100
            : submissionResult?.percentage ?? 0;

          setSubmissionResult((prev) => ({
            ...(prev || {}),
            score: Math.round(updatedScore),
            total: Number(updatedTotal),
            percentage: Number(Number(updatedPercentage).toFixed(2)),
            status: finalAttempt.passed ? "PASS" : "FAIL",
          }));
        }
      } catch (markErr) {
        console.error("AI marking failed", markErr);
      }

      if (!finalAttempt) {
        try {
          const attemptRes = await API.get(`/assessments/attempt/${attemptId}`);
          finalAttempt = attemptRes.data.attempt || attemptRes.data;
          if (finalAttempt) {
            setAttemptDetails(finalAttempt);
          }
        } catch (attemptErr) {
          console.error("Attempt fetch failed", attemptErr);
        }
      }

      setStarted(false);
      try {
        if (typeof document !== "undefined" && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (fullscreenErr) {
        console.warn("Unable to exit fullscreen during assessment submit:", fullscreenErr);
      }
      // stop and cleanup oral audio and persisted state
      try {
        if (audioPlayerRef.current) {
          try { audioPlayerRef.current.pause(); } catch (e) {}
          audioPlayerRef.current = null;
        }
        if (audioSaveIntervalRef.current) clearInterval(audioSaveIntervalRef.current);
        window.localStorage.removeItem('currentAttemptId');
        if (attemptId) window.localStorage.removeItem(`oralAttempt:${attemptId}`);
      } catch (cleanupErr) {
        console.warn('Cleanup after submit failed', cleanupErr);
      }
      setStatusMessage("");
    } catch (err) {
      console.error("[SUBMIT] submitAssessment error:", err?.response?.data || err.message || err);
      alert(err.response?.data?.message || "Submission failed");
    }
  }

  /* =========================
     ORAL: Global audio handling, persistence and restore
  ========================= */
  const persistOralState = async () => {
    if (!attemptId) return;
    try {
      const payload = {
        audioCurrentTime: lastAudioTimeRef.current || 0,
        timeLeft,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        currentQuestionIndex: currentlyVisibleQuestion,
      };
      await API.post(`/assessments/${attemptId}/answer`, payload);
    } catch (err) {
      console.warn('Oral state autosave failed', err?.response?.data || err.message || err);
    }
  };

  const initGlobalOralAudio = (url) => {
    if (!url) return;
    if (audioPlayerRef.current) {
      try { audioPlayerRef.current.pause(); } catch (e) {}
      audioPlayerRef.current = null;
    }
    const player = new Audio(url);
    player.preload = 'auto';
    player.controls = false;
    player.crossOrigin = 'anonymous';

    player.addEventListener('play', () => {
      if (!audioStarted) setAudioStarted(true);
      setAudioPlaying(true);
      if (!startTime) setStartTime(Date.now());
    });

    player.addEventListener('timeupdate', () => {
      try {
        const t = Math.floor(player.currentTime || 0);
        lastAudioTimeRef.current = t;
      } catch (e) {}
    });

    // Prevent seeking
    player.addEventListener('seeking', () => {
      try {
        player.currentTime = Math.max(lastAudioTimeRef.current || 0, player.currentTime || 0);
      } catch (e) {}
    });

    // Prevent pause/replay by forcing play again
    player.addEventListener('pause', () => {
      if (!player.ended && started) {
        setTimeout(() => { try { player.play().catch(()=>{}); } catch (e) {} }, 50);
      } else {
        setAudioPlaying(false);
      }
    });

    player.addEventListener('ended', () => {
      setAudioPlaying(false);
      // On natural end, trigger submit
      submitAssessment();
    });

    audioPlayerRef.current = player;

    // Restore previous attempt state if present on server/localStorage
    try {
      const stored = JSON.parse(window.localStorage.getItem(`oralAttempt:${attemptId}`) || '{}');
      if (stored && stored.audioCurrentTime) {
        player.currentTime = stored.audioCurrentTime;
        lastAudioTimeRef.current = stored.audioCurrentTime;
      }
    } catch (e) {}

    // Start playback using the user gesture (startAttempt click)
    player.play().catch((err) => {
      console.warn('Autoplay blocked or failed', err);
    });

    // Start periodic persistence
    if (audioSaveIntervalRef.current) clearInterval(audioSaveIntervalRef.current);
    audioSaveIntervalRef.current = setInterval(() => {
      persistOralState();
      // also save a local copy for quick restore
      try {
        const local = { audioCurrentTime: lastAudioTimeRef.current || 0, timeLeft, startTime };
        window.localStorage.setItem(`oralAttempt:${attemptId}`, JSON.stringify(local));
      } catch (e) {}
    }, 10000);
  };

  const handlePaymentSuccess = () => {
    setShowAccessModal(false);
    setStatusMessage("✓ Assessment access granted! You can now start.");
    setAcceptedRules(false);
    // Re-check server enrollment state after successful payment
    fetchEnrollmentStatus();
  };

  const fetchEssayQuestions = async (type) => {
    if (!subjectSlug) return;
    try {
      setStatusMessage("");
      setLoading(true);
      const res = await API.get(`/assessments/global/subject/${normalizedSubjectSlug}/essay/${type}/questions`);
      const qs = res.data.questions || [];
      setEssayQuestions(qs);
      if (qs.length > 0) {
        setSelectedEssayQuestionId(qs[0].questionId || qs[0].id || qs[0]._id || null);
      } else {
        setSelectedEssayQuestionId(null);
      }
    } catch (err) {
      setStatusMessage(err.response?.data?.message || `Unable to load ${type} essay questions.`);
      setEssayQuestions([]);
      setSelectedEssayQuestionId(null);
    } finally {
      setLoading(false);
    }
  };

  const startWithSelectedEssay = async () => {
    if (!selectedEssayType || !selectedEssayQuestionId) {
      setStatusMessage("Please choose an essay type and a question.");
      return;
    }

    if (!acceptedRules) {
      setStatusMessage("Please accept the rules before starting the assessment.");
      return;
    }

    setShowEssayModal(false);
    setStatusMessage("");
    await startAttempt();
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

  const determineLocalEnrollment = () => {
    // Client-side enrollment flags are no longer trusted; rely on server checks
    return false;
  };

  const buttonAction = async () => {
    try { window.__lastButtonAction = {calledAt: Date.now(), selectedPart, assessmentPaid, noPartsAvailable, noQuestionsForPart}; } catch(e){}
    console.log('[UnifiedAssessment] buttonAction invoked', { selectedPart, assessmentPaid, noPartsAvailable, noQuestionsForPart });
    if (assessmentPaid) {
      if (noPartsAvailable) {
        setStatusMessage("There are no available assessment parts with questions. Please return to the previous page.");
        return;
      }
      if (noQuestionsForPart) {
        setStatusMessage(`Part ${selectedPart} currently has no available questions. Please choose a different part or return to the previous page.`);
        return;
      }

      // If theory part and contains an essay section, open essay selection modal
      try {
        const isTheory = selectedPart === "B";
        const hasEssaySection = Boolean((selectedPartMeta?.sections || []).find((s) => (String(s.key || s.name || "").toLowerCase().includes("essay") || (Array.isArray(s.files) && s.files.some(f => String(f).toLowerCase().includes("essay"))))));
        if (isSubjectMode && isTheory && hasEssaySection) {
          if (selectedEssayType && selectedEssayQuestionId) {
            console.log('[UnifiedAssessment] essay already selected, starting attempt');
            await startAttempt();
            return;
          }
          try { window.__lastButtonAction.openingEssay = true; } catch(e){}
          console.log('[UnifiedAssessment] opening essay modal path');
          const initialEssayType = essayTypes?.[0] || null;
          setSelectedEssayType(initialEssayType);
          setEssayQuestions([]);
          setSelectedEssayQuestionId(null);
          setShowEssayModal(true);
          if (initialEssayType) {
            fetchEssayQuestions(initialEssayType);
          }
          return;
        }
      } catch (e) {
        // ignore and continue to start
      }

      await startAttempt();
      return;
    }

    await fetchEnrollmentStatus();
    const localEnrolled = determineLocalEnrollment();
    const stillPaid = localEnrolled || assessmentMeta?.isEnrolledAssessment || assessmentMeta?.price === 0 || hasServerEnrollment;
    if (stillPaid) {
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

  const renderObjectiveResultPage = () => {
    const percentage = Number(submissionResult?.percentage ?? 0);
    const score = Number(submissionResult?.score ?? 0);
    const total = Number(submissionResult?.total ?? 0);
    const answeredCount = getAnsweredCount(submissionResult?.reviewAnswers || attemptDetails?.answers || []);
    const totalQuestions = Number(submissionResult?.reviewQuestions?.length || submissionResult?.total || assessment?.length || 0);
    const unansweredCount = Math.max(0, totalQuestions - answeredCount);
    const passed = percentage >= 50;
    const gradeColor = passed ? "from-emerald-500 via-emerald-600 to-teal-600" : "from-red-500 via-rose-600 to-orange-500";
    const textColor = passed ? "text-emerald-400" : "text-red-400";
    const passedText = passed
      ? "You passed this assessment. Review your answers and keep building your confidence."
      : "You need more practice to pass this assessment. Review your answers and try again.";

    return (
      <div className="unified-assessment-page space-y-6 p-6">
        <div className={`rounded-2xl bg-gradient-to-br ${gradeColor} p-8 shadow-2xl text-white`}>
          <p className="text-sm uppercase tracking-widest opacity-90 mb-4">Your Grade</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-7xl font-bold mb-2">{passed ? "PASS" : "FAIL"}</p>
              <p className="text-xl font-semibold">{percentage}%</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-5xl font-bold mb-2">{score}/{total}</p>
              <p className="text-sm opacity-90">Marks scored</p>
            </div>
          </div>
          <p className={`mt-4 text-lg font-semibold ${passed ? "text-emerald-100" : "text-red-100"}`}>{passedText}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Answered Questions</p>
            <p className="text-4xl font-bold text-white mb-1">{answeredCount}</p>
            <p className="text-sm text-slate-400">out of {totalQuestions}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Unanswered Questions</p>
            <p className="text-4xl font-bold text-red-400 mb-1">{unansweredCount}</p>
            <p className="text-sm text-slate-400">Need attention</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Performance Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Success Rate</span>
              <span className={`font-semibold ${textColor}`}>{percentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div className={`h-full rounded-full ${passed ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, percentage)}%` }} />
            </div>
            <p className="text-sm text-slate-400">
              {passed
                ? "Good work. Your results are above the passing mark."
                : "Keep practicing and review the areas you missed."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setReviewMode(true)}
            className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700"
          >
            Review Answers
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white transition hover:bg-slate-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return <div className="unified-assessment-page p-6">Loading assessment...</div>;
  }

  if (submissionResult && !reviewMode) {
    const resultQuestions = submissionResult.reviewQuestions || attemptDetails?.questions || assessment || [];
    if (shouldUseTheoryResults(resultQuestions)) {
      return (
        <TheoryResultPage
          attemptId={attemptId}
          assessment={assessmentMeta}
          onReview={() => setReviewMode(true)}
          onRetake={() => {
            const target = subjectSlug || assessmentMeta?.subject
              ? `/assessment/subject/${normalizedSubjectSlug || String(assessmentMeta?.subject || "").trim().toLowerCase()}`
              : '/dashboard';
            setSubmissionResult(null);
            setReviewMode(false);
            setAttemptId(null);
            setAttemptDetails(null);
            setAssessment([]);
            setAnswers([]);
            setStarted(false);
            setSelectedEssayType(null);
            setEssayQuestions([]);
            setSelectedEssayQuestionId(null);
            setSelectedPart(getInitialSelectedPart(assessmentMeta));
            setStatusMessage("");
            navigate(target);
          }}
          onBackToDashboard={() => {
            setSubmissionResult(null);
            setReviewMode(false);
            setAttemptId(null);
            setAttemptDetails(null);
            setAssessment([]);
            setAnswers([]);
            setStarted(false);
            setSelectedEssayType(null);
            setEssayQuestions([]);
            setSelectedEssayQuestionId(null);
            setSelectedPart(getInitialSelectedPart(assessmentMeta));
            setStatusMessage("");
            navigate('/dashboard');
          }}
        />
      );
    }

    return renderObjectiveResultPage();
  }

  if (submissionResult && reviewMode) {
    const reviewQuestions = submissionResult.reviewQuestions || assessment || [];
    const reviewAnswersMap = new Map((submissionResult.reviewAnswers || []).map((item) => [item.questionIndex, item]));
    const reviewItems = [];
    reviewQuestions.forEach((q) => {
      if (Array.isArray(q.questions) && q.questions.length > 0) {
        q.questions.forEach((subQ) => reviewItems.push({ parent: q, question: subQ }));
      } else if (Array.isArray(q.summary?.questions) && q.summary.questions.length > 0) {
        q.summary.questions.forEach((subQ) => reviewItems.push({ parent: q, question: subQ }));
      } else {
        reviewItems.push({ parent: q, question: q });
      }
    });

    return (
      <div className="unified-assessment-page min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-100 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Review Your Answers</h1>
              <p className="text-slate-400">{assessmentMeta?.title || "Assessment"}</p>
            </div>
            <button
              onClick={() => setReviewMode(false)}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 transition"
            >
              ← Back to Results
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Answered</p>
              <p className="text-3xl font-bold text-emerald-400">{getAnsweredCount(submissionResult.reviewAnswers || attemptDetails?.answers || [])}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Not Answered</p>
              <p className="text-3xl font-bold text-red-400">{Math.max(0, (submissionResult.reviewQuestions?.length || 0) - getAnsweredCount(submissionResult.reviewAnswers || attemptDetails?.answers || []))}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Score</p>
              <p className="text-3xl font-bold text-sky-400">{submissionResult.score}/{submissionResult.total}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Percentage</p>
              <p className="text-3xl font-bold text-sky-400">{submissionResult.percentage}%</p>
            </div>
          </div>

          {/* Review Questions */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Question by Question Review</h2>
            {reviewItems.map((item, index) => {
              const q = item.question;
              const reviewEntry = reviewAnswersMap.get(index) || {};
              const studentAnswer = reviewEntry.studentAnswer ?? answers[index] ?? "";
              const correctAnswer = q.correctAnswer || q.answer || reviewEntry.correctAnswer || "";
              const normalizedStudentAnswer = String(studentAnswer ?? "").trim();
              const normalizedCorrectAnswer = String(correctAnswer ?? "").trim();
              const isAnswered = normalizedStudentAnswer !== "";
              const isCorrect = isAnswered && normalizedStudentAnswer.toLowerCase() === normalizedCorrectAnswer.toLowerCase();
              const answerStatusColor = isAnswered ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30";
              const answerStatusText = isAnswered ? "Answered" : "Not Answered";
              const answerStatusTextColor = isAnswered ? "text-emerald-400" : "text-red-400";
              const ar = reviewEntry.aiReport || reviewEntry.ar || reviewEntry.report || {};
              const essayMaxScore = Object.entries(ar.categoryScores || {}).reduce(
                (sum, [category]) => sum + getCategoryTotalMarks(category, ar.rubric || {}, ar.categoryTotalMarks || {}),
                0
              );

              return (
                <div key={index} className={`rounded-lg border p-6 ${answerStatusColor}`}>
                  {/* Question Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isCorrect
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-red-500 text-white"
                        }`}>
                          {index + 1}
                        </div>
                        <span className={`font-semibold text-sm ${answerStatusTextColor}`}>{answerStatusText}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-2">
                        {getQuestionText(q) || (getQuestionMediaSrc(q) ? "Question illustration" : "Question")}
                      </h3>
                      {getQuestionMediaSrc(q) && (
                        <div className="mt-4">
                          <img
                            src={getQuestionMediaSrc(q)}
                            alt="Question visual"
                            className="max-w-full rounded-xl border border-slate-700"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  {getQuestionOptions(q).length > 0 && (
                    <div className="space-y-2 ml-11 mb-4">
                      {getQuestionOptions(q).map((option, optIdx) => {
                        const isStudentAnswer = option === studentAnswer;
                        const isCorrectOption = option === correctAnswer;
                        const optionBg = isCorrectOption
                          ? "bg-emerald-500/20 border-emerald-500"
                          : isStudentAnswer && !isCorrect
                          ? "bg-red-500/20 border-red-500"
                          : "bg-slate-700/50 border-slate-600";

                        return (
                          <div key={optIdx} className={`rounded p-3 border ${optionBg}`}>
                            <div className="flex items-start gap-3">
                              <span className="font-semibold text-slate-300 min-w-fit">{String.fromCharCode(65 + optIdx)}.</span>
                              <div className="flex-1">
                                <p className="text-slate-100">{option}</p>
                                <div className="flex gap-2 mt-1 text-xs">
                                  {isCorrectOption && <span className="text-emerald-400 font-semibold">✓ Correct Answer</span>}
                                  {isStudentAnswer && !isCorrect && <span className="text-red-400 font-semibold">✗ Your Answer</span>}
                                  {isStudentAnswer && isCorrect && <span className="text-emerald-400 font-semibold">✓ Your Answer</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="ml-11 grid gap-4 md:grid-cols-2 mb-4">
                    <div className="rounded-lg bg-slate-800/70 p-4 border border-slate-700">
                      <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Your Answer</p>
                      <p className="text-slate-100 whitespace-pre-wrap">{studentAnswer || "(No answer provided)"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/70 p-4 border border-slate-700">
                      <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Correct Answer</p>
                      <p className="text-slate-100 whitespace-pre-wrap">{correctAnswer || "(Not available)"}</p>
                    </div>
                  </div>

                  {/* Theory Answer Review */}
                  {(q.type === "theory" || q.type === "essay") && (
                    <div className="ml-11 mt-4">
                      <div className="rounded bg-slate-700/50 p-4 mb-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Your Answer:</p>
                        <p className="text-slate-200 whitespace-pre-wrap">{studentAnswer || "(No answer provided)"}</p>
                      </div>
                      {correctAnswer && (
                        <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-4 mb-3">
                          <p className="text-xs uppercase tracking-wider text-emerald-400 mb-2">Expected Answer:</p>
                          <p className="text-slate-200 whitespace-pre-wrap">{correctAnswer}</p>
                        </div>
                      )}
                      {ar && ar.categoryScores && Object.keys(ar.categoryScores).length > 0 && (
                        <div className="rounded bg-slate-800/70 border border-slate-700 p-4">
                          <div className="flex flex-wrap gap-4 mb-4">
                            <div className="rounded-lg bg-slate-900/80 p-3 flex-1 min-w-[160px]">
                              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Word Count</p>
                              <p className="text-xl font-bold text-white">{String(studentAnswer || "").trim().split(/\s+/).filter(Boolean).length}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/80 p-3 flex-1 min-w-[160px]">
                              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Total Essay Score</p>
                              <p className="text-xl font-bold text-white">
                                {Number(ar.totalScore ?? ar.score ?? 0)} / {essayMaxScore || Object.entries(ar.categoryScores).reduce((sum, [key]) => {
                                  const normalized = String(key).trim().replace(/\s+/g, '').replace(/[\/ _]/g, '').toLowerCase();
                                  if (normalized === 'wordcount') return sum + 5;
                                  if (normalized === 'content') return sum + 10;
                                  if (normalized === 'organization') return sum + 10;
                                  if (normalized === 'expression') return sum + 10;
                                  if (normalized === 'mechanicalaccuracy' || normalized === 'mechanical_accuracy') return sum + 15;
                                  return sum;
                                }, 0)}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {Object.entries(ar.categoryScores).map(([cat, val]) => {
                              const normalized = String(cat).trim().replace(/\s+/g, '').replace(/[\/ _]/g, '').toLowerCase();
                              const label = normalized === 'mechanicalaccuracy' || normalized === 'mechanical_accuracy'
                                ? 'Mechanical Accuracy'
                                : normalized === 'wordcount'
                                ? 'Word Count'
                                : normalized === 'salutationformat'
                                ? 'Salutation / Format'
                                : normalized.charAt(0).toUpperCase() + normalized.slice(1);
                              const maxScore = normalized === 'wordcount' ? 5 : normalized === 'content' ? 10 : normalized === 'organization' ? 10 : normalized === 'expression' ? 10 : normalized === 'mechanicalaccuracy' ? 15 : 0;
                              return (
                                <div key={cat} className="rounded-lg bg-slate-900/80 p-3 border border-slate-700">
                                  <div className="flex justify-between items-baseline gap-3">
                                    <p className="text-sm text-slate-400">{label}</p>
                                    <p className="text-lg font-semibold text-white">{Number(val)}{maxScore ? `/${maxScore}` : ''}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="ml-11 mt-4 rounded bg-sky-500/10 border border-sky-500/30 p-4">
                      <p className="text-xs uppercase tracking-wider text-sky-400 mb-2">💡 Explanation:</p>
                      <p className="text-slate-200">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex gap-4 justify-center">
            <button
              onClick={() => setReviewMode(false)}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 transition"
            >
              Back to Results
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-8 transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (resumePromptData && !started) {
    return (
      <div className="unified-assessment-page min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/95 p-8 shadow-2xl">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400 mb-2">Unfinished Assessment</p>
            <h1 className="text-4xl font-bold text-white">You have an unfinished assessment.</h1>
            <p className="mt-3 text-slate-400">Resume your existing attempt or start a fresh one if you want to begin again.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 bg-slate-950/80 rounded-3xl border border-slate-700 p-6 mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Subject</p>
              <p className="mt-2 text-lg font-semibold text-white">{resumePromptData.subject}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Part</p>
              <p className="mt-2 text-lg font-semibold text-white">{resumePromptData.partLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Time Remaining</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatTimeAmount(resumePromptData.timeLeft)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleStartNewAttempt}
              className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-white hover:bg-slate-700 transition"
            >
              Start New Attempt
            </button>
            <button
              type="button"
              onClick={handleResumeAttempt}
              className="w-full sm:w-auto rounded-xl bg-sky-500 px-6 py-3 font-semibold text-slate-950 hover:bg-sky-400 transition"
            >
              Resume Assessment
            </button>
          </div>
          <p className="mt-6 text-sm text-slate-500">If you choose to start a new attempt, your current progress will remain saved locally, but the prompt will be dismissed so you can begin again.</p>
        </div>
      </div>
    );
  }

  // SHOW QUESTIONS WHEN STARTED
  if (started && assessment && assessment.length > 0) {
    return (
      <div className="unified-assessment-page min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {started && !submissionResult && (
          <>
            <div className="w-full bg-red-600 text-white text-center py-1 font-semibold">
              <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-sm">
                <span>Exam in progress — navigation is disabled.</span>
                <button
                  type="button"
                  onClick={() => setShowWhyModal(true)}
                  className="underline ml-2 text-white font-normal hover:text-white/90"
                >
                  Why can't I leave?
                </button>
              </div>
            </div>
            {showWhyModal && (
              <div
                className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 px-4"
                onClick={(e) => { if (e.target === e.currentTarget) setShowWhyModal(false); }}
              >
                <div className="max-w-2xl w-full rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6">
                  <h2 className="text-xl font-semibold mb-3">Why can't I leave the assessment?</h2>
                    <div className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                      <p className="mb-2">To protect assessment integrity, leaving the exam page may be treated as a suspicious action.</p>
                      <ul className="list-disc list-inside space-y-1 mb-2">
                        <li>Your answers are automatically saved while you work.</li>
                        <li>Repeated or prolonged navigation away from the test can generate warnings.</li>
                        <li>Severe or repeated violations may trigger automatic submission based on exam rules.</li>
                      </ul>
                      <p className="mb-0">If you have a technical issue or need an exception, contact support before leaving.</p>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => { setShowWhyModal(false); setShowAccessModal(true); }}
                        className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700"
                      >
                        View rules
                      </button>
                      <a
                        href="mailto:esnexhelpdesk@gmail.com?subject=Assessment%20support"
                        className="rounded-md bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-300"
                      >
                        Contact support
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowWhyModal(false)}
                        className="rounded-md bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-300"
                      >
                        Close
                      </button>
                    </div>
                </div>
              </div>
            )}
          </>
        )}
        <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-400">
              {assessmentMeta?.subject?.toUpperCase()}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">{assessmentMeta?.title}</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400">Time Left</p>
              <p className={`mt-1 text-3xl font-mono font-bold ${timeLeft < 300 ? "text-red-400" : "text-sky-400"}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-right text-sm text-slate-300">
              <p className="font-semibold text-white">{connectionStatus === "offline" ? "Connection lost" : connectionStatus === "syncing" ? "Syncing..." : saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Save error" : "✓ Saved"}</p>
              <p className="mt-1 text-xs text-slate-400">{connectionStatus === "offline" ? "Answers saved locally." : connectionStatus === "syncing" ? "Reconnecting now..." : connectionMessage || "All progress is being preserved."}</p>
            </div>
            <button
              onClick={submitAssessment}
              className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              ✈️ Submit Assessment
            </button>
          </div>
        </div>

        <div ref={mainScrollRef} className="flex-1 overflow-y-auto p-8">
          <div className="grid gap-6 lg:grid-cols-[1.8fr_0.9fr]">
            <div className="space-y-6 pr-2">
              {assessment.map((q, index) => {
                const status = getQuestionStatus(index);
                const questionType = String(q?.questionType || q?.type || "").toLowerCase();
                let currentSectionKey = q.sectionName || q.section || q.partName || q.part || "Section";
                if (questionType.includes("summary")) {
                  currentSectionKey = q.summary?.sectionTitle || q.summary?.title || q.sectionName || q.section || "Summary";
                } else if (Array.isArray(q.summary?.questions) && q.summary.questions.length > 0) {
                  currentSectionKey = q.summary.sectionTitle || q.summary.title || "Summary";
                }
                const previousQuestion = assessment[index - 1];
                const previousSectionKey = previousQuestion
                  ? normalizeSectionKey(previousQuestion.sectionName || previousQuestion.section || previousQuestion.partName || previousQuestion.part || "")
                  : "";
                const normalizedSectionKey = normalizeSectionKey(currentSectionKey);
                const showSectionHeader = index === 0 || normalizedSectionKey !== previousSectionKey;
                const sectionMetaFromConfig = getSectionMeta(currentSectionKey);
                const sectionMeta = {
                  ...sectionMetaFromConfig,
                  name: sectionMetaFromConfig?.name || currentSectionKey,
                  instructions: sectionMetaFromConfig?.instructions || q.sectionInstructions,
                  examples: sectionMetaFromConfig?.examples || q.sectionExamples || [],
                  audioEnabled: typeof sectionMetaFromConfig?.audioEnabled !== "undefined"
                    ? sectionMetaFromConfig.audioEnabled
                    : typeof q.sectionAudioEnabled !== "undefined"
                      ? q.sectionAudioEnabled
                      : null,
                };
                const questionPassage = getQuestionPassage(q, sectionMeta);

                return (
                  <div
                    key={index}
                    ref={(ref) => { questionRefs.current[index] = ref; }}
                    className={`rounded-xl border p-6 ${
                      currentlyVisibleQuestion === index ? "border-sky-500 bg-slate-700/80" : "border-slate-700 bg-slate-800/50"
                    }`}
                  >
                    {showSectionHeader && (
                      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm uppercase tracking-[0.25em] text-sky-300">{sectionMeta?.name || currentSectionKey}</p>
                          {sectionMeta?.label && <span className="text-xs text-slate-400">{sectionMeta.label}</span>}
                        </div>
                        {sectionMeta?.instructions && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Section instructions</p>
                            <p className="text-sm leading-relaxed text-slate-400">{sectionMeta.instructions}</p>
                          </div>
                        )}

                        {typeof sectionMeta?.audioEnabled === "boolean" && (
                          <div className="mt-2 rounded-2xl bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
                            <span className="font-semibold text-white">Audio mode:</span>{" "}
                            {sectionMeta.audioEnabled ? "Audio support enabled for this section." : "This section is no-audio practice."}
                          </div>
                        )}

                        {sectionMeta?.examples?.length > 0 && (
                          <div className="mt-4 rounded-2xl bg-slate-950/90 px-4 py-4 text-sm text-slate-300">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">Examples</p>
                            <div className="space-y-2">
                              {sectionMeta.examples.map((example, idx) => (
                                <p key={idx}>{typeof example === "string"
                                  ? example
                                  : example?.text || example?.prompt || example?.question || example?.spoken_word || example?.spoken_sentence || example?.audio_text_summary || JSON.stringify(example)}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start gap-3 mb-4">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        status === "answered"
                          ? "bg-emerald-500 text-slate-950"
                          : status === "notAnswered"
                          ? "bg-orange-500 text-slate-950"
                          : status === "review"
                          ? "bg-violet-500 text-slate-950"
                          : "bg-slate-600 text-slate-200"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs uppercase tracking-[0.25em] text-slate-400">{q.partName || q.part || currentSectionKey}</span>
                          <span className="text-xs rounded-full bg-slate-700 px-2 py-1 text-slate-300">{q.sectionName || q.section || "Section"}</span>
                          <span className="text-xs rounded-full px-2 py-1 font-semibold text-slate-900 bg-slate-100">{questionStatusLabel(index)}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-100">
                          {getQuestionText(q) || (getQuestionMediaSrc(q) ? "Question illustration" : "Question")}
                        </h3>
                        {getQuestionMediaSrc(q) && (
                          <div className="mt-4">
                            <img
                              src={getQuestionMediaSrc(q)}
                              alt="Question visual"
                              className="max-w-full rounded-xl border border-slate-700"
                            />
                          </div>
                        )}

                        {(q.audio || q.sectionAudioEnabled) && (
                          <div className="mt-4 flex flex-col gap-2 ml-11">
                            {q.audio ? (
                              <button
                                type="button"
                                onClick={() => handlePlayAudio(q, index)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
                              >
                                {playingAudioIndex === index ? "⏸️ Stop audio" : "▶️ Play audio"}
                              </button>
                            ) : (
                              <p className="text-sm text-slate-400">Audio is enabled for this section, but no audio file is attached to this question.</p>
                            )}
                          </div>
                        )}

                        {/* Marking guide shown to students for instruction-based theory questions */}
                        {(String(q.markingType || q.marking_type || q.question?.markingType || '').toLowerCase() === 'instruction' || q.markingGuide || q.marking_guide) && (
                          <div className="ml-11 mt-4 rounded-lg border border-sky-500/20 bg-slate-800/60 p-4">
                            <p className="text-sm font-semibold text-sky-200 mb-2">{(q.type === 'essay' || String(q.sectionName || '').toLowerCase().includes('essay')) ? 'Essay (Marking Guide)' : 'Marking Guide'}</p>

                            {typeof q.markingGuide === 'string' && q.markingGuide && (
                              <p className="text-sm text-slate-300 mb-2">{q.markingGuide}</p>
                            )}

                            {q.markingGuide && typeof q.markingGuide === 'object' && (
                              <div className="grid gap-2 md:grid-cols-2">
                                {Object.keys(q.markingGuide).map((cat) => (
                                  <div key={cat} className="flex justify-between items-center bg-slate-900/70 p-2 rounded">
                                    <div className="text-sm text-slate-300">{getCategoryLabel(cat)}</div>
                                    <div className="text-sm font-semibold text-white">{getCategoryTotalMarks(cat, q.markingGuide, q.markingGuide)}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* For summary-style answer-key guides, show key points if present */}
                            {!q.markingGuide && (q.keyPoints || q.key_points || q.points) && Array.isArray(q.keyPoints || q.key_points || q.points) && (
                              <ul className="list-disc list-inside text-sm text-slate-300 mt-2">
                                {(q.keyPoints || q.key_points || q.points).map((kp, i) => <li key={i}>{kp}</li>)}
                              </ul>
                            )}

                            <div className="mt-3 text-xs text-slate-400">Maximum Score: {q.totalMarks || q.total_marks || q.marks || (q.markingGuide ? Object.values(q.markingGuide).reduce((s,v)=>s+Number(v||0),0) : '')}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {isChoiceQuestion(q) && (
                      <div className="space-y-2 ml-11">
                        {getQuestionOptions(q).map((option, i) => (
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

                    {isTextEntryQuestion(q) && (
                      getQuestionMediaSrc(q) && index === 0 ? (
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            {getQuestionText(q) ? "Question prompt" : "Question visual"}
                          </label>
                          <div className="w-full min-h-[160px] rounded-lg border border-slate-600 bg-slate-700 p-3 text-slate-100 placeholder-slate-400 flex items-center justify-center">
                            <img src={getQuestionMediaSrc(q)} alt="Question visual" className="max-h-40 object-contain" />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          {isPassageSection(q) ? (
                            <>
                              <div className="mb-5 rounded-3xl border border-sky-500/30 bg-slate-900/95 p-5 shadow-lg shadow-slate-900/40">
                                <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-slate-950/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-sky-400">PASSAGE</p>
                                    <p className="text-sm font-semibold text-white">Read the passage carefully and answer all questions below.</p>
                                  </div>
                                  <span className="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">Exam-style</span>
                                </div>
                                {getPassageInstructions(q, sectionMeta) && (
                                  <div className="mb-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                                    {getPassageInstructions(q, sectionMeta)}
                                  </div>
                                )}
                                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 text-sm leading-7 text-slate-200">
                                  {Array.isArray(q.passage)
                                    ? q.passage.map((paragraph, idx) => (
                                        <p key={idx} className="first:mt-0 last:mb-0">
                                          {paragraph.text || paragraph}
                                        </p>
                                      ))
                                    : <p>{q.passage}</p>
                                  }
                                </div>
                              </div>

                              <div className="mb-5 rounded-3xl border border-slate-700 bg-slate-900/90 p-5">
                                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Questions</div>
                                <div className="space-y-3 text-slate-200">
                                  {getSectionQuestions(q).map((subQ, subIndex) => (
                                    <div key={subIndex} className="flex gap-3 text-sm leading-relaxed">
                                      <span className="shrink-0 w-6 text-sky-400">{String.fromCharCode(97 + subIndex)}.</span>
                                      <p className="whitespace-pre-line flex-1">{String(subQ.question || subQ.prompt || subQ.text || subQ.title || "").trim()}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-3xl border border-slate-700 bg-slate-900/95 p-5">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm uppercase tracking-[0.25em] text-sky-400">Your Answer</p>
                                    <p className="text-xs text-slate-400">Use full sentences and keep your response organised.</p>
                                  </div>
                                  <span className="text-xs text-slate-500">{getSectionQuestions(q).length} parts</span>
                                </div>
                                {getSectionQuestions(q).map((subQ, subIndex) => (
                                  <div key={subIndex} className="mb-4">
                                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                                      {String.fromCharCode(97 + subIndex)}. {String(subQ.question || subQ.prompt || subQ.text || subQ.title || "").trim()}
                                    </label>
                                    <textarea
                                      data-question-id={subQ.questionId || subQ._id || `g${index}_q${subIndex}`}
                                      value={(Array.isArray(answers[index]) ? answers[index][subIndex] : "") || ""}
                                      onChange={(e) => handleChange(index, e.target.value, subIndex)}
                                      placeholder="Write your answer for this part..."
                                      className="w-full min-h-[120px] resize-vertical rounded-2xl border border-slate-600 bg-slate-800 px-4 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                      rows={6}
                                    />
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {(questionPassage && (isPassageSection(q) || isFirstQuestionInSection(index))) && (
                                <div className="mb-4 rounded-3xl border border-sky-500/30 bg-slate-900/95 p-5 shadow-lg shadow-slate-900/40">
                                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-950/90 px-4 py-3">
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.25em] text-sky-400">Read Passage</p>
                                      <p className="text-sm font-semibold text-white">Read this passage carefully before answering.</p>
                                    </div>
                                    <span className="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">Reference</span>
                                  </div>
                                  {Array.isArray(questionPassage) ? (
                                    questionPassage.map((paragraph, idx) => (
                                      <p key={idx} className="text-sm leading-relaxed text-slate-200 mb-3">{paragraph.text || paragraph}</p>
                                    ))
                                  ) : (
                                    <p className="text-sm leading-relaxed text-slate-200">{questionPassage}</p>
                                  )}
                                </div>
                              )}
                              <label className="mb-2 block text-sm font-semibold text-slate-200">
                                {getQuestionText(q) ? "Your answer" : "Type your answer below"}
                              </label>
                              <textarea
                                value={answers[index] || ""}
                                onChange={(e) => handleChange(index, e.target.value)}
                                placeholder="Your answer here..."
                                className="w-full min-h-[160px] resize-vertical rounded-lg border border-slate-600 bg-slate-700 p-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                rows={6}
                              />
                            </>
                          )}
                        </div>
                      )
                    )}


                    <div className="mt-4 flex flex-wrap items-center gap-3 ml-11">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedReview = Array.isArray(reviewMarks) ? [...reviewMarks] : new Array(assessment.length).fill(false);
                          updatedReview[index] = !updatedReview[index];
                          setReviewMarks(updatedReview);
                        }}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${reviewMarks?.[index] ? "bg-violet-500 text-slate-950" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
                      >
                        {reviewMarks?.[index] ? "Unmark Review" : "Mark for Review"}
                      </button>
                      <span className="text-xs text-slate-400">{questionStatusLabel(index)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl sticky top-20 self-start">
              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                <p className="text-sm uppercase tracking-[0.25em] text-sky-300 mb-2">Section Info</p>
                <p className="text-lg font-semibold text-white">{questionSectionSummary.title}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-800 p-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Questions</p>
                    <p className="mt-1 text-xl font-semibold text-white">{questionSectionSummary.total}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800 p-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Answered</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-400">{questionSectionSummary.answered}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800 p-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Unanswered</p>
                    <p className="mt-1 text-xl font-semibold text-orange-400">{questionSectionSummary.unanswered}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800 p-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Progress</p>
                    <p className="mt-1 text-xl font-semibold text-sky-400">{questionSectionSummary.progress}%</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                <p className="text-sm uppercase tracking-[0.25em] text-sky-300 mb-3">Question Status</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                    <span className="text-sm text-slate-300">Answered</span>
                    <span className="text-sm font-semibold text-emerald-400">{questionStatusCounts.answered}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                    <span className="text-sm text-slate-300">Not Answered</span>
                    <span className="text-sm font-semibold text-orange-400">{questionStatusCounts.notAnswered}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                    <span className="text-sm text-slate-300">Not Visited</span>
                    <span className="text-sm font-semibold text-slate-100">{questionStatusCounts.notVisited}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-800 p-3">
                    <span className="text-sm text-slate-300">Marked for Review</span>
                    <span className="text-sm font-semibold text-violet-400">{questionStatusCounts.review}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Question Map</p>
                  <span className="text-xs text-slate-400">{assessment?.length || 0} total</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {assessment.map((q, idx) => {
                    const status = getQuestionStatus(idx);
                    const statusClasses = status === "answered"
                      ? "bg-emerald-500 text-slate-950"
                      : status === "notAnswered"
                      ? "bg-orange-500 text-slate-950"
                      : status === "review"
                      ? "bg-violet-500 text-slate-950"
                      : "bg-slate-700 text-slate-200";

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCurrentlyVisibleQuestion(idx);
                          setVisitedQuestions((prev) => {
                            const next = Array.isArray(prev) ? [...prev] : new Array(assessment.length).fill(false);
                            next[idx] = true;
                            return next;
                          });
                          questionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`h-10 w-10 rounded-xl font-semibold transition ${statusClasses} ${currentlyVisibleQuestion === idx ? "ring-2 ring-sky-400" : ""}`}
                        title={questionStatusLabel(idx)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: SHOW PREVIEW PAGE
  // If the URL contains a unified part path, render selectors or loading state first
  const urlSegments = location.pathname.split("/").filter(Boolean);
  const urlPart = routePartParam || urlSegments[2] || null;
  const urlSection = urlSegments[3] || null;
  const urlSubsection = urlSegments[4] || null;

  if (urlPart && assessmentMeta) {
    const partKey = String(urlPart).toLowerCase();
    if (partKey === "theory" && !urlSection) {
      return (
        <div className="p-8">
          <h2 className="text-2xl font-semibold mb-4">Select Theory Section</h2>
          <div className="flex gap-3">
            <button onClick={() => navigate(`/assessment/${assessmentMeta._id}/theory/essay`)} className="btn">Essay</button>
            <button onClick={() => navigate(`/assessment/${assessmentMeta._id}/theory/comprehension`)} className="btn">Comprehension</button>
            <button onClick={() => navigate(`/assessment/${assessmentMeta._id}/theory/summary`)} className="btn">Summary</button>
          </div>
        </div>
      );
    }

    if (partKey === "theory" && String(urlSection).toLowerCase() === "essay" && !urlSubsection) {
      return (
        <div className="p-8">
          <h2 className="text-2xl font-semibold mb-4">Select Essay Type</h2>
          <div className="flex gap-3">
            {(essayTypes || []).map((t) => (
              <button key={t} onClick={() => navigate(`/assessment/${assessmentMeta._id}/theory/essay/${t}`)} className="btn" style={{ textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
      );
    }

    if (routeDrivenLoading) return <div style={{ padding: 16 }}>Loading questions...</div>;
    if (routeDrivenError) return <div style={{ padding: 16, color: '#ef4444' }}>{routeDrivenError}</div>;
    // when questions are loaded we set `started` and the existing started branch will render the exam UI
  }

  return (
    <div className="unified-assessment-page quiz-selection-page bg-slate-950 min-h-screen py-10 text-slate-100">
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
              <p className="mt-2 text-sm text-slate-400">
                {assessmentPaid
                  ? "Ready to start the exam."
                  : `Pay ${accessPriceLabel} to unlock this assessment.`}
              </p>
              {assessmentPaid && remainingDaysText && (
                <p className="mt-3 rounded-2xl bg-emerald-950/70 p-4 text-sm text-emerald-100">
                  Subscription active: <strong>{remainingDaysText}</strong>
                </p>
              )}
              {!assessmentPaid && (
                <p className="mt-3 rounded-2xl bg-amber-950/70 p-4 text-sm text-amber-100">
                  This assessment requires payment to continue. Click the enroll button below to access this subject.
                </p>
              )}
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
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Selected Part</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedPartMeta?.partName || `Part ${selectedPart}`}</p>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Duration</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedPartDuration} mins</p>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Questions</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedPartQuestionCount}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-800/80 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Part Selection</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {parts.map((part, index) => {
                  const partLetter = String.fromCharCode(65 + index);
                  const partCount = (part.sections || []).reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
                  const isSelected = selectedPart === partLetter;
                  return (
                    <button
                      key={partLetter}
                      type="button"
                      onClick={() => setSelectedPart(partLetter)}
                      className={`rounded-3xl border px-4 py-4 text-left transition ${isSelected ? "border-sky-400 bg-slate-900 text-white" : "border-slate-700 bg-slate-950 text-slate-200"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{part.partName || `Part ${partLetter}`}</span>
                        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">{partCount} q</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{part.partType || "Mixed"}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <h3 className="text-base font-semibold text-white mb-3">Sections for {selectedPartMeta?.partName || `Part ${selectedPart}`}</h3>
                <div className="space-y-3">
                  {selectedPartMeta?.sections?.map((section, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{section.name || section.sectionName || `Section ${idx + 1}`}</p>
                        <span className="text-xs text-slate-400">Questions: {section.questionCount || 0}</span>
                      </div>
                      {section.instructions && (
                        <p className="mt-2 text-sm text-slate-400">{section.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

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
              {uniqueAvailableParts.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400 mb-3">Choose a part</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {uniqueAvailableParts.map((part) => {
                      const partCount = part === "A"
                        ? objectiveCount
                        : part === "B"
                        ? theoryCount
                        : part === "C"
                        ? oralCount
                        : part === "D"
                        ? practicalCount
                        : 0;
                      const hasQuestions = partCount > 0;

                      return (
                        <button
                          key={part}
                          type="button"
                          onClick={() => setSelectedPart(part)}
                          disabled={!hasQuestions}
                          className={`rounded-3xl border px-4 py-4 text-left transition ${
                            selectedPart === part ? "border-sky-400 bg-slate-800 text-white" : "border-slate-700 bg-slate-950 text-slate-200"
                          } ${!hasQuestions ? "opacity-50 cursor-not-allowed" : "hover:border-sky-400 hover:bg-slate-800"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{partLabels[part] || `Part ${part}`}</span>
                            <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">{partCount} q</span>
                          </div>
                          {!hasQuestions && (
                            <p className="mt-2 text-xs text-amber-300">No questions available for this part.</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedPartMeta?.partType?.toString().toLowerCase() === "oral" && oralTypes.length > 0 && (
                <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-950 p-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400 mb-3">Oral exam type</p>
                  <div className="space-y-3">
                    {oralTypes.map((type) => (
                      <label key={type.key} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 cursor-pointer transition hover:border-sky-400">
                        <input
                          type="radio"
                          name="oralType"
                          value={type.key}
                          checked={selectedOralType === type.key}
                          onChange={() => {
                            setSelectedOralType(type.key);
                            setSelectedOralYear((type.years && type.years[0]) || "");
                          }}
                          className="h-4 w-4 text-sky-600"
                        />
                        <div>
                          <div className="font-semibold text-white">{type.label}</div>
                          <p className="text-sm text-slate-400">{type.description || `Year-based prompts selected randomly at start.`}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedOralType && (
                    <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-3">Choose oral year</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {oralTypes.find((type) => type.key === selectedOralType)?.years?.map((year) => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setSelectedOralYear(year)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${selectedOralYear === year ? "border-sky-400 bg-slate-800 text-white" : "border-slate-700 bg-slate-950 text-slate-200 hover:border-sky-400"}`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                      {selectedOralYear && (
                        <p className="mt-3 text-xs text-slate-500">Selected year: {selectedOralYear}. This year will be used for oral prompts.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={buttonAction}
                disabled={
                  loading ||
                  noQuestionsForPart ||
                  !selectedPartHasQuestions ||
                  (assessmentPaid && !acceptedRules)
                }
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

      {showEssayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-6 shadow-2xl border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Choose Essay Type & Question</h3>
            <p className="text-sm text-slate-400 mb-4">Pick one essay type, then select one question to include in your attempt.</p>
            <div className="flex flex-wrap gap-3 mb-4">
              {essayTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={async () => {
                    setSelectedEssayType(type);
                    setSelectedEssayQuestionId(null);
                    await fetchEssayQuestions(type);
                  }}
                  className={`px-3 py-2 rounded-2xl text-sm font-semibold ${selectedEssayType === type ? "bg-sky-500 text-slate-900" : "bg-slate-800 text-slate-200"}`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <div className="max-h-56 overflow-y-auto mb-4">
              {essayQuestions.length === 0 ? (
                <p className="text-sm text-slate-400">No questions loaded for this type. Select a type to load available questions.</p>
              ) : (
                essayQuestions.map((q) => (
                  <div key={q.questionId || q.id || q._id} className={`p-3 rounded-2xl border mb-2 ${selectedEssayQuestionId === (q.questionId || q.id || q._id) ? 'border-sky-500 bg-slate-800' : 'border-slate-700 bg-slate-950'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="essayQuestion"
                        value={q.questionId || q.id || q._id}
                        checked={selectedEssayQuestionId === (q.questionId || q.id || q._id)}
                        onChange={() => setSelectedEssayQuestionId(q.questionId || q.id || q._id)}
                        className="mt-1 h-4 w-4 text-sky-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{getQuestionText(q) || "(No text)"}</p>
                        {q.guidance && <p className="text-xs text-slate-500 mt-1">{q.guidance}</p>}
                      </div>
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEssayModal(false)}
                className="rounded-2xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startWithSelectedEssay}
                disabled={!selectedEssayQuestionId || !acceptedRules}
                className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                Start Essay
              </button>
            </div>
            {!acceptedRules && <p className="text-xs text-amber-300 mt-3">You must accept the rules before starting.</p>}
          </div>
        </div>
      )}

      <AssessmentAccessModal
        isOpen={showAccessModal}
        assessment={assessmentMeta}
        assessmentId={assessmentMeta?._id}
        onClose={() => setShowAccessModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

