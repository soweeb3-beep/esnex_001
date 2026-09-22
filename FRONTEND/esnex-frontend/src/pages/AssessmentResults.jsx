import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function AssessmentResults() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("results"); // results, review
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const rubricCategoryLabels = {
    content: 'Content',
    organization: 'Organization',
    expression: 'Expression',
    mechanicalaccuracy: 'Mechanical Accuracy',
    mechanical_accuracy: 'Mechanical Accuracy',
    salutationformat: 'Salutation / Format',
    'salutation/format': 'Salutation / Format',
    'salutation_format': 'Salutation / Format',
  };

  const normalizeRubricKey = (category) =>
    category?.toString().trim().replace(/\s+/g, ' ').replace(/[\/ _]/g, '').toLowerCase();

  const getCategoryLabel = (category) => {
    const normalized = normalizeRubricKey(category);
    return (
      rubricCategoryLabels[normalized] ||
      category
        .toString()
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
    );
  };

  const getCategoryTotalMarks = (category, rubricObj = {}, categoryTotalMarks = {}) => {
    if (!category) return 0;
    if (categoryTotalMarks?.[category] !== undefined) return Number(categoryTotalMarks[category]);
    if (rubricObj?.[category] !== undefined) return Number(rubricObj[category]);

    if (categoryTotalMarks?.[getCategoryLabel(category)] !== undefined) return Number(categoryTotalMarks[getCategoryLabel(category)]);
    if (rubricObj?.[getCategoryLabel(category)] !== undefined) return Number(rubricObj[getCategoryLabel(category)]);

    const normalized = normalizeRubricKey(category);
    return normalized === 'content'
      ? 20
      : normalized === 'organization'
      ? 10
      : normalized === 'expression'
      ? 10
      : normalized === 'mechanicalaccuracy'
      ? 5
      : normalized === 'salutationformat'
      ? 5
      : 0;
  };

  const getCategoryPercentage = (score, totalMarks) =>
    totalMarks ? Math.round((Number(score) / Number(totalMarks)) * 100) : 0;

  useEffect(() => {
    loadAttempt();
  }, [attemptId]);

  const loadAttempt = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/assessments/attempt/${attemptId}`);
      setAttempt(res.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = () => {
    if (!attempt?.answers) return 0;

    if (typeof attempt.obtainedMarks === 'number') {
      return attempt.obtainedMarks;
    }

    return attempt.answers.reduce(
      (sum, answer) => sum + (Number(answer.marks) || 0),
      0
    );
  };

  const score = calculateScore();
  const totalMarks =
    typeof attempt?.totalMarks === 'number'
      ? attempt.totalMarks
      : attempt?.answers?.reduce(
          (sum, answer) => sum + (Number(answer.totalMarks) || 0),
          0
        ) || 0;
  const percentage = totalMarks ? (score / totalMarks) * 100 : 0;
  const isPassed =
    typeof attempt?.passed === 'boolean'
      ? attempt.passed
      : percentage >= (attempt?.passingScore || 50);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate("/assessments")}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-700 text-lg">Attempt not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Score Card */}
        <div className={`rounded-lg shadow-xl p-8 mb-8 text-white ${
          isPassed
            ? "bg-gradient-to-br from-green-600 to-emerald-700"
            : "bg-gradient-to-br from-red-600 to-rose-700"
        }`}>
          <div className="text-center mb-8">
            <div className="text-6xl font-bold mb-4">{isPassed ? "✓" : "✗"}</div>
            <h1 className="text-3xl font-bold mb-2">
              {isPassed ? "Congratulations!" : "Result"}
            </h1>
            <p className="text-lg opacity-90">
              {isPassed ? "You have passed the assessment!" : "Please try again to improve your score"}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <p className="text-sm opacity-75 mb-1">Your Score</p>
              <p className="text-4xl font-bold">{score}</p>
              <p className="text-sm opacity-75">out of {totalMarks}</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-75 mb-1">Total Marks</p>
              <p className="text-4xl font-bold">{totalMarks}</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-75 mb-1">Percentage</p>
              <p className="text-4xl font-bold">{percentage.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-75 mb-1">Grade</p>
              <p className="text-4xl font-bold">{attempt.grade || (isPassed ? 'PASS' : 'FAIL')}</p>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap justify-center">
            <button
              onClick={() => navigate("/assessments")}
              className="bg-white text-green-600 px-6 py-2 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              Try Another Assessment
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white/20 text-white px-6 py-2 rounded-lg hover:bg-white/30 transition font-semibold"
            >
              Print Certificate
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("results")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "results"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Results Summary
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === "review"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Question Review
          </button>
        </div>

        {/* Results Summary Tab */}
        {activeTab === "results" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Assessment Summary</h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Progress Bars */}
              <div>
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700 font-semibold">Marks Obtained</span>
                    <span className="text-gray-600">{score}/{totalMarks}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${(totalMarks ? (score / totalMarks) * 100 : 0)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700 font-semibold">Marks Remaining</span>
                    <span className="text-gray-600">{Math.max(0, totalMarks - score)}/{totalMarks}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${(totalMarks ? (Math.max(0, totalMarks - score) / totalMarks) * 100 : 0)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Questions:</span>
                    <span className="font-semibold">{attempt.questions?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passed:</span>
                    <span className={`font-semibold ${isPassed ? "text-green-600" : "text-red-600"}`}>
                      {isPassed ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Part Attempted:</span>
                    <span className="font-semibold">{attempt.selectedPart}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Taken:</span>
                    <span className="font-semibold">
                      {attempt.timeLeft ? `${Math.round((attempt.timeLeft || 0) / 60)} minutes` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Question Review Tab */}
        {activeTab === "review" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Question Review</h2>

            <div className="space-y-4">
              {attempt.questions?.map((question, idx) => {
                const answer = attempt.answers?.find(a => a.questionIndex === idx);
                const isObjective = Boolean(question.correctAnswer || question.answer);
                const isCorrect = isObjective ? answer?.studentAnswer === question.correctAnswer : false;
                const statusLabel = isObjective
                  ? isCorrect
                    ? '✓ Correct'
                    : '✗ Wrong'
                  : answer?.aiMarked
                    ? 'AI graded'
                    : 'Pending AI marking';
                const statusClass = isObjective
                  ? isCorrect
                    ? 'bg-green-50 border-green-500 hover:bg-green-100 text-green-800'
                    : 'bg-red-50 border-red-500 hover:bg-red-100 text-red-800'
                  : answer?.aiMarked
                    ? 'bg-blue-50 border-blue-500 hover:bg-blue-100 text-blue-800'
                    : 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100 text-yellow-900';
                const ar = answer?.aiReport || null;
                const rubricObj = answer?.rubric || {};

                return (
                  <div
                    key={idx}
                    className={`border-l-4 rounded-lg p-6 cursor-pointer transition ${statusClass}`}
                    onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-800">Question {idx + 1}</span>
                          <span className={`text-sm px-3 py-1 rounded-full font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-3">{question.question || question.prompt || question.text}</p>
                      </div>
                      <span className="text-2xl ml-4">
                        {expandedQuestion === idx ? "−" : "+"}
                      </span>
                    </div>

                    {/* Expanded Details */}
                    {expandedQuestion === idx && (
                      <div className="mt-6 pt-6 border-t border-gray-300 space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-600 mb-2">Your Answer:</p>
                          <p className={`text-lg font-semibold ${
                            isCorrect ? "text-green-600" : "text-red-600"
                          }`}>
                            {answer?.studentAnswer || "Not answered"}
                          </p>
                        </div>

                        {!isCorrect && (
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">Correct Answer:</p>
                            <p className="text-lg font-semibold text-green-600">
                              {question.correctAnswer || question.answer || "N/A"}
                            </p>
                          </div>
                        )}
                        {/* AI Marking Breakdown */}
                        {expandedQuestion === idx && ar && (
                          <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">AI Mark Breakdown</h3>
                            <div className="grid md:grid-cols-2 gap-3 mb-3">
                              {Object.entries(ar.categoryScores || {})
                                .sort(([a], [b]) => {
                                  const order = ['content', 'organization', 'expression', 'mechanicalaccuracy', 'salutationformat'];
                                  return order.indexOf(normalizeRubricKey(a)) - order.indexOf(normalizeRubricKey(b));
                                })
                                .map(([cat, val]) => {
                                  const label = getCategoryLabel(cat);
                                  const totalMarks = getCategoryTotalMarks(cat, rubricObj, ar.categoryTotalMarks);
                                  const percentage = getCategoryPercentage(val, totalMarks);
                                  return (
                                    <div key={cat} className="bg-white p-3 rounded shadow-sm">
                                      <div className="flex justify-between items-baseline">
                                        <div className="text-sm text-gray-700 font-semibold">{label}</div>
                                        <div className="text-sm text-gray-900 font-bold">
                                          {Number(val)}{totalMarks ? `/${totalMarks}` : ''} {totalMarks ? `(${percentage}%)` : ''}
                                        </div>
                                      </div>
                                      {ar.categoryFeedback && ar.categoryFeedback[cat] && (
                                        <p className="text-xs text-gray-600 mt-2">{ar.categoryFeedback[cat]}</p>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-semibold">Total Score</p>
                              <p className="text-xl font-bold">{(ar.totalScore ?? ar.score ?? 0)} / {Object.values(rubricObj).reduce((s, v) => s + Number(v || 0), 0) || attempt.totalMarks || question.totalMarks || 'N/A'}</p>
                            </div>

                            <div className="mt-4 space-y-3 text-sm text-gray-700">
                              {ar.strengths && ar.strengths.length > 0 && (
                                <div>
                                  <div className="font-semibold text-gray-800">Strengths</div>
                                  <ul className="list-disc ml-5 mt-1">{ar.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                </div>
                              )}

                              {ar.weaknesses && ar.weaknesses.length > 0 && (
                                <div>
                                  <div className="font-semibold text-gray-800">Weaknesses</div>
                                  <ul className="list-disc ml-5 mt-1">{ar.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                                </div>
                              )}

                              {ar.grammarCorrections && (
                                <div>
                                  <div className="font-semibold text-gray-800">Grammar Corrections</div>
                                  <p className="mt-1">{ar.grammarCorrections}</p>
                                </div>
                              )}

                              {ar.missingPoints && ar.missingPoints.length > 0 && (
                                <div>
                                  <div className="font-semibold text-gray-800">Missing Points</div>
                                  <ul className="list-disc ml-5 mt-1">{ar.missingPoints.map((m, i) => <li key={i}>{m}</li>)}</ul>
                                </div>
                              )}

                              {ar.suggestions && (
                                <div>
                                  <div className="font-semibold text-gray-800">Suggestions</div>
                                  <p className="mt-1">{ar.suggestions}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {question.explanation && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Explanation:</p>
                            <p className="text-gray-700">{question.explanation}</p>
                          </div>
                        )}

                        {question.options && (
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">All Options:</p>
                            <div className="space-y-2">
                              {question.options.map((option, optIdx) => (
                                <p key={optIdx} className="text-gray-700">
                                  {String.fromCharCode(65 + optIdx)}. {option}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={() => navigate("/assessments")}
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            Back to Assessments
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-gray-400 text-white px-8 py-3 rounded-lg hover:bg-gray-500 transition font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
