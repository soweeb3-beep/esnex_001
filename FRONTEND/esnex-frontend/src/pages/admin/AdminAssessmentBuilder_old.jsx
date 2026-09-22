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
  sections: [],
};

const initialNewSection = {
  name: "",
  questionCount: "10",
  bankPath: "",
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

const sectionPanelStyle = {
  backgroundColor: "#111827",
  border: "1px solid #334155",
  borderRadius: "1rem",
  padding: "1.5rem",
  display: "grid",
  gap: "1.5rem",
  gridTemplateColumns: "minmax(300px, 1fr) minmax(520px, 2fr)",
};

const partCardStyle = {
  width: "100%",
  textAlign: "left",
  borderRadius: "1rem",
  padding: "1rem",
  cursor: "pointer",
  color: "#e2e8f0",
  border: "1px solid #334155",
  backgroundColor: "#111827",
  transition: "transform 150ms ease, border 150ms ease, background-color 150ms ease",
};

const selectedPartCardStyle = {
  ...partCardStyle,
  border: "2px solid #2563eb",
  backgroundColor: "#0f172a",
  boxShadow: "0 18px 40px rgba(37, 99, 235, 0.18)",
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
  const [selectedPartIdx, setSelectedPartIdx] = useState(null);
  const [sectionFormVisible, setSectionFormVisible] = useState(false);
  const [newPartForm, setNewPartForm] = useState(initialNewPart);
  const [newSectionForm, setNewSectionForm] = useState(initialNewSection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nextPartLabel, setNextPartLabel] = useState("Part A");

  useEffect(() => {
    if (!isNew) {
      loadAssessment();
    }
  }, [id]);

  useEffect(() => {
    setNextPartLabel("Part " + String.fromCharCode(65 + parts.length));
  }, [parts.length]);

  useEffect(() => {
    if (parts.length > 0 && selectedPartIdx === null) {
      setSelectedPartIdx(0);
    }
  }, [parts, selectedPartIdx]);

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

    if (!newPartForm.partName.trim()) {
      setError("Please enter a part name.");
      return;
    }

    const partData = {
      partName: newPartForm.partName,
      partType: newPartForm.partType,
      duration: parseInt(newPartForm.duration, 10) || 60,
      totalQuestions: parseInt(newPartForm.totalQuestions, 10) || 0,
      instructions: newPartForm.instructions || "",
      sections: [],
    };

    if (!id) {
      const updatedParts = [...parts, partData];
      setParts(updatedParts);
      setSelectedPartIdx(updatedParts.length - 1);
      setSectionFormVisible(false);
      setNewPartForm({ partName: `Part ${String.fromCharCode(65 + updatedParts.length)}`, partType: "Objective", duration: "60", totalQuestions: "80", instructions: "" });
      setSuccess("Part added locally. Save the assessment to persist it.");
      return;
    }

    try {
      const res = await API.post(`/assessments/${id}/parts`, partData);
      const part = res.data.part;
      const updatedParts = [...parts, part];
      setParts(updatedParts);
      setSelectedPartIdx(updatedParts.length - 1);
      setSectionFormVisible(false);
      setNewPartForm({ partName: `Part ${String.fromCharCode(65 + updatedParts.length)}`, partType: "Objective", duration: "60", totalQuestions: "80", instructions: "" });
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
      const newIndex = updatedParts.length === 0 ? null : Math.min(partIndex, updatedParts.length - 1);
      setSelectedPartIdx(newIndex);
      setSectionFormVisible(false);
      setSuccess("Part removed locally. Save the assessment to persist changes.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updatedParts).toString() }));
      return;
    }

    try {
      await API.delete(`/assessments/${id}/parts/${partIndex}`);
      const updatedParts = parts.filter((_, index) => index !== partIndex);
      setParts(updatedParts);
      const newIndex = updatedParts.length === 0 ? null : Math.min(partIndex, updatedParts.length - 1);
      setSelectedPartIdx(newIndex);
      setSectionFormVisible(false);
      setSuccess("Part deleted successfully.");
      setFormData((current) => ({ ...current, totalMarks: calculateTotalMarks(updatedParts).toString() }));
    } catch (err) {
      console.error(err);
      setError("Unable to delete part.");
    }
  };

  const handleAddSection = async (partIndex) => {
    clearNotice();

    const sectionName = newSectionForm.name.trim() || String.fromCharCode(65 + (parts[partIndex]?.sections?.length || 0));
    const questionCount = parseInt(newSectionForm.questionCount, 10) || 0;

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
      bankPath: newSectionForm.bankPath,
      instructions: newSectionForm.instructions,
    };

    if (!id) {
      const updatedParts = [...parts];
      const existingSections = updatedParts[partIndex].sections || [];
      updatedParts[partIndex].sections = [...existingSections, sectionData];
      setParts(updatedParts);
      setNewSectionForm(initialNewSection);
      setSuccess("Section added locally. Save the assessment to persist it.");
      return;
    }

    try {
      const res = await API.post(`/assessments/${id}/parts/${partIndex}/sections`, sectionData);
      const updatedParts = [...parts];
      updatedParts[partIndex].sections = [...(updatedParts[partIndex].sections || []), res.data.section];
      setParts(updatedParts);
      setNewSectionForm(initialNewSection);
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
      bankPath: section.bankPath || "",
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

  const handlePartFieldChange = (partIndex, field, value) => {
    const updated = parts.map((part, idx) => (idx === partIndex ? { ...part, [field]: value } : part));
    setParts(updated);
  };

  const handleSectionFieldChange = (partIndex, sectionIndex, field, value) => {
    const updated = parts.map((part, idx) => {
      if (idx !== partIndex) return part;
      const updatedSections = part.sections?.map((section, sIdx) =>
        sIdx === sectionIndex ? { ...section, [field]: value } : section
      ) || [];
      return { ...part, sections: updatedSections };
    });
    setParts(updated);
  };

  const selectedPart = parts[selectedPartIdx]
    ? { ...parts[selectedPartIdx], sections: parts[selectedPartIdx].sections || [] }
    : null;
  const selectedPartSectionTotal = selectedPart?.sections?.reduce(
    (sum, section) => sum + (Number(section.questionCount) || 0),
    0
  ) || 0;
  const selectedPartTotalQuestions = Number(selectedPart?.totalQuestions || 0);

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", letterSpacing: "0.02em", fontSize: "2rem" }}>{isNew ? "Build a new assessment" : `Edit assessment: ${formData.name}`}</h1>
            <p style={{ margin: 0, color: "#94a3b8", maxWidth: "720px" }}>Use this page to configure metadata, parts, sections, pricing, and security settings for the assessment.</p>
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

        <div style={sectionPanelStyle}>
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>Assessment Parts</h2>
                <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>Build your assessment hierarchy by adding parts first, then sections inside each part.</p>
              </div>
              <button type="button" onClick={handleCreatePart} style={{ ...buttonStyle, alignSelf: "center" }}>
                + Add Part
              </button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <input
                style={inputStyle}
                placeholder="Part Name"
                value={newPartForm.partName}
                onChange={(e) => setNewPartForm({ ...newPartForm, partName: e.target.value })}
              />
              <select style={inputStyle} value={newPartForm.partType} onChange={(e) => setNewPartForm({ ...newPartForm, partType: e.target.value })}>
                <option value="Objective">Objective</option>
                <option value="Theory">Theory</option>
                <option value="Oral">Oral</option>
                <option value="Practical">Practical</option>
              </select>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <input
                  style={inputStyle}
                  placeholder="Duration (minutes)"
                  type="number"
                  value={newPartForm.duration}
                  onChange={(e) => setNewPartForm({ ...newPartForm, duration: e.target.value })}
                />
                <input
                  style={inputStyle}
                  placeholder="Total Questions"
                  type="number"
                  value={newPartForm.totalQuestions}
                  onChange={(e) => setNewPartForm({ ...newPartForm, totalQuestions: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {parts.length === 0 ? (
                <p style={{ margin: 0, color: "#cbd5e1" }}>No parts defined yet. Add a part to start building the assessment.</p>
              ) : (
                parts.map((part, partIdx) => (
                  <button
                    key={partIdx}
                    type="button"
                    onClick={() => {
                      setSelectedPartIdx(partIdx);
                      setSectionFormVisible(false);
                    }}
                    style={selectedPartIdx === partIdx ? selectedPartCardStyle : partCardStyle}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2rem", height: "2rem", borderRadius: "999px", backgroundColor: "#2563eb", color: "white", fontWeight: 700 }}>
                        {String.fromCharCode(65 + partIdx)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#f8fafc" }}>{part.partName}</div>
                        <div style={{ color: "#94a3b8", fontSize: "0.95rem" }}>{part.partType}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ color: "#cbd5e1" }}>{part.duration} mins</span>
                      <span style={{ color: "#cbd5e1" }}>{part.totalQuestions} questions</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div style={infoBoxStyle}>
              <p style={{ margin: 0, color: "#cbd5e1" }}><strong>Validation:</strong> Total questions in all sections must equal the total questions for each part.</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {selectedPart ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.25rem", height: "2.25rem", borderRadius: "999px", backgroundColor: "#2563eb", color: "white", fontWeight: 700 }}>
                        {String.fromCharCode(65 + selectedPartIdx)}
                      </span>
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedPart.partName} — {selectedPart.partType}</h3>
                        <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>Part details and sections for this part.</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => handleUpdatePart(selectedPartIdx)} style={{ ...buttonStyle, backgroundColor: "#10b981" }}>
                      Save part
                    </button>
                    <button type="button" onClick={() => handleDeletePart(selectedPartIdx)} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>
                      Delete part
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                    <p style={{ margin: 0, color: "#94a3b8" }}>Duration</p>
                    <p style={{ margin: "0.5rem 0 0", fontWeight: 700 }}>{selectedPart.duration} mins</p>
                  </div>
                  <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                    <p style={{ margin: 0, color: "#94a3b8" }}>Total Questions</p>
                    <p style={{ margin: "0.5rem 0 0", fontWeight: 700 }}>{selectedPart.totalQuestions}</p>
                  </div>
                  <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                    <p style={{ margin: 0, color: "#94a3b8" }}>Sections</p>
                    <p style={{ margin: "0.5rem 0 0", fontWeight: 700 }}>{selectedPart.sections?.length || 0} section(s)</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <input style={inputStyle} value={selectedPart.partName} onChange={(e) => handlePartFieldChange(selectedPartIdx, "partName", e.target.value)} placeholder="Part name" />
                    <select style={inputStyle} value={selectedPart.partType} onChange={(e) => handlePartFieldChange(selectedPartIdx, "partType", e.target.value)}>
                      <option value="Objective">Objective</option>
                      <option value="Theory">Theory</option>
                      <option value="Oral">Oral</option>
                      <option value="Practical">Practical</option>
                    </select>
                    <input style={inputStyle} type="number" value={selectedPart.duration} onChange={(e) => handlePartFieldChange(selectedPartIdx, "duration", e.target.value)} placeholder="Duration" />
                    <input style={inputStyle} type="number" value={selectedPart.totalQuestions} onChange={(e) => handlePartFieldChange(selectedPartIdx, "totalQuestions", e.target.value)} placeholder="Total questions" />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Sections in this part</h4>
                    <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>Add and configure sections under the selected part.</p>
                  </div>
                  <button type="button" onClick={() => setSectionFormVisible((visible) => !visible)} style={{ ...buttonStyle, backgroundColor: "#1d4ed8" }}>
                    {sectionFormVisible ? "Hide section form" : "+ Add Section"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {selectedPart.sections && selectedPart.sections.length > 0 ? (
                    selectedPart.sections.map((section, sectionIdx) => (
                      <div key={sectionIdx} style={sectionCardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                          <div>
                            <h4 style={{ margin: 0 }}>{section.name || `Section ${String.fromCharCode(65 + sectionIdx)}`}</h4>
                            <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>Questions: {section.questionCount}</p>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => handleSaveSection(selectedPartIdx, sectionIdx)} style={{ ...buttonStyle, backgroundColor: "#10b981", padding: "0.5rem 0.85rem" }}>
                              Save
                            </button>
                            <button type="button" onClick={() => handleDeleteSection(selectedPartIdx, sectionIdx)} style={{ ...buttonStyle, backgroundColor: "#dc2626", padding: "0.5rem 0.85rem" }}>
                              Delete
                            </button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: "0.75rem" }}>
                          <input style={inputStyle} value={section.name} onChange={(e) => handleSectionFieldChange(selectedPartIdx, sectionIdx, "name", e.target.value)} placeholder="Section name" />
                          <input style={inputStyle} type="number" value={section.questionCount} onChange={(e) => handleSectionFieldChange(selectedPartIdx, sectionIdx, "questionCount", e.target.value)} placeholder="Questions count" />
                          <input style={inputStyle} value={section.bankPath} onChange={(e) => handleSectionFieldChange(selectedPartIdx, sectionIdx, "bankPath", e.target.value)} placeholder="Bank path" />
                        </div>
                        <textarea style={{ ...inputStyle, minHeight: "80px" }} value={section.instructions || ""} onChange={(e) => handleSectionFieldChange(selectedPartIdx, sectionIdx, "instructions", e.target.value)} placeholder="Section instructions" />
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#94a3b8" }}>No sections defined yet.</p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <span style={{ color: "#94a3b8" }}>Total Questions in Sections</span>
                    <span style={{ fontWeight: 700, color: selectedPartSectionTotal === selectedPartTotalQuestions ? "#22c55e" : "#f97316" }}>
                      {selectedPartSectionTotal} / {selectedPartTotalQuestions}
                    </span>
                  </div>
                </div>

                {sectionFormVisible && (
                  <div style={{ ...sectionCardStyle, borderStyle: "dashed", backgroundColor: "#0b1220" }}>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                      <input
                        style={inputStyle}
                        placeholder={`Section ${String.fromCharCode(65 + (selectedPart.sections?.length || 0))}`}
                        value={newSectionForm.name}
                        onChange={(e) => setNewSectionForm({ ...newSectionForm, name: e.target.value })}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        placeholder="Questions"
                        value={newSectionForm.questionCount}
                        onChange={(e) => setNewSectionForm({ ...newSectionForm, questionCount: e.target.value })}
                      />
                      <input
                        style={inputStyle}
                        placeholder="Bank path"
                        value={newSectionForm.bankPath}
                        onChange={(e) => setNewSectionForm({ ...newSectionForm, bankPath: e.target.value })}
                      />
                    </div>
                    <textarea
                      style={{ ...inputStyle, minHeight: "96px", marginTop: "0.75rem" }}
                      placeholder="Section instructions"
                      value={newSectionForm.instructions}
                      onChange={(e) => setNewSectionForm({ ...newSectionForm, instructions: e.target.value })}
                    />
                    <button type="button" onClick={() => handleAddSection(selectedPartIdx)} style={{ ...buttonStyle, marginTop: "0.75rem" }}>
                      Add section
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...infoBoxStyle, padding: "2rem", borderStyle: "dashed", color: "#94a3b8" }}>
                <h3 style={{ margin: 0 }}>Select a part to manage sections</h3>
                <p style={{ margin: "0.75rem 0 0" }}>Click any part card on the left to edit its details and add sections.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAssessmentBuilder;
