import { useState, useEffect, useRef } from "react";
import API from "../api/axios";

const AssessmentUI = ({ assessmentId }) => {
  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentPart, setCurrentPart] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  function setupAntiCheat(attemptId) {
    if (!assessment?.antiCheat?.enabled) return;

    // Fullscreen mode
    if (assessment.antiCheat.fullscreen) {
      document.documentElement.requestFullscreen?.().catch(err => {
        console.warn("Fullscreen failed", err);
      });
    }

    // Tab switch detection
    if (assessment.antiCheat.tabSwitchDetection) {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          handleTabSwitch(attemptId);
        }
      });

      window.addEventListener("blur", () => {
        handleTabSwitch(attemptId);
      });
    }

    // Disable copy-paste
    if (assessment.antiCheat.copyPasteDisabled) {
      document.addEventListener("copy", (e) => e.preventDefault());
      document.addEventListener("cut", (e) => e.preventDefault());
      document.addEventListener("paste", (e) => e.preventDefault());
    }

    // Disable inspect element
    if (assessment.antiCheat.inspectDisabled) {
      document.addEventListener("keydown", (e) => {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && e.keyCode === 73) || (e.ctrlKey && e.shiftKey && e.keyCode === 74)) {
          e.preventDefault();
        }
      });
      document.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  async function handleTabSwitch(attemptId) {
    try {
      const response = await API.post(`/assessments/${attemptId}/tab-switch`);
      setWarnings(response.data.warnings || 0);

      if (response.data.action === "auto-submit") {
        submitAttempt(attemptId);
      }
    } catch (error) {
      console.error("Tab switch recording failed", error);
    }
  }

  function startTimer(attemptId) {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitAttempt(attemptId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function submitAttempt(attemptId = attempt._id) {
    try {
      const flattenedAnswers = [];
      questions.forEach((part, partIndex) => {
        part.sections.forEach((section, sectionIndex) => {
          section.questions.forEach((question, questionIndex) => {
            const key = `${partIndex}-${sectionIndex}-${questionIndex}`;
            flattenedAnswers.push({
              questionIndex: getGlobalQuestionIndex(partIndex, sectionIndex, questionIndex),
              questionId: question.questionId || question._id || `${partIndex}-${sectionIndex}-${questionIndex}`,
              studentAnswer: answers[key] || "",
            });
          });
        });
      });

      const response = await API.post(`/assessments/${attemptId}/submit`, {
        answers: flattenedAnswers,
      });
      setSubmitted(true);
      setResults(response.data.result);
      clearInterval(timerRef.current);
    } catch (error) {
      console.error("Submission failed", error);
    }
  }

  const getGlobalQuestionIndex = (partIndex, sectionIndex, questionIndex) => {
    let index = 0;
    for (let part = 0; part < partIndex; part += 1) {
      index += questions[part]?.sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
    }
    for (let section = 0; section < sectionIndex; section += 1) {
      index += questions[partIndex]?.sections?.[section]?.questions?.length || 0;
    }
    return index + questionIndex;
  };

  async function autoSave(attemptId) {
    const currentPartData = questions[currentPart];
    const currentSectionData = currentPartData?.sections?.[currentSection];
    const sectionQuestions = currentSectionData?.questions || [];

    const sectionHasPassage = Boolean(
      currentSectionData?.passage ||
      currentSectionData?.summary?.passage ||
      sectionQuestions.some((q) => q?.passage || q?.passageText || q?.sourceText || q?.textToSummarize || q?.summary?.passage)
    );

    if (sectionQuestions.length > 1 && sectionHasPassage) {
      await Promise.all(sectionQuestions.map(async (question, questionIndex) => {
        const answerKey = `${currentPart}-${currentSection}-${questionIndex}`;
        await API.post(`/assessments/${attemptId}/answer`, {
          answer: {
            questionId: question.questionId || question._id || `${currentPart}-${currentSection}-${questionIndex}`,
            studentAnswer: answers[answerKey] || "",
            type: question.type || question.questionType || "objective",
            correctAnswer: question.correctAnswer || question.answer || "",
          },
          questionIndex: getGlobalQuestionIndex(currentPart, currentSection, questionIndex),
          partName: currentPartData?.partName || currentPartData?.name || "",
          sectionName: currentSectionData?.name || currentSectionData?.sectionName || "",
          currentQuestionIndex: questionIndex,
        });
      }));
      return;
    }

    const currentQ = sectionQuestions[currentQuestion];
    if (currentQ) {
      const questionIndex = getGlobalQuestionIndex(currentPart, currentSection, currentQuestion);
      await API.post(`/assessments/${attemptId}/answer`, {
        answer: {
          questionId: currentQ.questionId || currentQ._id || `${currentPart}-${currentSection}-${currentQuestion}`,
          studentAnswer: answers[`${currentPart}-${currentSection}-${currentQuestion}`] || "",
          type: currentQ.type || currentQ.questionType || "objective",
          correctAnswer: currentQ.correctAnswer || currentQ.answer || "",
        },
        questionIndex,
        partName: currentPartData?.partName || currentPartData?.name || "",
        sectionName: currentSectionData?.name || currentSectionData?.sectionName || "",
        currentQuestionIndex: currentQuestion,
      });
    }
  }

  async function startAssessment() {
    try {
      const response = await API.post(`/assessments/${assessmentId}/start`);
      // Normalize different backend response shapes
      const resp = response.data || {};
      // Primary shape expected by newer endpoints
      let parts = resp.questionsData?.parts;
      let assessmentData = resp.assessmentData;
      let attempt = resp.attempt;

      // Legacy/alternate shape: attempt contains flat questions array
      if (!parts && attempt?.questions) {
        const grouped = {};
        attempt.questions.forEach((q) => {
          const sectionName = q.sectionName || q.section || "Section";
          if (!grouped[sectionName]) grouped[sectionName] = [];
          const normalizeOptions = (opts) => {
            if (!opts) return [];
            if (Array.isArray(opts)) return opts;
            if (typeof opts === "object") return Object.keys(opts).sort().map(k => opts[k]);
            return [];
          };

          grouped[sectionName].push({
            question: q.questionText || q.question || q.text || "",
            questionId: q.questionId || q.questionId || q.id || "",
            type: q.type || q.questionType || "objective",
            options: normalizeOptions(q.options),
            marks: q.marks || q.marks || 0,
          });
        });

        parts = [
          {
            partName: attempt.selectedPart || "Part A",
            sections: Object.keys(grouped).map((name) => ({ name, questions: grouped[name] })),
          },
        ];

        assessmentData = assessmentData || {
          duration: attempt.duration || 0,
          totalMarks: attempt.totalMarks || 0,
          name: assessment?.name || "Assessment",
        };
      }

      setAssessment(assessmentData || null);
      setAttempt(attempt || null);
      setQuestions(parts || []);
      setTimeLeft((assessmentData?.duration || (attempt?.duration || 0)) * 60);
      setLoading(false);

      // Resolve attempt id (some responses use "id" while others use "_id")
      const attemptIdResolved = attempt?._id || attempt?.id;

      // Anti-cheat setup
      if (attemptIdResolved) setupAntiCheat(attemptIdResolved, attempt?.sessionToken || resp.sessionToken);

      // Start timer
      if (attemptIdResolved) startTimer(attemptIdResolved, (assessmentData?.duration || attempt?.duration || 0) * 60);

      // Auto-save every 30 seconds (managed)
      if (attemptIdResolved) {
        if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setInterval(() => autoSave(attemptIdResolved), 30000);
      }
    } catch (error) {
      console.error("Failed to start assessment", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    startAssessment();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [assessmentId]);

  const navigateQuestion = (direction) => {
    const maxQuestions = questions[currentPart]?.sections[currentSection]?.questions.length - 1;
    if (direction === "next" && currentQuestion < maxQuestions) {
      setCurrentQuestion(prev => prev + 1);
    } else if (direction === "prev" && currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const navigateSection = (direction) => {
    const maxSections = questions[currentPart]?.sections.length - 1;
    if (direction === "next" && currentSection < maxSections) {
      setCurrentSection(prev => prev + 1);
      setCurrentQuestion(0);
    } else if (direction === "prev" && currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      setCurrentQuestion(0);
    }
  };

  const navigatePart = (direction) => {
    const maxParts = questions.length - 1;
    if (direction === "next" && currentPart < maxParts) {
      setCurrentPart(prev => prev + 1);
      setCurrentSection(0);
      setCurrentQuestion(0);
    } else if (direction === "prev" && currentPart > 0) {
      setCurrentPart(prev => prev - 1);
      setCurrentSection(0);
      setCurrentQuestion(0);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) return <div className="text-center p-8">Loading assessment...</div>;

  if (submitted && results) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Assessment Submitted</h1>
        <div className="bg-white p-8 rounded-lg shadow">
          <div className="mb-6">
            <p className="text-lg mb-2">Total Marks: <span className="font-bold text-xl">{results.totalMarks}</span></p>
            <p className="text-lg mb-2">Percentage: <span className={`font-bold text-xl ${results.percentage >= 50 ? "text-green-600" : "text-red-600"}`}>{results.percentage.toFixed(2)}%</span></p>
            <p className="text-lg">Status: <span className={`font-bold text-xl ${results.passed ? "text-green-600" : "text-red-600"}`}>{results.passed ? "PASSED" : "FAILED"}</span></p>
          </div>
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentPartData = questions[currentPart];
  const currentSectionData = currentPartData?.sections[currentSection];
  const sectionQuestions = currentSectionData?.questions || [];
  const currentQ = sectionQuestions[currentQuestion];

  const getAnswerKey = (questionIndex) => `${currentPart}-${currentSection}-${questionIndex}`;
  const getAnswerValue = (questionIndex) => answers[getAnswerKey(questionIndex)] || "";

  const handleAnswerChange = (value, questionIndex = currentQuestion) => {
    const key = getAnswerKey(questionIndex);
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const isQuestionChoice = (question) => {
    return question?.options && [
      "objective",
      "mcq",
      "multiple-choice",
      "multiple choice",
      "multiplechoice",
    ].includes((question?.type || question?.questionType || "").toLowerCase());
  };

  const isCurrentQuestionChoice = isQuestionChoice(currentQ);

  const sectionHasPassage = Boolean(
    currentSectionData?.passage ||
    currentSectionData?.summary?.passage ||
    sectionQuestions.some((q) => q?.passage || q?.passageText || q?.sourceText || q?.textToSummarize || q?.summary?.passage)
  );

  const shouldRenderAllSectionQuestions = sectionQuestions.length > 1 && sectionHasPassage;

  const isSummaryQuestionFor = (question) => {
    const sectionTitle = (currentSectionData?.section_title || currentSectionData?.name || "").toString().toLowerCase();
    const qType = (question?.type || question?.questionType || "").toString().toLowerCase();
    const qText = (question?.question || question?.text || "").toString().toLowerCase();
    const qId = (question?.id || question?.questionId || "").toString().toLowerCase();
    return sectionTitle.includes("summary") || qType === "summary" || qText.includes("summary") || qId.includes("summary");
  };

  const currentAnswerText = getAnswerValue(currentQuestion);
  const wordCount = (txt) => (String(txt).trim() === "" ? 0 : String(txt).trim().split(/\s+/).filter(Boolean).length);
  const isSummaryQuestion = isSummaryQuestionFor(currentQ);

  // Determine if this section/question contains a passage or source text
  const passageData = currentSectionData?.passage || currentSectionData?.summary?.passage || currentQ?.passage || currentQ?.passageText || currentQ?.sourceText || currentQ?.textToSummarize || currentQ?.summary?.passage || null;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{assessment?.name}</h1>
        <div className="flex items-center gap-4">
          {warnings > 0 && (
            <div className="bg-red-500 px-4 py-2 rounded">
              ⚠️ Warnings: {warnings}/{assessment?.antiCheat?.maxWarnings}
            </div>
          )}
          <div className="text-2xl font-mono font-bold">{formatTime(timeLeft)}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Question Panel */}
        <div className="flex-1 bg-white rounded-lg shadow p-6 overflow-y-auto">
          {sectionQuestions.length > 0 && (
            <>
              <h2 className="text-2xl font-bold mb-4">
                {(currentPartData?.partName || currentPartData?.name || "Part")}
                {" - "}
                {(currentSectionData?.name || currentSectionData?.sectionName || "Section")}
              </h2>

              {/* Render passage or source text for comprehension/summary if available */}
              {passageData && (
                <div className="mb-6 p-4 bg-gray-50 border rounded">
                  {Array.isArray(passageData)
                    ? passageData.map((para, idx) => (
                        <p key={idx} className="mb-3 text-gray-800 leading-relaxed">{para.text || para}</p>
                      ))
                    : <p className="text-gray-800 leading-relaxed">{passageData}</p>
                  }

                  {(currentSectionData?.summary?.instruction || currentQ?.summary?.instruction) && (
                    <div className="mt-3 text-sm text-gray-600 italic">
                      {currentSectionData?.summary?.instruction || currentQ?.summary?.instruction}
                    </div>
                  )}
                </div>
              )}

              {shouldRenderAllSectionQuestions ? (
                <div className="space-y-8">
                  {sectionQuestions.map((question, qIndex) => {
                    const answerKey = getAnswerKey(qIndex);
                    const answerText = getAnswerValue(qIndex);
                    const isSummaryQuestionForThis = isSummaryQuestionFor(question);
                    const isQuestionChoiceForThis = isQuestionChoice(question);

                    return (
                      <div key={qIndex} className="p-4 border rounded bg-gray-50">
                        <h3 className="text-xl font-semibold mb-3">Question {qIndex + 1}</h3>
                        <p className="text-lg mb-6">{question.question || question.text}</p>

                        {question.options && isQuestionChoiceForThis && (
                          <div className="space-y-3 mb-6">
                            {question.options.map((option, idx) => (
                              <label key={idx} className="flex items-center p-3 border rounded hover:bg-blue-50 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`answer-${currentPart}-${currentSection}-${qIndex}`}
                                  value={option}
                                  checked={answers[answerKey] === option}
                                  onChange={(e) => handleAnswerChange(e.target.value, qIndex)}
                                  className="mr-3"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {(question.type === "theory" || question.type === "essay" || question.type === "text" || question.questionType === "text" || question.type === "summary") && (
                          <>
                            <textarea
                              value={answerText}
                              onChange={(e) => handleAnswerChange(e.target.value, qIndex)}
                              placeholder={isSummaryQuestionForThis ? "Write your summary here..." : "Type your answer here..."}
                              className={`w-full p-3 border rounded mb-2 ${isSummaryQuestionForThis ? 'border-yellow-300 bg-yellow-50' : ''}`}
                              rows={isSummaryQuestionForThis ? 6 : 8}
                            />

                            {isSummaryQuestionForThis && (
                              <div className="flex items-center justify-between text-sm text-gray-600 mb-6">
                                <div>
                                  {(() => {
                                    const min = question?.minimum_words || question?.minWords || question?.checks?.minimum_word_count || currentSectionData?.minimum_words || currentSectionData?.minWords;
                                    const rec = question?.recommended_words || question?.recommendedWords || currentSectionData?.recommended_words;
                                    const max = question?.maximum_words || question?.maxWords || question?.checks?.maximum_word_count || currentSectionData?.maximum_words;
                                    if (min || rec || max) {
                                      return (
                                        <span>
                                          {min ? `Min: ${min} ` : ''}{rec ? `Recommended: ${rec} ` : ''}{max ? `Max: ${max}` : ''}
                                        </span>
                                      );
                                    }
                                    return <span>Aim for a concise summary (e.g. 50–100 words).</span>;
                                  })()}
                                </div>
                                <div className="font-mono">Words: {wordCount(answerText)}</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-semibold mb-4">Question {currentQuestion + 1}</h3>
                  <p className="text-lg mb-6">{currentQ.question || currentQ.text}</p>

                  {currentQ.options && isCurrentQuestionChoice && (
                    <div className="space-y-3 mb-6">
                      {currentQ.options.map((option, idx) => (
                        <label key={idx} className="flex items-center p-3 border rounded hover:bg-blue-50 cursor-pointer">
                          <input
                            type="radio"
                            name="answer"
                            value={option}
                            checked={answers[`${currentPart}-${currentSection}-${currentQuestion}`] === option}
                            onChange={(e) => handleAnswerChange(e.target.value)}
                            className="mr-3"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(currentQ.type === "theory" || currentQ.type === "essay" || currentQ.type === "text" || currentQ.questionType === "text" || currentQ.type === "summary") && (
                    <>
                      <textarea
                        value={currentAnswerText}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder={isSummaryQuestion ? "Write your summary here..." : "Type your answer here..."}
                        className={`w-full p-3 border rounded mb-2 ${isSummaryQuestion ? 'border-yellow-300 bg-yellow-50' : ''}`}
                        rows={isSummaryQuestion ? 6 : 8}
                      />

                      {isSummaryQuestion && (
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-6">
                          <div>
                            {(() => {
                              const min = currentQ?.minimum_words || currentQ?.minWords || currentQ?.checks?.minimum_word_count || currentSectionData?.minimum_words || currentSectionData?.minWords;
                              const rec = currentQ?.recommended_words || currentQ?.recommendedWords || currentSectionData?.recommended_words;
                              const max = currentQ?.maximum_words || currentQ?.maxWords || currentQ?.checks?.maximum_word_count || currentSectionData?.maximum_words;
                              if (min || rec || max) {
                                return (
                                  <span>
                                    {min ? `Min: ${min} ` : ''}{rec ? `Recommended: ${rec} ` : ''}{max ? `Max: ${max}` : ''}
                                  </span>
                                );
                              }
                              return <span>Aim for a concise summary (e.g. 50–100 words).</span>;
                            })()}
                          </div>
                          <div className="font-mono">Words: {wordCount(currentAnswerText)}</div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            {!shouldRenderAllSectionQuestions && (
              <>
                <button
                  onClick={() => navigateQuestion("prev")}
                  disabled={currentQuestion === 0}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => navigateQuestion("next")}
                  disabled={currentQuestion === (currentSectionData?.questions.length - 1)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  Next →
                </button>
              </>
            )}

            {currentSection < currentPartData.sections.length - 1 && (
              <button
                onClick={() => navigateSection("next")}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next Section →
              </button>
            )}

            {currentPart < questions.length - 1 && (
              <button
                onClick={() => navigatePart("next")}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Next Part →
              </button>
            )}

            <button
              onClick={() => submitAttempt()}
              className="ml-auto px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
            >
              Submit Assessment
            </button>
          </div>
        </div>

        {/* Progress Sidebar */}
        <div className="w-64 bg-white rounded-lg shadow p-4 overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">Progress</h3>
          {questions.map((part, pIdx) => (
            <div key={pIdx} className="mb-4">
              <button
                onClick={() => { setCurrentPart(pIdx); setCurrentSection(0); setCurrentQuestion(0); }}
                className={`w-full text-left p-2 rounded font-bold ${currentPart === pIdx ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                {part.partName || part.name || `Part ${pIdx + 1}`}
              </button>
              {currentPart === pIdx && (
                <div className="ml-2 space-y-1 mt-2">
                  {part.sections.map((section, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => { setCurrentSection(sIdx); setCurrentQuestion(0); }}
                      className={`w-full text-left p-2 text-sm rounded ${currentSection === sIdx ? "bg-blue-400 text-white" : "bg-gray-100"}`}
                    >
                      {section.name} ({section.questions.length}Q)
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssessmentUI;
