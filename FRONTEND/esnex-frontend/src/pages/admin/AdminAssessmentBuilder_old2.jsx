import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/axios";

const initialFormData = {
  name: "",
  description: "",
  type: "global",
  courseId: "",
  subject: "",
  price: "0",
  subscription: "monthly",
  status: "draft",
  duration: "60",
  totalMarks: "0",
  passingScore: "50",
  visibility: true,
  antiCheat: {
    enabled: false,
    fullscreen: true,
    tabSwitchDetection: true,
    copyPasteDisabled: true,
    inspectDisabled: true,
    maxWarnings: 3,
    exitAction: "auto-submit",
  },
  markingScheme: {
    autoMark: true,
    aiTheoryMarking: false,
    markingGuide: "",
    answerFormat: "",
  },
  retakeRules: {
    allowRetake: true,
    maxAttempts: 3,
    retakeDelay: 0,
  },
};

const initialNewPart = {
  partName: "Part A",
  partType: "Objective",
  duration: "60",
  totalQuestions: "80",
  instructions: "",
};

const initialNewSection = {
  name: "",
  questionCount: "10",
  instructions: "",
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
  fontSize: "0.95rem",
  fontWeight: "600",
  transition: "background-color 150ms ease, transform 150ms ease",
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: "#475569",
};

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#020617",
  color: "#e2e8f0",
  padding: "2rem",
};

const panelCardStyle = {
  backgroundColor: "#111827",
  border: "1px solid #334155",
  borderRadius: "1rem",
  padding: "1.5rem",
  display: "grid",
  gap: "1rem",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.35)",
};

const sectionCardStyle = {
  padding: "1rem",
  borderRadius: "1rem",
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
};

const infoBoxStyle = {
  padding: "1rem",
  borderRadius: "1rem",
  backgroundColor: "#0b1220",
  border: "1px solid #334155",
};

const AdminAssessmentBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [formData, setFormData] = useState(initialFormData);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [currentPartIndex, setCurrentPartIndex] = useState(null);
  const [expandedParts, setExpandedParts] = useState(new Set());

  useEffect(() => {
    if (!isNew) {
      loadAssessment();
    }
  }, [id]);

  const normalizeAssessment = (assessment) => ({
    name: assessment.name || "",
    description: assessment.description || "",
    type: assessment.type || "global",
    courseId: assessment.courseId || "",
    subject: assessment.subject || "",
    price: assessment.price?.toString() || "0",
    subscription: assessment.subscription || "monthly",
    status: assessment.status || "draft",
    duration: assessment.duration?.toString() || "60",
    totalMarks: assessment.totalMarks?.toString() || "0",
    passingScore: assessment.passingScore?.toString() || "50",
    visibility: assessment.visibility !== false,
    antiCheat: {
      enabled: assessment.antiCheat?.enabled || false,
      fullscreen: assessment.antiCheat?.fullscreen ?? true,
      tabSwitchDetection: assessment.antiCheat?.tabSwitchDetection ?? true,
      copyPasteDisabled: assessment.antiCheat?.copyPasteDisabled ?? true,
      inspectDisabled: assessment.antiCheat?.inspectDisabled ?? true,
      maxWarnings: assessment.antiCheat?.maxWarnings ?? 3,
      exitAction: assessment.antiCheat?.exitAction || "auto-submit",
    },
    markingScheme: {
      autoMark: assessment.markingScheme?.autoMark ?? true,
      aiTheoryMarking: assessment.markingScheme?.aiTheoryMarking ?? false,
      markingGuide: assessment.markingScheme?.markingGuide || "",
      answerFormat: assessment.markingScheme?.answerFormat || "",
    },
    retakeRules: {
      allowRetake: assessment.retakeRules?.allowRetake ?? true,
      maxAttempts: assessment.retakeRules?.maxAttempts ?? 3,
      retakeDelay: assessment.retakeRules?.retakeDelay ?? 0,
    },
  });

  const loadAssessment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get(`/assessments/${id}`);
      const assessment = res.data.assessment;
      setFormData(normalizeAssessment(assessment));
      setParts(assessment.parts || []);
      setSuccess("");
    } catch (err) {
      console.error(err);
      setError("Unable to load assessment data.");
    } finally {
      setLoading(false);
    }
  };

  const clearNotice = () => {
    setError("");
    setSuccess("");
  };

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleNestedChange = (group, field, value) => {
    setFormData((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [field]: value,
      },
    }));
  };

  const calculateTotalMarks = (currentParts) => {
    return currentParts.reduce((sum, part) => sum + (Number(part.totalMarks) || 0), 0);
  };

  const calculateTotalQuestions = (currentParts) => {
    return currentParts.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0);
  };

  const validateSectionQuestions = (partIndex) => {
    const part = parts[partIndex];
    if (!part) return { valid: true };
    const sectionTotal = (part.sections || []).reduce(
      (sum, section) => sum + (Number(section.questionCount) || 0),
      0
    );
    const partTotal = Number(part.totalQuestions) || 0;
    if (sectionTotal !== partTotal) {
      return {
        valid: false,
        message: `Section questions (${sectionTotal}) must equal part total (${partTotal})`,
      };
    }
    return { valid: true };
  };

  const handleSaveAssessment = async (event) => {
    event.preventDefault();
    clearNotice();
    setLoading(true);

    try {
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const validation = validateSectionQuestions(partIndex);
        if (!validation.valid) {
          setError(validation.message);
          setLoading(false);
          return;
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        courseId: formData.courseId || undefined,
        subject: formData.subject,
        price: parseFloat(formData.price) || 0,
        subscription: formData.subscription,
        status: formData.status,
        duration: parseInt(formData.duration, 10) || 60,
        totalMarks: parseInt(formData.totalMarks, 10) || calculateTotalMarks(parts),
        totalQuestions: calculateTotalQuestions(parts),
        passingScore: parseInt(formData.passingScore, 10) || 50,
        visibility: Boolean(formData.visibility),
        antiCheat: {
          enabled: Boolean(formData.antiCheat.enabled),
          fullscreen: Boolean(formData.antiCheat.fullscreen),
          tabSwitchDetection: Boolean(formData.antiCheat.tabSwitchDetection),
          copyPasteDisabled: Boolean(formData.antiCheat.copyPasteDisabled),
          inspectDisabled: Boolean(formData.antiCheat.inspectDisabled),
          maxWarnings: parseInt(formData.antiCheat.maxWarnings, 10) || 3,
          exitAction: formData.antiCheat.exitAction || "auto-submit",
        },
        markingScheme: {
          autoMark: Boolean(formData.markingScheme.autoMark),
          aiTheoryMarking: Boolean(formData.markingScheme.aiTheoryMarking),
          markingGuide: formData.markingScheme.markingGuide,
          answerFormat: formData.markingScheme.answerFormat,
        },
        retakeRules: {
          allowRetake: Boolean(formData.retakeRules.allowRetake),
          maxAttempts: parseInt(formData.retakeRules.maxAttempts, 10) || 3,
          retakeDelay: parseInt(formData.retakeRules.retakeDelay, 10) || 0,
        },
        parts: parts,
      };

      if (isNew) {
        const res = await API.post("/assessments", payload);
        const created = res.data.assessment;
        setSuccess("Assessment created successfully.");
        navigate(`/admin/assessments/edit/${created._id}`);
      } else {
        const res = await API.put(`/assessments/${id}`, payload);
        setSuccess("Assessment saved successfully.");
        if (res.data.assessment) {
          setFormData(normalizeAssessment(res.data.assessment));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to save assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePart = async () => {
    clearNotice();

    if (!editingPart.partName.trim()) {
      setError("Please enter a part name.");
      return;
    }

    const partData = {
      partName: editingPart.partName,
      partType: editingPart.partType,
      duration: parseInt(editingPart.duration, 10) || 60,
      totalQuestions: parseInt(editingPart.totalQuestions, 10) || 0,
      instructions: editingPart.instructions || "",
      sections: [],
    };

    if (!id) {
      const updatedParts = [...parts, partData];
      setParts(updatedParts);
      setPartModalOpen(false);
      setEditingPart(null);
      setSuccess("Part added locally. Save the assessment to persist it.");
      return;
    }

    try {
      const res = await API.post(`/assessments/${id}/parts`, partData);
      const part = res.data.part;
      const updatedParts = [...parts, part];
      setParts(updatedParts);
      setPartModalOpen(false);
      setEditingPart(null);
      setSuccess("Part added successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to create part.");
    }
  };

  const handleUpdatePart = async (partIndex) => {
    clearNotice();
    const part = parts[partIndex];
    if (!part) return;

    if (!id) {
      const updated = [...parts];
      updated[partIndex] = { ...part };
      setParts(updated);
      setSuccess("Part updated locally. Save the assessment to persist it.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updated).toString() }));
      return;
    }

    try {
      const res = await API.put(`/assessments/${id}/parts/${partIndex}`, {
        partName: part.partName,
        partType: part.partType,
        duration: parseInt(part.duration, 10) || 60,
        totalQuestions: parseInt(part.totalQuestions, 10) || 0,
        instructions: part.instructions || "",
        sections: part.sections || [],
      });
      const updated = [...parts];
      updated[partIndex] = res.data.part;
      setParts(updated);
      setSuccess("Part updated successfully.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updated).toString() }));
    } catch (err) {
      console.error(err);
      setError("Unable to update part.");
    }
  };

  const handleDeletePart = async (partIndex) => {
    clearNotice();

    if (!id) {
      const updatedParts = parts.filter((_, index) => index !== partIndex);
      setParts(updatedParts);
      setSuccess("Part removed locally. Save the assessment to persist changes.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updatedParts).toString() }));
      return;
    }

    try {
      await API.delete(`/assessments/${id}/parts/${partIndex}`);
      const updatedParts = parts.filter((_, index) => index !== partIndex);
      setParts(updatedParts);
      setSuccess("Part deleted successfully.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updatedParts).toString() }));
    } catch (err) {
      console.error(err);
      setError("Unable to delete part.");
    }
  };

  const handleAddSection = async (partIndex) => {
    clearNotice();

    const sectionName = editingSection.name.trim() || String.fromCharCode(65 + (parts[partIndex]?.sections?.length || 0));
    const questionCount = parseInt(editingSection.questionCount, 10) || 0;

    if (!sectionName) {
      setError("Enter a section name.");
      return;
    }

    if (questionCount <= 0) {
      setError("Section question count must be greater than zero.");
      return;
    }

    const part = parts[partIndex];
    const currentTotal = (part.sections || []).reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
    if (currentTotal + questionCount > Number(part.totalQuestions || 0)) {
      setError(`Adding this section would exceed ${part.partName} total questions.`);
      return;
    }

    const sectionData = {
      name: sectionName,
      questionCount,
      instructions: editingSection.instructions,
    };

    if (!id) {
      const updatedParts = [...parts];
      const existingSections = updatedParts[partIndex].sections || [];
      updatedParts[partIndex].sections = [...existingSections, sectionData];
      setParts(updatedParts);
      setSectionModalOpen(false);
      setEditingSection(null);
      setCurrentPartIndex(null);
      setSuccess("Section added locally. Save the assessment to persist it.");
      return;
    }

    try {
      const res = await API.post(`/assessments/${id}/parts/${partIndex}/sections`, sectionData);
      const updatedParts = [...parts];
      updatedParts[partIndex].sections = [...(updatedParts[partIndex].sections || []), res.data.section];
      setParts(updatedParts);
      setSectionModalOpen(false);
      setEditingSection(null);
      setCurrentPartIndex(null);
      setSuccess("Section added successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to add section.");
    }
  };

  const handleDeleteSection = async (partIndex, sectionIndex) => {
    clearNotice();

    if (!id) {
      const updatedParts = [...parts];
      updatedParts[partIndex].sections = updatedParts[partIndex].sections.filter((_, index) => index !== sectionIndex);
      setParts(updatedParts);
      setSuccess("Section removed locally. Save the assessment to persist changes.");
      return;
    }

    try {
      await API.delete(`/assessments/${id}/parts/${partIndex}/sections/${sectionIndex}`);
      const updatedParts = [...parts];
      updatedParts[partIndex].sections = updatedParts[partIndex].sections.filter((_, index) => index !== sectionIndex);
      setParts(updatedParts);
      setSuccess("Section deleted successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to delete section.");
    }
  };

  const handleSaveSection = async (partIndex, sectionIndex) => {
    clearNotice();
    const section = parts[partIndex]?.sections?.[sectionIndex];
    if (!section) return;

    const updatedSection = {
      name: section.name,
      questionCount: parseInt(section.questionCount, 10) || 0,
      instructions: section.instructions || "",
    };

    if (!updatedSection.name.trim()) {
      setError("Section name cannot be empty.");
      return;
    }

    if (updatedSection.questionCount <= 0) {
      setError("Section question count must be greater than zero.");
      return;
    }

    const part = parts[partIndex];
    const otherSectionTotal = (part.sections || []).reduce(
      (sum, sec, idx) => (idx === sectionIndex ? sum : sum + (Number(sec.questionCount) || 0)),
      0
    );
    if (otherSectionTotal + updatedSection.questionCount > Number(part.totalQuestions || 0)) {
      setError(`Section counts cannot exceed ${part.partName} total questions.`);
      return;
    }

    if (!id) {
      const updatedParts = [...parts];
      updatedParts[partIndex].sections[sectionIndex] = { ...updatedParts[partIndex].sections[sectionIndex], ...updatedSection };
      setParts(updatedParts);
      setSuccess("Section updated locally. Save the assessment to persist changes.");
      return;
    }

    try {
      const res = await API.put(`/assessments/${id}/parts/${partIndex}/sections/${sectionIndex}`, updatedSection);
      const updatedParts = [...parts];
      updatedParts[partIndex].sections[sectionIndex] = res.data.section;
      setParts(updatedParts);
      setSuccess("Section saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to save section.");
    }
  };

  const togglePartExpansion = (partIndex) => {
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(partIndex)) {
      newExpanded.delete(partIndex);
    } else {
      newExpanded.add(partIndex);
    }
    setExpandedParts(newExpanded);
  };

  const openPartModal = (partIndex = null) => {
    setEditingPart(partIndex !== null ? { ...parts[partIndex] } : initialNewPart);
    setPartModalOpen(true);
  };

  const openSectionModal = (partIndex, sectionIndex = null) => {
    setCurrentPartIndex(partIndex);
    setEditingSection(sectionIndex !== null ? { ...parts[partIndex].sections[sectionIndex] } : initialNewSection);
    setSectionModalOpen(true);
  };

  const savePart = () => {
    if (editingPart.partName.trim()) {
      if (editingPart._id) {
        handleUpdatePart(editingPart._id);
      } else {
        handleCreatePart();
      }
      setPartModalOpen(false);
      setEditingPart(null);
    }
  };

  const saveSection = () => {
    if (editingSection.name.trim()) {
      if (editingSection._id) {
        handleSaveSection(currentPartIndex, editingSection._id);
      } else {
        handleAddSection(currentPartIndex);
      }
      setSectionModalOpen(false);
      setEditingSection(null);
      setCurrentPartIndex(null);
    }
  };

  const getPartTypeColor = (type) => {
    switch (type) {
      case 'Objective': return '#10b981';
      case 'Theory': return '#8b5cf6';
      case 'Oral': return '#f97316';
      case 'Practical': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", letterSpacing: "0.02em", fontSize: "2rem" }}>{isNew ? "Build a new assessment" : `Edit assessment: ${formData.name}`}</h1>
            <p style={{ margin: 0, color: "#94a3b8", maxWidth: "720px" }}>Create a hierarchical assessment structure with parts and sections.</p>
          </div>
          <button onClick={() => navigate("/admin/assessments")} style={{ ...secondaryButtonStyle }}>
            Back to Assessments
          </button>
        </div>

        {(error || success) && (
          <div style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem", backgroundColor: error ? "#7f1d1d" : "#064e3b", color: error ? "#fca5a5" : "#d1fae5", fontWeight: 500 }}>
            {error || success}
          </div>
        )}

        <form onSubmit={handleSaveAssessment} style={panelCardStyle}>
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <input
              style={inputStyle}
              placeholder="Assessment name"
              value={formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              required
            />
            <input
              style={inputStyle}
              placeholder="Subject"
              value={formData.subject}
              onChange={(e) => handleFieldChange("subject", e.target.value)}
              required
            />
            <select style={inputStyle} value={formData.status} onChange={(e) => handleFieldChange("status", e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <select style={inputStyle} value={formData.subscription} onChange={(e) => handleFieldChange("subscription", e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: "100px" }}
            placeholder="Description"
            value={formData.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
          />
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <input
              style={inputStyle}
              placeholder="Duration (minutes)"
              type="number"
              value={formData.duration}
              onChange={(e) => handleFieldChange("duration", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Passing score"
              type="number"
              value={formData.passingScore}
              onChange={(e) => handleFieldChange("passingScore", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Total marks"
              type="number"
              value={formData.totalMarks}
              onChange={(e) => handleFieldChange("totalMarks", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => handleFieldChange("price", e.target.value)}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={formData.visibility} onChange={(e) => handleFieldChange("visibility", e.target.checked)} />
            Visible to public
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => navigate("/admin/assessments")} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>
              Cancel
            </button>
            <button type="submit" style={buttonStyle} disabled={loading}>
              {isNew ? "Create assessment" : "Save assessment"}
            </button>
          </div>
        </form>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Assessment Parts</h2>
            <button type="button" onClick={() => openPartModal()} style={buttonStyle}>
              + Add Part
            </button>
          </div>

          {parts.length === 0 ? (
            <div style={{ ...infoBoxStyle, padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
              <h3 style={{ margin: 0 }}>No parts added yet</h3>
              <p style={{ margin: "1rem 0 0" }}>Click "Add Part" to start building your assessment structure.</p>
            </div>
          ) : (
            parts.map((part, partIndex) => {
              const isExpanded = expandedParts.has(partIndex);
              const sectionTotal = (part.sections || []).reduce((sum, s) => sum + (Number(s.questionCount) || 0), 0);
              const isValid = sectionTotal === Number(part.totalQuestions);

              return (
                <div key={partIndex} style={{
                  backgroundColor: "#111827",
                  border: "1px solid #334155",
                  borderRadius: "1rem",
                  padding: "1.5rem",
                  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.35)",
                  display: "grid",
                  gap: "1rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "3rem",
                        height: "3rem",
                        borderRadius: "999px",
                        backgroundColor: getPartTypeColor(part.partType),
                        color: "white",
                        fontWeight: 700,
                        fontSize: "1.25rem"
                      }}>
                        {String.fromCharCode(65 + partIndex)}
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.5rem" }}>{part.partName}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "999px",
                            backgroundColor: getPartTypeColor(part.partType),
                            color: "white",
                            fontSize: "0.875rem",
                            fontWeight: 600
                          }}>
                            {part.partType}
                          </span>
                          <span style={{ color: "#94a3b8" }}>{part.duration} mins</span>
                          <span style={{ color: "#94a3b8" }}>{part.totalQuestions} questions</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => togglePartExpansion(partIndex)} style={{ ...secondaryButtonStyle, padding: "0.5rem 1rem" }}>
                        {isExpanded ? "Collapse" : "Expand"}
                      </button>
                      <button type="button" onClick={() => openPartModal(partIndex)} style={{ ...buttonStyle, backgroundColor: "#10b981", padding: "0.5rem 1rem" }}>
                        Edit Part
                      </button>
                      <button type="button" onClick={() => handleDeletePart(partIndex)} style={{ ...buttonStyle, backgroundColor: "#ef4444", padding: "0.5rem 1rem" }}>
                        Delete Part
                      </button>
                    </div>
                  </div>

                  {part.instructions && (
                    <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                      <p style={{ margin: 0, color: "#cbd5e1" }}><strong>Instructions:</strong> {part.instructions}</p>
                    </div>
                  )}

                  {isExpanded && (
                    <div style={{ display: "grid", gap: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <h4 style={{ margin: 0 }}>Sections</h4>
                        <button type="button" onClick={() => openSectionModal(partIndex)} style={buttonStyle}>
                          + Add Section
                        </button>
                      </div>

                      {(part.sections || []).length === 0 ? (
                        <div style={{ ...infoBoxStyle, padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                          <p style={{ margin: 0 }}>No sections added yet. Click "Add Section" to create sections for this part.</p>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "0.75rem" }}>
                          {(part.sections || []).map((section, sectionIndex) => (
                            <div key={sectionIndex} style={sectionCardStyle}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                                <div>
                                  <h5 style={{ margin: 0 }}>{section.name || `Section ${String.fromCharCode(65 + sectionIndex)}`}</h5>
                                  <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>{section.questionCount} questions</p>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <button type="button" onClick={() => openSectionModal(partIndex, sectionIndex)} style={{ ...buttonStyle, backgroundColor: "#10b981", padding: "0.5rem 0.85rem" }}>
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => handleDeleteSection(partIndex, sectionIndex)} style={{ ...buttonStyle, backgroundColor: "#dc2626", padding: "0.5rem 0.85rem" }}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {section.instructions && (
                                <p style={{ margin: "1rem 0 0", color: "#cbd5e1" }}><strong>Instructions:</strong> {section.instructions}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                        <span style={{ color: "#94a3b8" }}>Total Questions in Sections</span>
                        <span style={{ fontWeight: 700, color: isValid ? "#22c55e" : "#f97316" }}>
                          {sectionTotal} / {part.totalQuestions}
                        </span>
                      </div>
                      {!isValid && (
                        <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#7f1d1d", color: "#fca5a5" }}>
                          Section question total must equal part total questions.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Part Modal */}
        {partModalOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: "#111827",
              border: "1px solid #334155",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              margin: "1rem"
            }}>
              <h3 style={{ margin: "0 0 1.5rem 0" }}>{editingPart._id ? "Edit Part" : "Add New Part"}</h3>
              <div style={{ display: "grid", gap: "1rem" }}>
                <input
                  style={inputStyle}
                  placeholder="Part Name"
                  value={editingPart.partName}
                  onChange={(e) => setEditingPart({ ...editingPart, partName: e.target.value })}
                />
                <select
                  style={inputStyle}
                  value={editingPart.partType}
                  onChange={(e) => setEditingPart({ ...editingPart, partType: e.target.value })}
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
                  value={editingPart.duration}
                  onChange={(e) => setEditingPart({ ...editingPart, duration: e.target.value })}
                />
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="Total Questions"
                  value={editingPart.totalQuestions}
                  onChange={(e) => setEditingPart({ ...editingPart, totalQuestions: e.target.value })}
                />
                <textarea
                  style={{ ...inputStyle, minHeight: "100px" }}
                  placeholder="Part instructions"
                  value={editingPart.instructions}
                  onChange={(e) => setEditingPart({ ...editingPart, instructions: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" onClick={() => setPartModalOpen(false)} style={secondaryButtonStyle}>
                  Cancel
                </button>
                <button type="button" onClick={savePart} style={buttonStyle}>
                  Save Part
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Modal */}
        {sectionModalOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: "#111827",
              border: "1px solid #334155",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              margin: "1rem"
            }}>
              <h3 style={{ margin: "0 0 1.5rem 0" }}>{editingSection._id ? "Edit Section" : "Add New Section"}</h3>
              <div style={{ display: "grid", gap: "1rem" }}>
                <input
                  style={inputStyle}
                  placeholder="Section Name"
                  value={editingSection.name}
                  onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                />
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="Question Count"
                  value={editingSection.questionCount}
                  onChange={(e) => setEditingSection({ ...editingSection, questionCount: e.target.value })}
                />
                <textarea
                  style={{ ...inputStyle, minHeight: "100px" }}
                  placeholder="Section instructions"
                  value={editingSection.instructions}
                  onChange={(e) => setEditingSection({ ...editingSection, instructions: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" onClick={() => setSectionModalOpen(false)} style={secondaryButtonStyle}>
                  Cancel
                </button>
                <button type="button" onClick={saveSection} style={buttonStyle}>
                  Save Section
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAssessmentBuilder;