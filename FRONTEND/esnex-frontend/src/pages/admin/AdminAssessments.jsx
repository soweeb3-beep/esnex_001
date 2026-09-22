import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, tableHeader, tableCell, inputStyle, buttonStyle } from "./adminUtils";

export default function AdminAssessments() {
  const navigate = useNavigate();
  const { width: windowWidth } = useWindowSize();
  const [assessments, setAssessments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [expandedAssessments, setExpandedAssessments] = useState(new Set());
  const [activeTab, setActiveTab] = useState("global");
  const [formState, setFormState] = useState({ name: "", subject: "", duration: "60", price: "10", status: "published", visibility: true, description: "" });
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "global") {
          const res = await API.get("/assessments?type=global");
          setAssessments(res.data.assessments || []);
        } else if (activeTab === "section") {
          const [coursesRes, quizzesRes] = await Promise.all([
            API.get("/courses"),
            API.get("/quiz")
          ]);
          setCourses(coursesRes.data.courses || []);
          setQuizzes(quizzesRes.data.quizzes || []);
        } else if (activeTab === "quizzes") {
          const res = await API.get("/quizzes");
          setQuizzes(res.data.quizzes || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      if (activeTab === "global") return assessments;
      if (activeTab === "section") return courses;
      if (activeTab === "quizzes") return quizzes;
      return [];
    }

    if (activeTab === "global") {
      return assessments.filter((assessment) =>
        assessment.name?.toLowerCase().includes(query) ||
        assessment.subject?.toLowerCase().includes(query) ||
        assessment.status?.toLowerCase().includes(query) ||
        assessment._id?.toString().includes(query)
      );
    } else if (activeTab === "section") {
      return courses.filter((course) =>
        course.title?.toLowerCase().includes(query) ||
        course._id?.toString().includes(query)
      );
    } else if (activeTab === "quizzes") {
      return quizzes.filter((quiz) =>
        quiz.title?.toLowerCase().includes(query) ||
        quiz.description?.toLowerCase().includes(query) ||
        quiz._id?.toString().includes(query)
      );
    }
    return [];
  }, [searchTerm, assessments, quizzes, courses, activeTab]);

  const handleSelect = (item) => {
    if (activeTab === "global") {
      setSelectedAssessment(item);
      setFormState({
        name: item.name || "",
        subject: item.subject || "",
        duration: item.duration?.toString() ?? "",
        price: item.price?.toString() ?? "",
        status: item.status || "published",
        visibility: item.visibility !== false,
        description: item.description || "",
      });
    }
  };

  const handleOpenBuilder = (assessment) => {
    navigate(`/admin/assessments/edit/${assessment._id}`);
  };

  const toggleExpansion = (itemId) => {
    setExpandedAssessments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleCreateRoute = () => {
    if (activeTab === "global") {
      navigate("/admin/assessments/create");
    } else if (activeTab === "section") {
      navigate("/admin/section-quizzes");
    } else if (activeTab === "quizzes") {
      // Handle quiz creation
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!selectedAssessment || activeTab !== "global") return;
    try {
      const durationValue = parseInt(formState.duration, 10);
      const priceValue = parseFloat(formState.price);

      if (!Number.isFinite(durationValue) || durationValue <= 0) {
        setError("Duration must be a positive integer.");
        setLoading(false);
        return;
      }

      if (!Number.isFinite(priceValue) || priceValue < 0) {
        setError("Price must be a valid non-negative number.");
        setLoading(false);
        return;
      }

      const payload = {
        ...selectedAssessment,
        ...formState,
        duration: durationValue,
        price: priceValue,
        visibility: Boolean(formState.visibility),
      };
      const res = await API.put(`/assessments/${selectedAssessment._id}`, payload);
      setAssessments((current) => current.map((assessment) => (assessment._id === selectedAssessment._id ? res.data.assessment || payload : assessment)));
      setSelectedAssessment(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (itemId) => {
    const itemType = activeTab === "global" ? "assessment" : activeTab === "quizzes" ? "quiz" : "item";
    if (!window.confirm(`Are you sure you want to delete this ${itemType}? This action cannot be undone.`)) {
      return;
    }
    try {
      if (activeTab === "global") {
        await API.delete(`/assessments/${itemId}`);
        setAssessments((current) => current.filter((assessment) => assessment._id !== itemId));
      } else if (activeTab === "quizzes") {
        await API.delete(`/quiz/${itemId}`);
        setQuizzes((current) => current.filter((quiz) => quiz._id !== itemId));
      }
      setSelectedAssessment(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert(`Failed to delete ${itemType}`);
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        {/* Tab Navigation */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { key: "global", label: "Global Assessments", description: "Manage global WAEC/WASSCE assessments" },
              { key: "section", label: "Section Assessments", description: "Manage course section quizzes" },
              { key: "quizzes", label: "Quizzes", description: "Manage standalone quizzes" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...buttonStyle,
                  backgroundColor: activeTab === tab.key ? "#2563eb" : "transparent",
                  border: activeTab === tab.key ? "1px solid #2563eb" : "1px solid rgba(148, 163, 184, 0.12)",
                  padding: "0.75rem 1rem",
                  flex: isMobile ? "1" : "auto",
                  minWidth: isMobile ? "auto" : "200px"
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>{tab.label}</div>
                <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{tab.description}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>
                {activeTab === "global" ? "Global Assessments" :
                 activeTab === "section" ? "Section Assessments" :
                 "Quizzes"}
              </h2>
              <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
                {activeTab === "global" ? "Manage what students can access and open the assessment builder for each exam." :
                 activeTab === "section" ? "Create and manage quizzes for course sections. Students must complete all lessons in a section before accessing its quiz." :
                 "Manage standalone quizzes that appear in the student dashboard."}
              </p>
            </div>
            <button type="button" onClick={handleCreateRoute} style={{ ...buttonStyle, padding: "0.75rem 1rem" }}>
              {activeTab === "global" ? "Create new assessment" :
               activeTab === "section" ? "Manage Section Quizzes" :
               "Create new quiz"}
            </button>
          </div>
        </div>

        {activeTab === "section" && (
          <div style={{ backgroundColor: "rgba(37, 99, 235, 0.06)", border: "1px solid rgba(37, 99, 235, 0.2)", borderRadius: "1.25rem", padding: isMobile ? "1rem" : "1.25rem", display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: "0.75rem" }}>
              <div>
                <h3 style={{ margin: 0, color: "#0ea5e9" }}>Create section quizzes for course lessons</h3>
                <p style={{ margin: "0.5rem 0 0", color: "#c7d2fe", fontSize: "0.95rem" }}>
                  Use the Section Quizzes manager to add quizzes to course sections, and ensure students complete the section before unlocking the quiz.
                </p>
              </div>
              <button type="button" onClick={handleCreateRoute} style={{ ...buttonStyle, padding: "0.75rem 1rem", backgroundColor: "#2563eb" }}>
                Open Section Quizzes Manager
              </button>
            </div>
          </div>
        )}

        {/* Global Assessments Tab */}
        {activeTab === "global" && selectedAssessment && (
          <form onSubmit={handleSave} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Quick edit metadata</h3>
            <input value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="Assessment name" style={inputStyle} />
            <input value={formState.subject} onChange={(e) => setFormState({ ...formState, subject: e.target.value })} placeholder="Subject" style={inputStyle} />
            <input value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Description" style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1rem" }}>
              <input value={formState.duration} onChange={(e) => setFormState({ ...formState, duration: e.target.value })} placeholder="Duration (min)" type="number" style={inputStyle} />
              <input value={formState.price} onChange={(e) => setFormState({ ...formState, price: e.target.value })} placeholder="Price (D)" type="number" step="0.01" style={inputStyle} />
              <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value })} style={inputStyle}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <label style={{ color: "#e2e8f0" }}>
              <input
                type="checkbox"
                checked={formState.visibility}
                onChange={(e) => setFormState({ ...formState, visibility: e.target.checked })}
              />
              {" "}Visible to public
            </label>
            <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setSelectedAssessment(null)} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button type="submit" style={buttonStyle}>Save assessment</button>
            </div>
          </form>
        )}

        {/* Content based on active tab */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Loading {activeTab === "global" ? "assessments" : activeTab === "section" ? "courses" : "quizzes"}...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              No {activeTab === "global" ? "assessments" : activeTab === "section" ? "courses" : "quizzes"} found.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "640px" : "auto" }}>
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem", width: "40px" }}></th>
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Name</th>
                  {activeTab === "global" && !isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Subject</th>}
                  {activeTab === "global" && !isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Price</th>}
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Status</th>
                  <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                        {(activeTab === "global" || activeTab === "section") && (
                          <button
                            type="button"
                            onClick={() => toggleExpansion(item._id)}
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
                          >
                            {expandedAssessments.has(item._id) ? "▼" : "▶"}
                          </button>
                        )}
                      </td>
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                        {activeTab === "section" ? item.title : item.name}
                      </td>
                      {activeTab === "global" && !isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{item.subject || "—"}</td>}
                      {activeTab === "global" && !isMobile && <td style={{ ...tableCell, padding: "1rem" }}>D{item.price ?? 0}</td>}
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                        {activeTab === "global" ? (item.status || "draft") : "Active"}
                      </td>
                      <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {activeTab === "global" && (
                          <>
                            <button type="button" onClick={() => handleSelect(item)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#2563eb" }}>Edit</button>
                            <button type="button" onClick={() => handleOpenBuilder(item)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#059669" }}>Open builder</button>
                            <button type="button" onClick={() => handleDelete(item._id)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#dc2626" }}>Delete</button>
                          </>
                        )}
                        {activeTab === "section" && (
                          <button type="button" onClick={() => navigate(`/admin/section-quizzes`)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#059669" }}>Manage Quizzes</button>
                        )}
                        {activeTab === "quizzes" && (
                          <>
                            <button type="button" style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#2563eb" }}>Edit</button>
                            <button type="button" onClick={() => handleDelete(item._id)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#dc2626" }}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedAssessments.has(item._id) && activeTab === "global" && (
                      <tr>
                        <td colSpan={isMobile ? 5 : 6} style={{ ...tableCell, padding: "1rem", backgroundColor: "rgba(255,255,255,0.02)" }}>
                          <div style={{ display: "grid", gap: "1rem" }}>
                            <h4 style={{ margin: 0, color: "#e2e8f0" }}>Assessment Structure</h4>
                            {item.parts && item.parts.length > 0 ? (
                              item.parts.map((part, partIdx) => (
                                <div key={partIdx} style={{ border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: "0.5rem", padding: "1rem", backgroundColor: "rgba(255,255,255,0.01)" }}>
                                  <h5 style={{ margin: "0 0 0.5rem 0", color: "#e2e8f0" }}>
                                    Part {String.fromCharCode(65 + partIdx)} · {part.title || part.type}
                                  </h5>
                                  <p style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>
                                    Type: {part.type} · Duration: {part.duration} min · Total Questions: {part.totalQuestions ?? part.sections?.reduce((sum, section) => sum + (section.questionCount ?? 0), 0) ?? 0} · Total Marks: {part.totalMarks ?? part.sections?.reduce((sum, section) => sum + (section.totalMarks ?? 0), 0) ?? 0}
                                  </p>
                                  {part.instructions && (
                                    <p style={{ margin: "0 0 0.5rem 0", color: "#cbd5e1", fontSize: "0.9rem" }}>
                                      <strong>Instructions:</strong> {part.instructions}
                                    </p>
                                  )}
                                  {part.sections && part.sections.length > 0 ? (
                                    <div style={{ display: "grid", gap: "0.5rem" }}>
                                      <h6 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.95rem" }}>Sections:</h6>
                                      {part.sections.map((section, sectionIdx) => (
                                        <div key={sectionIdx} style={{ padding: "0.5rem", backgroundColor: "rgba(255,255,255,0.005)", borderRadius: "0.25rem", border: "1px solid rgba(148, 163, 184, 0.1)" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                            <div>
                                              <span style={{ color: "#e2e8f0", fontWeight: "bold" }}>
                                                {section.name || `Section ${String.fromCharCode(65 + sectionIdx)}`}
                                              </span>
                                            </div>
                                            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                                              Questions: {section.questionCount ?? 0} | Marks: {section.totalMarks ?? 0}
                                            </span>
                                          </div>
                                          {section.instructions && (
                                            <p style={{ margin: "0.25rem 0 0 0", color: "#cbd5e1", fontSize: "0.8rem" }}>
                                              <strong>Section instructions:</strong> {section.instructions}
                                            </p>
                                          )}
                                          {section.bankPath && (
                                            <p style={{ margin: "0.25rem 0 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>
                                              Bank: {section.bankPath}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>No sections defined.</p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p style={{ margin: 0, color: "#94a3b8" }}>No parts defined yet.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
