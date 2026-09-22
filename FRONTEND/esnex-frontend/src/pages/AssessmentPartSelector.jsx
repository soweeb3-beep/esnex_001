import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { sectionCardStyle, sectionHeadingStyle, buttonStyle } from "./admin/adminUtils";

export default function AssessmentPartSelector() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/assessments/${assessmentId}`);
        setAssessment(res.data.data || res.data);
      } catch (err) {
        console.error("Failed to load assessment", err);
        setError("Failed to load assessment");
      } finally {
        setLoading(false);
      }
    };
    if (assessmentId) load();
  }, [assessmentId]);

  const startPart = (partName) => {
    // Navigate to unified assessment route: /assessment/:assessmentId/:part
    const slug = String(partName).toLowerCase().replace(/\s+/g, "-");
    navigate(`/assessment/${assessmentId}/${encodeURIComponent(slug)}`);
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading assessment...</div>;
  if (error) return <div style={{ padding: "1rem", color: "#ef4444" }}>{error}</div>;
  if (!assessment) return <div style={{ padding: "1rem" }}>Assessment not found.</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ ...sectionCardStyle }}>
        <h1 style={{ margin: 0 }}>{assessment.name}</h1>
        <p style={{ marginTop: "0.5rem", color: "#94a3b8" }}>{assessment.description}</p>
      </div>

      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        {(assessment.parts || []).map((part) => (
          <div key={part.partName} style={{ ...sectionCardStyle, padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, color: "#94a3b8", textTransform: "capitalize" }}>{part.partName}</p>
              <p style={{ margin: "0.5rem 0 0", fontWeight: 700 }}>{part.totalMarks} marks · {part.duration} mins</p>
              <p style={{ marginTop: "0.5rem", color: "#94a3b8" }}>{part.instructions}</p>
            </div>
            <div>
              <button type="button" style={buttonStyle} onClick={() => startPart(part.partName)}>Start</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
