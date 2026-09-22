const { getSubjectConfig, inferSubjectConfig, normalizeSubjectKey } = require("./examLoader");
const { countAvailableQuestionsForSection } = require("./assessmentEngine");

const normalizeFiles = (files) => {
  if (!files) return ["questions.json"];
  if (typeof files === "string") return [files];
  if (Array.isArray(files) && files.length) return files;
  return ["questions.json"];
};

const buildSection = async (subject, partType, sectionConfig) => {
  const files = normalizeFiles(sectionConfig.files);
  const questionCount = Number(sectionConfig.questionCount ?? sectionConfig.count ?? 0);
  const availableQuestions = await countAvailableQuestionsForSection(subject, partType, {
    files,
    bankPath: sectionConfig.bankPath,
  });

  return {
    name: sectionConfig.name || sectionConfig.key || "Section",
    questionCount: questionCount > 0 ? questionCount : availableQuestions,
    totalMarks: sectionConfig.marks ?? undefined,
    bankPath: sectionConfig.bankPath || "",
    instructions: sectionConfig.instructions || "",
    files,
    availableQuestions,
  };
};

const buildPart = async (subject, partType, partConfig, options = {}) => {
  const rawSections = Array.isArray(partConfig.parts) ? partConfig.parts : Array.isArray(partConfig.types) ? partConfig.types : Array.isArray(partConfig.sections) ? partConfig.sections : [];
  const sections = [];
  let partTotalQuestions = 0;
  let partTotalMarks = 0;

  for (const sectionConfig of rawSections) {
    const section = await buildSection(subject, partType, sectionConfig);
    if (!section || section.availableQuestions <= 0) {
      continue;
    }
    sections.push(section);
    partTotalQuestions += Number(section.questionCount || 0);
    if (section.totalMarks) {
      partTotalMarks += Number(section.totalMarks);
    }
  }

  return {
    partName: options.partName || toTitleCase(partType),
    partType: toTitleCase(partType),
    title: options.title || toTitleCase(partType),
    type: partType,
    duration: options.duration ?? 0,
    totalMarks: (partConfig.totalMarks ?? partTotalMarks) || 0,
    totalQuestions: partTotalQuestions,
    instructions: partConfig.instructions || "",
    randomizeQuestions: true,
    markingEnabled: true,
    sections,
  };
};

const toTitleCase = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const buildGlobalAssessmentTemplate = async ({
  subject,
  name,
  description,
  duration,
  totalMarks,
  passingScore,
  visibility = true,
  retakeRules = { allowRetake: true, maxAttempts: 3, retakeDelay: 0 },
} = {}) => {
  if (!subject || typeof subject !== "string") {
    throw new Error("Subject is required to build assessment template.");
  }

  const normalizedSubject = normalizeSubjectKey(subject);
  if (!normalizedSubject) {
    throw new Error("Invalid subject value.");
  }

  let subjectConfig = await getSubjectConfig(normalizedSubject);
  if (!subjectConfig) {
    subjectConfig = await inferSubjectConfig(normalizedSubject);
  }

  if (!subjectConfig) {
    throw new Error(`No question configuration found for subject ${subject}.`);
  }

  const result = {
    name: name || `${subjectConfig.displayName || toTitleCase(normalizedSubject)} Assessment`,
    description: description || `Auto-generated assessment for ${subjectConfig.displayName || normalizedSubject}.`,
    type: "global",
    subject: normalizedSubject,
    duration: Number(duration ?? subjectConfig.timeLimit ?? 60),
    totalMarks: Number(totalMarks ?? 100),
    passingScore: Number(passingScore ?? 50),
    visibility,
    randomizeQuestions: true,
    autoSubmit: true,
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
      aiTheoryMarking: true,
      markingGuide: "",
      answerFormat: "",
    },
    retakeRules,
    parts: [],
  };

  const warnings = [];
  const parts = [];

  if (subjectConfig.objective?.parts?.length) {
    const part = await buildPart(normalizedSubject, "objective", subjectConfig.objective, {
      partName: "Objective",
      title: "Objective",
      duration: subjectConfig.timeLimit,
    });
    if (!part.sections.length) warnings.push("Objective part has no valid sections.");
    parts.push(part);
  }

  if (subjectConfig.theory?.types?.length) {
    const part = await buildPart(normalizedSubject, "theory", subjectConfig.theory, {
      partName: "Theory",
      title: "Theory",
      duration: subjectConfig.timeLimit,
    });
    if (!part.sections.length) warnings.push("Theory part has no valid sections.");
    parts.push(part);
  }

  if (subjectConfig.practical?.sections?.length) {
    const part = await buildPart(normalizedSubject, "practical", subjectConfig.practical, {
      partName: "Practical",
      title: "Practical",
      duration: subjectConfig.timeLimit,
    });
    if (!part.sections.length) warnings.push("Practical part has no valid sections.");
    parts.push(part);
  }

  if (subjectConfig.oral?.sections?.length) {
    const part = await buildPart(normalizedSubject, "oral", subjectConfig.oral, {
      partName: "Oral",
      title: "Oral",
      duration: subjectConfig.timeLimit,
    });
    if (!part.sections.length) warnings.push("Oral part has no valid sections.");
    parts.push(part);
  }

  if (!parts.length) {
    throw new Error(`Subject ${subject} does not have any usable assessment parts.`);
  }

  result.parts = parts;
  result.totalQuestions = parts.reduce((sum, part) => sum + (part.totalQuestions || 0), 0);
  if (!result.totalMarks || result.totalMarks <= 0) {
    result.totalMarks = parts.reduce((sum, part) => sum + (part.totalMarks || 0), 0) || 100;
  }

  return {
    assessmentPayload: result,
    warnings,
  };
};

module.exports = {
  buildGlobalAssessmentTemplate,
};
