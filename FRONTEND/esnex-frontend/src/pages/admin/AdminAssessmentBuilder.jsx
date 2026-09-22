import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/axios";

const AdminAssessmentBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  // Assessment form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "global",
    courseId: "",
    subject: "",
    duration: "60",
    totalMarks: "100",
    passingScore: "50",
    visibility: true,
    status: "draft",
  });

  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [addPartModalOpen, setAddPartModalOpen] = useState(false);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [partFormData, setPartFormData] = useState({
    partName: "",
    partType: "Objective",
    duration: "60",
    totalQuestions: "0",
  });

  const [sectionsModalOpen, setSectionsModalOpen] = useState(false);
  const [currentPartIndex, setCurrentPartIndex] = useState(null);
  const [sections, setSections] = useState([]);
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [sectionFormData, setSectionFormData] = useState({
    name: "",
    questionCount: "0",
    instructions: "",
  });

  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  // Load assessment if editing
  useEffect(() => {
    if (!isNew) {
      loadAssessment();
    }
  }, [id]);

  const loadAssessment = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/assessments/${id}`);
      const assessment = res.data.assessment;
      setFormData({
        name: assessment.name || "",
        description: assessment.description || "",
        type: assessment.type || "global",
        courseId: assessment.courseId || "",
        subject: assessment.subject || "",
        duration: assessment.duration?.toString() || "60",
        totalMarks: assessment.totalMarks?.toString() || "100",
        passingScore: assessment.passingScore?.toString() || "50",
        visibility: assessment.visibility !== false,
        status: assessment.status || "draft",
      });
      setParts(assessment.parts || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Part Management
  const openAddPartModal = () => {
    setEditingPartIndex(null);
    setPartFormData({ partName: "", partType: "Objective", duration: "60", totalQuestions: "0" });
    setAddPartModalOpen(true);
  };

  const openEditPartModal = (index) => {
    setEditingPartIndex(index);
    const part = parts[index];
    setPartFormData({
      partName: part.partName || "",
      partType: part.partType || "Objective",
      duration: part.duration?.toString() || "60",
      totalQuestions: part.totalQuestions?.toString() || "0",
    });
    setAddPartModalOpen(true);
  };

  const savePart = () => {
    if (!partFormData.partName.trim()) {
      setError("Part name is required");
      return;
    }

    const newPart = {
      partName: partFormData.partName,
      partType: partFormData.partType,
      duration: parseInt(partFormData.duration) || 0,
      totalQuestions: parseInt(partFormData.totalQuestions) || 0,
      sections: editingPartIndex !== null ? parts[editingPartIndex].sections || [] : [],
    };

    if (editingPartIndex !== null) {
      const updated = [...parts];
      updated[editingPartIndex] = newPart;
      setParts(updated);
      setSuccess("Part updated successfully");
    } else {
      setParts([...parts, newPart]);
      setSuccess("Part added successfully");
    }

    setAddPartModalOpen(false);
    setError("");
  };

  const deletePart = (index) => {
    if (window.confirm("Delete this part?")) {
      setParts(parts.filter((_, i) => i !== index));
      setSuccess("Part deleted successfully");
    }
  };

  // Section Management
  const openSectionsModal = (partIndex) => {
    setCurrentPartIndex(partIndex);
    const partSections = parts[partIndex]?.sections || [];
    setSections(
      partSections.map((section) => ({
        ...section,
        questionCount: Number(section.questionCount || 0),
      }))
    );
    setEditingSectionIndex(null);
    setSectionFormData({ name: "", questionCount: "0", instructions: "" });
    setSectionsModalOpen(true);
  };

  const addSection = () => {
    if (!sectionFormData.name.trim()) {
      setError("Section name is required");
      return;
    }

    const newSection = {
      name: sectionFormData.name.trim(),
      questionCount: Number(sectionFormData.questionCount) || 0,
      instructions: sectionFormData.instructions.trim(),
    };

    setSections([...sections, newSection]);
    setSectionFormData({ name: "", questionCount: "0", instructions: "" });
    setError("");
  };

  const updateSection = (index) => {
    if (!sectionFormData.name.trim()) {
      setError("Section name is required");
      return;
    }

    const updated = [...sections];
    updated[index] = {
      name: sectionFormData.name.trim(),
      questionCount: Number(sectionFormData.questionCount) || 0,
      instructions: sectionFormData.instructions.trim(),
    };
    setSections(updated);
    setEditingSectionIndex(null);
    setSectionFormData({ name: "", questionCount: "0", instructions: "" });
    setError("");
  };

  const editSection = (index) => {
    const section = sections[index];
    setSectionFormData({
      name: section.name || "",
      questionCount: String(section.questionCount || "0"),
      instructions: section.instructions || "",
    });
    setEditingSectionIndex(index);
  };

  const deleteSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const saveSections = () => {
    if (currentPartIndex === null || currentPartIndex < 0 || currentPartIndex >= parts.length) {
      setError("Unable to save sections. Please reopen the sections editor.");
      return;
    }

    const totalSectionQuestions = sections.reduce(
      (sum, s) => sum + Number(s.questionCount || 0),
      0
    );
    const partTotalQuestions = Number(parts[currentPartIndex].totalQuestions || 0);

    if (totalSectionQuestions !== partTotalQuestions) {
      setError(`Total section questions (${totalSectionQuestions}) must equal part total (${partTotalQuestions})`);
      return;
    }

    const updated = [...parts];
    updated[currentPartIndex] = {
      ...updated[currentPartIndex],
      sections: sections.map((section) => ({
        ...section,
        questionCount: Number(section.questionCount || 0),
      })),
    };
    setParts(updated);

    setSectionsModalOpen(false);
    setCurrentPartIndex(null);
    setSections([]);
    setError("");
    setSuccess("Sections saved successfully");
  };

  const currentPart = currentPartIndex !== null && parts[currentPartIndex] ? parts[currentPartIndex] : null;
  const currentSectionTotal = sections.reduce((sum, s) => sum + Number(s.questionCount || 0), 0);
  const pendingSectionCount = Number(sectionFormData.questionCount || 0);
  const previewSectionTotal = editingSectionIndex !== null
    ? currentSectionTotal - (Number(sections[editingSectionIndex]?.questionCount || 0)) + (sectionFormData.name.trim() ? pendingSectionCount : 0)
    : currentSectionTotal + (sectionFormData.name.trim() ? pendingSectionCount : 0);
  const currentPartTotalQuestions = currentPart ? Number(currentPart.totalQuestions || 0) : 0;
  const sectionCountDifference = currentPartTotalQuestions - currentSectionTotal;
  const isSectionTotalMismatch = currentPart && currentSectionTotal !== currentPartTotalQuestions;
  const sectionCountRemainingLabel = currentPart
    ? sectionCountDifference > 0
      ? `Need ${sectionCountDifference} more question${sectionCountDifference === 1 ? '' : 's'} to match part total.`
      : sectionCountDifference < 0
      ? `Remove ${Math.abs(sectionCountDifference)} question${Math.abs(sectionCountDifference) === 1 ? '' : 's'} to match part total.`
      : 'Section questions now match the part total.'
    : '';

  // Assessment Save
  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        setError("Assessment name is required");
        setLoading(false);
        return;
      }
      if (!formData.subject.trim()) {
        setError("Subject is required");
        setLoading(false);
        return;
      }

      // Validate parts
      if (parts.length === 0) {
        setError("Add at least one part");
        setLoading(false);
        return;
      }

      // Validate each part's sections only when sections are defined
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const sections = Array.isArray(part.sections) ? part.sections : [];
        if (sections.length > 0) {
          const sectionTotal = sections.reduce((sum, s) => sum + (Number(s.questionCount) || 0), 0);
          if (sectionTotal !== Number(part.totalQuestions || 0)) {
            setError(`Part ${i + 1}: section questions (${sectionTotal}) must equal total (${part.totalQuestions})`);
            setLoading(false);
            return;
          }
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        courseId: formData.courseId || undefined,
        subject: formData.subject,
        duration: parseInt(formData.duration) || 60,
        totalMarks: parseInt(formData.totalMarks) || 100,
        passingScore: parseInt(formData.passingScore) || 50,
        visibility: formData.visibility,
        status: formData.status,
        parts,
      };

      if (isNew) {
        const res = await API.post("/assessments", payload);
        setSuccess("Assessment created successfully");
        navigate(`/admin/assessments/edit/${res.data.assessment._id}`);
      } else {
        await API.put(`/assessments/${id}`, payload);
        setSuccess("Assessment saved successfully");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save assessment");
    } finally {
      setLoading(false);
    }
  };

  const pageStyle = {
    minHeight: "100vh",
    backgroundColor: "#020617",
    color: "#e2e8f0",
    padding: "2rem",
  };

  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
  };

  const cardStyle = {
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "1rem",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "0.5rem",
    fontSize: "0.95rem",
    outline: "none",
  };

  const buttonStyle = {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "0.75rem",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.95rem",
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#475569",
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#dc2626",
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>{isNew ? "Create Assessment" : "Edit Assessment"}</h1>
          <button onClick={() => navigate("/admin/assessments")} style={secondaryButtonStyle}>
            Back
          </button>
        </div>

        {/* Messages */}
        {error && <div style={{ padding: "1rem", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "0.5rem", marginBottom: "1rem" }}>{error}</div>}
        {success && <div style={{ padding: "1rem", backgroundColor: "#064e3b", color: "#d1fae5", borderRadius: "0.5rem", marginBottom: "1rem" }}>{success}</div>}

        {/* Assessment Details Form */}
        <form onSubmit={handleSaveAssessment} style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Assessment Details</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="Assessment Name"
              value={formData.name}
              onChange={(e) => handleAssessmentChange("name", e.target.value)}
              required
            />
            <input
              style={inputStyle}
              type="text"
              placeholder="Subject"
              value={formData.subject}
              onChange={(e) => handleAssessmentChange("subject", e.target.value)}
              required
            />
          </div>

          <textarea
            style={{ ...inputStyle, minHeight: "100px", marginBottom: "1rem" }}
            placeholder="Description"
            value={formData.description}
            onChange={(e) => handleAssessmentChange("description", e.target.value)}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
            <input
              style={inputStyle}
              type="number"
              placeholder="Duration (mins)"
              value={formData.duration}
              onChange={(e) => handleAssessmentChange("duration", e.target.value)}
            />
            <input
              style={inputStyle}
              type="number"
              placeholder="Total Marks"
              value={formData.totalMarks}
              onChange={(e) => handleAssessmentChange("totalMarks", e.target.value)}
            />
            <input
              style={inputStyle}
              type="number"
              placeholder="Passing Score"
              value={formData.passingScore}
              onChange={(e) => handleAssessmentChange("passingScore", e.target.value)}
            />
            <select
              style={inputStyle}
              value={formData.status}
              onChange={(e) => handleAssessmentChange("status", e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={formData.visibility}
              onChange={(e) => handleAssessmentChange("visibility", e.target.checked)}
            />
            Visible to public
          </label>

          <button type="submit" style={{ ...buttonStyle, marginTop: "1rem" }} disabled={loading}>
            {isNew ? "Create Assessment" : "Save Assessment"}
          </button>
        </form>

        {/* Parts Section */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Assessment Parts</h2>
            <button onClick={openAddPartModal} style={buttonStyle}>
              + Add Part
            </button>
          </div>

          {parts.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>
              No parts added yet. Click "Add Part" to start.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {parts.map((part, idx) => {
                const sectionTotal = (part.sections || []).reduce(
                  (sum, s) => sum + (Number(s.questionCount) || 0),
                  0
                );
                const isValid = sectionTotal === part.totalQuestions;

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "#0f172a",
                      border: `2px solid ${isValid ? "#10b981" : "#dc2626"}`,
                      borderRadius: "0.75rem",
                      padding: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                      <div>
                        <h3 style={{ margin: "0 0 0.5rem 0" }}>{part.partName}</h3>
                        <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
                          <div>Type: {part.partType}</div>
                          <div>Duration: {part.duration} mins</div>
                          <div>Total Questions: {part.totalQuestions}</div>
                          <div>Sections: {(part.sections || []).length}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => openEditPartModal(idx)} style={buttonStyle}>
                          Edit
                        </button>
                        <button onClick={() => openSectionsModal(idx)} style={buttonStyle}>
                          Sections
                        </button>
                        <button onClick={() => deletePart(idx)} style={dangerButtonStyle}>
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Validation Status */}
                    <div style={{ fontSize: "0.875rem" }}>
                      <span style={{ color: isValid ? "#10b981" : "#dc2626" }}>
                        ✓ Sections: {sectionTotal} / {part.totalQuestions} questions
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Part Modal */}
      {addPartModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ ...cardStyle, maxWidth: "500px", width: "100%", margin: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>{editingPartIndex !== null ? "Edit Part" : "Add Part"}</h2>

            <div style={{ display: "grid", gap: "1rem" }}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Part Name (e.g., Part A)"
                value={partFormData.partName}
                onChange={(e) => setPartFormData({ ...partFormData, partName: e.target.value })}
              />

              <select
                style={inputStyle}
                value={partFormData.partType}
                onChange={(e) => setPartFormData({ ...partFormData, partType: e.target.value })}
              >
                <option value="Objective">Objective</option>
                <option value="Theory">Theory</option>
                <option value="Oral">Oral</option>
                <option value="Practical">Practical</option>
              </select>

              <input
                style={inputStyle}
                type="number"
                placeholder="Duration (minutes)"
                value={partFormData.duration}
                onChange={(e) => setPartFormData({ ...partFormData, duration: e.target.value })}
              />

              <input
                style={inputStyle}
                type="number"
                placeholder="Total Questions"
                value={partFormData.totalQuestions}
                onChange={(e) => setPartFormData({ ...partFormData, totalQuestions: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button onClick={() => setAddPartModalOpen(false)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button onClick={savePart} style={buttonStyle}>
                Save Part
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sections Modal */}
      {sectionsModalOpen && currentPartIndex !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ ...cardStyle, maxWidth: "700px", width: "100%", margin: "1rem", maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ marginTop: 0 }}>
              Manage Sections — {parts[currentPartIndex].partName} ({parts[currentPartIndex].partType})
            </h2>

            {/* Validation Info */}
            <div
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "0.5rem",
                padding: "1rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              <div>Total Questions Required: {parts[currentPartIndex].totalQuestions}</div>
              <div>Current Total: {currentSectionTotal}</div>
              {sectionFormData.name.trim() && (
                <div style={{ color: '#94a3b8' }}>
                  {editingSectionIndex !== null ? "Preview if saved:" : "Including unsaved section:"} {previewSectionTotal}
                </div>
              )}
              {isSectionTotalMismatch && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    color: "#f87171",
                    backgroundColor: "rgba(248, 113, 113, 0.12)",
                    border: "1px solid #fca5a5",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <strong>Section total mismatch:</strong> {currentSectionTotal} / {currentPartTotalQuestions}. Save Sections is disabled until these values match.
                </div>
              )}
            </div>

            {/* Sections List */}
            <div style={{ marginBottom: "1.5rem" }}>
              {sections.map((section, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {editingSectionIndex === idx ? (
                    <>
                      <input
                        style={{ ...inputStyle, marginBottom: "0.75rem" }}
                        type="text"
                        placeholder="Section Name"
                        value={sectionFormData.name}
                        onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
                      />
                      <input
                        style={{ ...inputStyle, marginBottom: "0.75rem" }}
                        type="number"
                        placeholder="Question Count"
                        value={sectionFormData.questionCount}
                        onChange={(e) => setSectionFormData({ ...sectionFormData, questionCount: e.target.value })}
                      />
                      <textarea
                        style={{ ...inputStyle, minHeight: "80px", marginBottom: "0.75rem" }}
                        placeholder="Instructions"
                        value={sectionFormData.instructions}
                        onChange={(e) => setSectionFormData({ ...sectionFormData, instructions: e.target.value })}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button type="button" onClick={() => updateSection(idx)} style={buttonStyle}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingSectionIndex(null)} style={secondaryButtonStyle}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                        <div>
                          <h4 style={{ margin: 0, marginBottom: "0.5rem" }}>{section.name}</h4>
                          <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
                            Questions: {section.questionCount}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => editSection(idx)} style={buttonStyle}>
                            Edit
                          </button>
                          <button onClick={() => deleteSection(idx)} style={dangerButtonStyle}>
                            Delete
                          </button>
                        </div>
                      </div>
                      {section.instructions && (
                        <div style={{ fontSize: "0.875rem", color: "#cbd5e1", marginTop: "0.5rem" }}>
                          {section.instructions}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Section Form */}
            {editingSectionIndex === null && (
              <div style={{ backgroundColor: "#0f172a", border: "1px dashed #334155", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
                <h4 style={{ margin: "0 0 1rem 0" }}>Add New Section</h4>
                <input
                  style={{ ...inputStyle, marginBottom: "0.75rem" }}
                  type="text"
                  placeholder="Section Name"
                  value={sectionFormData.name}
                  onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
                />
                <input
                  style={{ ...inputStyle, marginBottom: "0.75rem" }}
                  type="number"
                  placeholder="Question Count"
                  value={sectionFormData.questionCount}
                  onChange={(e) => setSectionFormData({ ...sectionFormData, questionCount: e.target.value })}
                />
                <textarea
                  style={{ ...inputStyle, minHeight: "80px", marginBottom: "0.75rem" }}
                  placeholder="Instructions"
                  value={sectionFormData.instructions}
                  onChange={(e) => setSectionFormData({ ...sectionFormData, instructions: e.target.value })}
                />
                <button type="button" onClick={addSection} style={buttonStyle}>
                  Add Section
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: isSectionTotalMismatch ? "#d32f2f" : "#333", fontWeight: 600 }}>
                {sectionCountRemainingLabel}
              </div>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setSectionsModalOpen(false)} style={secondaryButtonStyle}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSections}
                  style={{
                    ...buttonStyle,
                    opacity: isSectionTotalMismatch ? 0.5 : 1,
                    cursor: isSectionTotalMismatch ? "not-allowed" : "pointer",
                  }}
                  disabled={isSectionTotalMismatch}
                  title={
                    isSectionTotalMismatch
                      ? "Fix the section totals to match the part total before saving."
                      : "Save sections for this part"
                  }
                >
                  Save Sections
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssessmentBuilder;