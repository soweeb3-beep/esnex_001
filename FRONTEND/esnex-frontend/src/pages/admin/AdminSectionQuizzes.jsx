import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, inputStyle, buttonStyle } from "./adminUtils";

export default function AdminSectionQuizzes() {
  const { width: windowWidth } = useWindowSize();
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    duration: "30",
    totalMarks: "20",
    passingScore: "50",
    quizCategory: "quiz",
    questionsCount: "10",
    bankPath: "",
    availabilityDate: "",
    closingDate: "",
  });
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  const fetchCoursesAndQuizzes = async () => {
    setLoading(true);
    try {
      const [coursesRes, quizzesRes] = await Promise.all([
        API.get("/courses"),
        API.get("/quiz")
      ]);
      setCourses(coursesRes.data.courses || []);
      setQuizzes(quizzesRes.data.quizzes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchCoursesAndQuizzes();
    };
    loadData();
  }, []);

  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      course.title?.toLowerCase().includes(query) ||
      course._id?.toString().includes(query)
    );
  }, [searchTerm, courses]);

  const getSectionQuizzes = (courseId, sectionId) => {
    return quizzes.filter(quiz =>
      quiz.courseId === courseId &&
      quiz.courseSectionId === sectionId
    );
  };

  const handleCreateQuiz = async (event) => {
    event.preventDefault();
    if (!selectedCourse || !selectedSection) return;

    try {
      const quizData = {
        courseId: selectedCourse._id,
        sectionId: selectedSection._id,
        ...formState,
        duration: parseInt(formState.duration, 10),
        totalMarks: parseInt(formState.totalMarks, 10),
        passingScore: parseInt(formState.passingScore, 10),
        questionsCount: parseInt(formState.questionsCount, 10),
        availabilityDate: formState.availabilityDate ? new Date(formState.availabilityDate).toISOString() : null,
        closingDate: formState.closingDate ? new Date(formState.closingDate).toISOString() : null,
      };

      await API.post("/quiz/course-section", quizData);
      setShowCreateForm(false);
      setFormState({
        title: "",
        description: "",
        duration: "30",
        totalMarks: "20",
        passingScore: "50",
        quizCategory: "quiz",
        questionsCount: "10",
        bankPath: "",
        availabilityDate: "",
        closingDate: "",
      });
      fetchCoursesAndQuizzes();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCourseExpansion = (courseId) => {
    setExpandedCourses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const openCreateForm = (course, section) => {
    setSelectedCourse(course);
    setSelectedSection(section);
    setFormState({
      ...formState,
      title: `${section.title} Quiz`,
    });
    setShowCreateForm(true);
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Section Quizzes</h2>
          <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Create and manage quizzes for course sections. Students must complete all lessons in a section before accessing its quiz.</p>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateQuiz} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Create Quiz for {selectedSection?.title}</h3>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input value={formState.title} onChange={(e) => setFormState({ ...formState, title: e.target.value })} placeholder="Quiz title" style={inputStyle} required />
              <select value={formState.quizCategory} onChange={(e) => setFormState({ ...formState, quizCategory: e.target.value })} style={inputStyle}>
                <option value="quiz">Section Quiz</option>
                <option value="mock-test">Mock Test</option>
                <option value="monthly-exam">Monthly Exam</option>
              </select>
            </div>
            <textarea value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Quiz description" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
              <input type="number" value={formState.duration} onChange={(e) => setFormState({ ...formState, duration: e.target.value })} placeholder="Duration (min)" style={inputStyle} min="1" required />
              <input type="number" value={formState.totalMarks} onChange={(e) => setFormState({ ...formState, totalMarks: e.target.value })} placeholder="Total marks" style={inputStyle} min="1" required />
              <input type="number" value={formState.passingScore} onChange={(e) => setFormState({ ...formState, passingScore: e.target.value })} placeholder="Passing score" style={inputStyle} min="0" required />
              <input type="number" value={formState.questionsCount} onChange={(e) => setFormState({ ...formState, questionsCount: e.target.value })} placeholder="Questions count" style={inputStyle} min="1" required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input type="datetime-local" value={formState.availabilityDate} onChange={(e) => setFormState({ ...formState, availabilityDate: e.target.value })} style={inputStyle} />
              <input type="datetime-local" value={formState.closingDate} onChange={(e) => setFormState({ ...formState, closingDate: e.target.value })} style={inputStyle} />
            </div>
            <input value={formState.bankPath} onChange={(e) => setFormState({ ...formState, bankPath: e.target.value })} placeholder="Question bank path (optional)" style={inputStyle} />
            <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button type="submit" style={buttonStyle}>Create Quiz</button>
            </div>
          </form>
        )}

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading courses and quizzes...</div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No courses found.</div>
          ) : (
            <div style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
              {filteredCourses.map((course) => (
                <div key={course._id} style={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "1rem", overflow: "hidden" }}>
                  <div
                    style={{ padding: "1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => toggleCourseExpansion(course._id)}
                  >
                    <div>
                      <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.1rem" }}>{course.title}</h3>
                      <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>{course.sections?.length || 0} sections</p>
                    </div>
                    <span style={{ color: "#94a3b8", fontSize: "1.2rem" }}>
                      {expandedCourses.has(course._id) ? "−" : "+"}
                    </span>
                  </div>

                  {expandedCourses.has(course._id) && (
                    <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
                      {course.sections?.map((section) => {
                        const sectionQuizzes = getSectionQuizzes(course._id, section._id);
                        return (
                          <div key={section._id} style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(148, 163, 184, 0.08)", borderRadius: "0.75rem", padding: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                              <div>
                                <h4 style={{ margin: 0, color: "#e2e8f0", fontSize: "1rem" }}>{section.title}</h4>
                                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                                  {section.lessons?.length || 0} lessons • {sectionQuizzes.length} quiz{sectionQuizzes.length !== 1 ? 'es' : ''}
                                </p>
                                {section.objectives && section.objectives.length > 0 && (
                                  <ul style={{ marginTop: "0.5rem", color: "#cbd5e1", fontSize: "0.9rem", paddingLeft: "1rem" }}>
                                    {section.objectives.map((obj, idx) => (
                                      <li key={idx} style={{ marginBottom: "0.25rem" }}>{obj}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => openCreateForm(course, section)}
                                style={{ ...buttonStyle, fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                              >
                                + Add Quiz
                              </button>
                            </div>

                            {sectionQuizzes.length > 0 ? (
                              <div style={{ display: "grid", gap: "0.5rem" }}>
                                {sectionQuizzes.map((quiz) => (
                                  <div key={quiz._id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 1fr 0.5fr", gap: "1rem", alignItems: "center", padding: "0.75rem", backgroundColor: "rgba(255,255,255,0.01)", borderRadius: "0.5rem" }}>
                                    <div>
                                      <div style={{ color: "#e2e8f0", fontWeight: "500" }}>{quiz.title}</div>
                                      <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{quiz.quizCategory}</div>
                                    </div>
                                    <div style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>{quiz.duration} min</div>
                                    <div style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>{quiz.totalMarks} marks</div>
                                    <div style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                                      <span style={{ color: quiz.status === "published" ? "#10b981" : "#f59e0b" }}>
                                        {quiz.status}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                      <button type="button" style={{ ...buttonStyle, fontSize: "0.75rem", padding: "0.25rem 0.5rem", backgroundColor: "#3b82f6" }}>Edit</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic", textAlign: "center", padding: "1rem" }}>
                                No quizzes created for this section yet.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}