const normalizeSubjectKey = (value) => {
  if (!value && value !== 0) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/\s+/g, "");
};

const selectAssessmentForStudent = (assessments = []) => {
  if (!Array.isArray(assessments) || !assessments.length) return null;

  const visible = assessments.filter((assessment) => assessment && assessment.visibility !== false);
  if (!visible.length) return null;

  const published = visible.filter((assessment) => String(assessment.status || "").toLowerCase() === "published");
  const candidatePool = published.length ? published : visible;

  return [...candidatePool].sort((a, b) => {
    const aParts = Array.isArray(a.parts) ? a.parts.length : 0;
    const bParts = Array.isArray(b.parts) ? b.parts.length : 0;
    if (aParts !== bParts) return bParts - aParts;

    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  })[0];
};

module.exports = {
  normalizeSubjectKey,
  selectAssessmentForStudent,
};
