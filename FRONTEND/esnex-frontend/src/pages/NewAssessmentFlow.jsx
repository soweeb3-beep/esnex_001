import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function NewAssessmentFlow() {
  const { subject } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState("loading"); // loading, part-selection, essay-type, essay-question, assessment
  const [assessment, setAssessment] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [essayTypes, setEssayTypes] = useState([]);
  const [selectedEssayType, setSelectedEssayType] = useState(null);
  const [essayQuestions, setEssayQuestions] = useState([]);
  const [selectedEssayQuestion, setSelectedEssayQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollmentRequired, setEnrollmentRequired] = useState(false);

  // Load assessment with parts on mount
  useEffect(() => {
    loadAssessment();
  }, [subject]);

  const loadAssessment = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/assessments/global/subject/${subject}/with-parts`);
      setAssessment(res.data);
      setStep("part-selection");
      setError("");
    } catch (err) {
      if (err.response?.status === 402) {
        setEnrollmentRequired(true);
        setStep("enrollment");
      } else {
        setError(err.response?.data?.message || "Failed to load assessment");
        setStep("error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePartSelect = async (part) => {
    setSelectedPart(part);

    // If theory part, load essay types first
    if (part.partType === "Theory" && subject.toLowerCase() === "english") {
      try {
        const res = await API.get(`/assessments/global/subject/${subject}/essay-types`);
        setEssayTypes(res.data.essayTypes || []);
        setStep("essay-type");
      } catch (err) {
        setError("Failed to load essay types");
      }
    } else {
      // For non-theory parts, start the assessment directly
      startAssessment(part);
    }
  };

  const handleEssayTypeSelect = async (essayType) => {
    setSelectedEssayType(essayType);

    try {
      const res = await API.get(
        `/assessments/global/subject/${subject}/essay-types/${essayType}/questions`
      );
      setEssayQuestions(res.data.questions || []);
      setStep("essay-question");
    } catch (err) {
      setError("Failed to load essay questions");
    }
  };

  const handleEssayQuestionSelect = (question) => {
    setSelectedEssayQuestion(question);
    startAssessment(selectedPart, selectedEssayType, question.id);
  };

  const startAssessment = async (part, essayType = null, essayQuestionId = null) => {
    try {
      setLoading(true);

      const payload = {
        subject,
        partName: part.partName,
        ...(essayType && { essayType }),
        ...(essayQuestionId && { essayQuestionId }),
      };

      const res = await API.post("/assessments/global/assessment/start-part", payload);

      // Store attempt data in session storage
      sessionStorage.setItem(
        "currentAssessment",
        JSON.stringify({
          attemptId: res.data.attemptId,
          questions: res.data.questions,
          timeLimit: res.data.timeLimit,
          partName: res.data.partName,
        })
      );

      // Navigate to exam interface
      navigate(`/assessment-exam/${res.data.attemptId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start assessment");
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error && step === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
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

  if (enrollmentRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Enrollment Required</h2>
          <p className="text-gray-700 mb-6">
            This assessment requires enrollment or payment. Please complete the enrollment process first.
          </p>
          <button
            onClick={() => navigate(`/assessment-payment/${assessment?._id || assessment?.assessmentId}`)}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition mr-3"
          >
            Enroll Now
          </button>
          <button
            onClick={() => navigate("/assessments")}
            className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // PART SELECTION SCREEN
  if (step === "part-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate("/assessments")}
              className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center gap-2"
            >
              ← Back to Assessments
            </button>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{assessment?.name}</h1>
            <p className="text-gray-600">{assessment?.description}</p>
          </div>

          {/* Parts Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {assessment?.parts?.map((part, idx) => (
              <button
                key={idx}
                onClick={() => handlePartSelect(part)}
                className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-xl transition cursor-pointer border-l-4 border-indigo-600"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-gray-800">{part.partName}</h3>
                  <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-sm font-semibold">
                    {part.partType}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="text-xl font-semibold text-gray-800">{part.duration} min</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Questions</p>
                    <p className="text-xl font-semibold text-gray-800">{part.totalQuestions}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Marks</p>
                    <p className="text-xl font-semibold text-gray-800">{part.totalMarks}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Question Type</p>
                    <p className="text-xl font-semibold text-gray-800">{part.partType}</p>
                  </div>
                </div>

                {part.instructions && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600"><strong>Instructions:</strong> {part.instructions}</p>
                  </div>
                )}

                <button className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-semibold">
                  Start {part.partName}
                </button>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ESSAY TYPE SELECTION SCREEN
  if (step === "essay-type") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep("part-selection")}
            className="text-indigo-600 hover:text-indigo-800 mb-6 flex items-center gap-2"
          >
            ← Back
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedPart?.partName}</h2>
            <p className="text-gray-600 mb-6">Select the type of essay you want to write</p>

            <div className="grid md:grid-cols-2 gap-4">
              {essayTypes.map((essayType, idx) => (
                <button
                  key={idx}
                  onClick={() => handleEssayTypeSelect(essayType)}
                  className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-lg p-6 text-center hover:border-indigo-600 hover:shadow-lg transition"
                >
                  <div className="text-4xl mb-3">
                    {essayType === "letter" && "📝"}
                    {essayType === "article" && "📰"}
                    {essayType === "debate" && "💬"}
                    {essayType === "story" && "📚"}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 capitalize">{essayType}</h3>
                  <p className="text-sm text-gray-600 mt-2 capitalize">{essayType} Writing</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ESSAY QUESTION SELECTION SCREEN
  if (step === "essay-question") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStep("essay-type")}
            className="text-indigo-600 hover:text-indigo-800 mb-6 flex items-center gap-2"
          >
            ← Back
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Select an Essay Topic
            </h2>
            <p className="text-gray-600 mb-6 capitalize">
              {selectedEssayType} Essay - Choose one of the available topics
            </p>

            {essayQuestions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No essay topics available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {essayQuestions.map((question, idx) => (
                  <button
                    key={question.id}
                    onClick={() => handleEssayQuestionSelect(question)}
                    className="w-full text-left bg-gray-50 border-2 border-gray-200 rounded-lg p-6 hover:bg-indigo-50 hover:border-indigo-600 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-2">Question {idx + 1}</p>
                        <p className="text-lg font-semibold text-gray-800">{question.text}</p>
                        {question.guidance && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Guidance:</strong> {question.guidance}
                          </p>
                        )}
                      </div>
                      <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition ml-4">
                        Choose
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
