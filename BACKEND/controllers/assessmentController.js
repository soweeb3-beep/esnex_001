const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const appendStartAssessmentDebug = (message) => {
  try {
    const logPath = path.join(__dirname, '../start-assessment-debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Failed to write startAssessment debug log', err && err.message);
  }
};

try {
  const moduleLogPath = path.join(__dirname, '../start-assessment-module-loaded.log');
  fs.appendFileSync(moduleLogPath, `${new Date().toISOString()} - startAssessment controller module loaded\n`, 'utf8');
} catch (err) {
  console.error('Failed to write startAssessment module loaded log', err && err.message);
}

const jwt = require("jsonwebtoken");
const { getModel } = require("../config/adapter");
const { findActiveAssessmentEnrollment } = require("../utils/assessmentEnrollment");
const { generateExam, getSubjectConfig, inferSubjectConfig, normalizeSubjectKey, loadQuestionsFromFiles, checkQuestionFilesExist, getSectionFileCandidates, findQuestionDirectory } = require("../utils/examLoader");
const { buildGlobalAssessmentTemplate } = require("../utils/assessmentBuilder");
const { countAvailableQuestionsForSection, loadSectionQuestions, shuffleArray } = require("../utils/assessmentEngine");
const { escapeRegExp, removeQuestionAnswers } = require("../services/questionGenerator.service");
const { selectAssessmentForStudent } = require("../utils/assessmentSelection");
const aiMarkingService = require('../services/aiMarkingService');

const getAssessmentModel = () => getModel("Assessment");
const getAssessmentAttemptModel = () => getModel("AssessmentAttempt");
const getAssessmentEnrollmentModel = () => getModel("AssessmentEnrollment");
const getPayment = () => getModel("Payment");
const getQuestionModel = () => getModel("Question");

const isAuthorizedAttemptUser = (req, attempt) => {
  if (!req?.user || !attempt) return false;
  const userId = String(req.user.id || req.user._id || "");
  const attemptOwnerId = String(attempt.studentId || attempt.student || attempt.student?._id || "");
  const isOwner = userId && attemptOwnerId && userId === attemptOwnerId;
  const isAdmin = ["admin", "super-admin"].includes(String(req.user.role || "").toLowerCase());
  return isOwner || isAdmin;
};

const isNumericRubricValue = (value) => {
  if (typeof value === 'number') return true;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value.trim()))) return true;
  return false;
};

const isNumericRubricObject = (rubric) => {
  if (!rubric || typeof rubric !== 'object' || Array.isArray(rubric)) return false;
  const keys = Object.keys(rubric);
  if (!keys.length) return false;
  return keys.every((key) => {
    const value = rubric[key];
    if (typeof value === 'object' && !Array.isArray(value)) {
      return isNumericRubricObject(value);
    }
    return isNumericRubricValue(value);
  });
};

const normalizeRubric = (rubricSource) => {
  if (!rubricSource) return null;
  if (typeof rubricSource === 'object' && !Array.isArray(rubricSource) && Object.keys(rubricSource).length > 0) {
    return isNumericRubricObject(rubricSource) ? rubricSource : null;
  }
  if (typeof rubricSource === 'string') {
    try {
      const parsed = JSON.parse(rubricSource);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
        return isNumericRubricObject(parsed) ? parsed : null;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
};

const normalizeAnswerValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map(normalizeAnswerValue).filter(Boolean).join("|");
  if (typeof value === "object") {
    return normalizeAnswerValue(value.studentAnswer ?? value.answer ?? value.value ?? "");
  }
  return String(value).trim();
};

const normalizeSubmittedAnswers = (submittedAnswers) => {
  if (Array.isArray(submittedAnswers)) {
    return submittedAnswers.map((item, index) => {
      if (item && typeof item === "object") {
        const studentAnswer = normalizeAnswerValue(item.studentAnswer ?? item.answer ?? item.value ?? item);
        return {
          ...item,
          studentAnswer,
          questionIndex: item.questionIndex != null ? Number(item.questionIndex) : Number.isInteger(Number(item.questionId)) ? Number(item.questionId) : index,
        };
      }
      return {
        questionIndex: index,
        studentAnswer: normalizeAnswerValue(item),
      };
    }).filter(Boolean);
  }

  if (submittedAnswers && typeof submittedAnswers === "object") {
    return Object.entries(submittedAnswers).map(([key, value]) => {
      if (value && typeof value === "object") {
        const studentAnswer = normalizeAnswerValue(value.studentAnswer ?? value.answer ?? value.value ?? value);
        return {
          ...value,
          studentAnswer,
          questionIndex: value.questionIndex != null ? Number(value.questionIndex) : (/^\d+$/.test(key) ? Number(key) : null),
          questionId: value.questionId ?? (/^\d+$/.test(key) ? undefined : key),
        };
      }
      return {
        questionIndex: /^\d+$/.test(key) ? Number(key) : null,
        questionId: /^\d+$/.test(key) ? undefined : key,
        studentAnswer: normalizeAnswerValue(value),
      };
    }).filter(Boolean);
  }

  return [];
};

const normalizeQuestionTypeForStorage = (qt) => {
  if (!qt) return 'short-answer';
  const key = String(qt).trim().toLowerCase();
  if (key === 'mcq' || key.includes('mcq') || key.includes('multiple') || key.includes('choice')) return 'multiple-choice';
  if (key.includes('true') && key.includes('false')) return 'true-false';
  if (key.includes('essay') || key.includes('article') || key.includes('debate') || key.includes('story')) return 'essay';
  if (key.includes('objective')) return 'objective';
  return 'short-answer';
};

const isOralAttempt = (attempt) => {
  if (!attempt || !Array.isArray(attempt.questions)) return false;
  return attempt.questions.some((question) => {
    const qType = String(question.questionType || question.type || question.subType || "").toLowerCase();
    return qType.includes("oral");
  });
};

const getQuestionTypeKey = (q) => {
  return String(
    q?.questionType ||
    q?.type ||
    q?.subType ||
    q?.sectionName ||
    q?.section_title ||
    q?.question?.questionType ||
    q?.question?.type ||
    ''
  )
    .trim()
    .toLowerCase();
};

const isEnglishEssayQuestion = (q) => {
  const key = getQuestionTypeKey(q);
  return (
    key.includes('essay') ||
    key.includes('article') ||
    key.includes('letter') ||
    key.includes('story') ||
    key.includes('debate')
  );
};

const isComprehensionQuestion = (q) => getQuestionTypeKey(q).includes('comprehension');
const isSummaryQuestion = (q) => getQuestionTypeKey(q).includes('summary');

const getExpectedTotalMarksForQuestion = (q, questions = []) => {
  if (!q || typeof q !== 'object') return 1;
  const explicitMarks = Number(q.totalMarks ?? q.total_marks ?? q.marks);

  // For English Theory WAEC structure, override raw question weights for essay,
  // comprehension, and summary sections so they map to 50/30/20 respectively.
  if (isEnglishEssayQuestion(q)) {
    return 50;
  }

  if (isSummaryQuestion(q)) {
    const summaryQuestions = (questions || []).filter(isSummaryQuestion).length || 1;
    return Math.round((20 / summaryQuestions) * 100) / 100;
  }

  if (isComprehensionQuestion(q)) {
    const comprehensionQuestions = (questions || []).filter(isComprehensionQuestion).length || 1;
    return Math.round((30 / comprehensionQuestions) * 100) / 100;
  }

  if (Number.isFinite(explicitMarks) && explicitMarks > 0) {
    return explicitMarks;
  }

  if (isEnglishEssayQuestion(q)) {
    return 50;
  }

  if (isSummaryQuestion(q)) {
    const summaryQuestions = (questions || []).filter(isSummaryQuestion).length || 1;
    return Math.round((20 / summaryQuestions) * 100) / 100;
  }

  if (isComprehensionQuestion(q)) {
    const comprehensionQuestions = (questions || []).filter(isComprehensionQuestion).length || 1;
    return Math.round((30 / comprehensionQuestions) * 100) / 100;
  }

  const rubric = normalizeRubric(
    q?.rubric || q?.markingRubric || q?.question?.markingRubric || q?.question?.marking_criteria || q?.marking_criteria
  );
  if (rubric) {
    const total = Object.values(rubric).reduce((sum, value) => sum + Number(value || 0), 0);
    if (total > 0) return total;
  }

  return 1;
};

const buildAttemptAiReport = (attempt) => {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const answerReports = answers.map((ans) => ({
    questionId: ans.questionId,
    questionType: ans.questionType,
    totalScore: Number(ans.aiReport?.totalScore ?? ans.aiReport?.score ?? ans.marks ?? 0),
    categoryScores: ans.aiReport?.categoryScores || null,
    feedback: ans.aiReport?.feedback || '',
  }));
  const categoryScores = answerReports.reduce((acc, report) => {
    if (report.categoryScores && typeof report.categoryScores === 'object') {
      Object.entries(report.categoryScores).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + Number(value || 0);
      });
    }
    return acc;
  }, {});

  return {
    totalScore: Number(attempt.obtainedMarks || 0),
    totalMarks: Number(attempt.totalMarks || 0),
    percentage: Number(Number(attempt.percentage || 0).toFixed(2)),
    feedback: answerReports.map((r) => r.feedback).filter(Boolean).join('\n\n') || null,
    categoryScores: Object.keys(categoryScores).length ? categoryScores : undefined,
    answers: answerReports,
  };
};

const getNormalizedCorrectAnswers = (correctAnswer) => {
  if (correctAnswer === undefined || correctAnswer === null) return [];
  if (Array.isArray(correctAnswer)) return correctAnswer.map(normalizeAnswerValue).filter(Boolean);
  return [normalizeAnswerValue(correctAnswer)].filter(Boolean);
};

const pickRandomItem = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
};

const resolveOralTypeKey = (selectedType, availableKeys = []) => {
  if (!selectedType || !Array.isArray(availableKeys) || !availableKeys.length) return null;
  const normalizedSelection = String(selectedType).trim().toLowerCase();
  return availableKeys.find((key) => String(key).trim().toLowerCase() === normalizedSelection)
    || availableKeys.find((key) => String(key).trim().toLowerCase().includes(normalizedSelection))
    || availableKeys.find((key) => normalizedSelection.includes(String(key).trim().toLowerCase()));
};

const normalizeEnglishEssayRubric = (rubric) => {
  if (!rubric || typeof rubric !== 'object' || Array.isArray(rubric)) return null;
  const mapping = {
    content: 'Content',
    organization: 'Organization',
    expression: 'Expression',
    spelling_and_grammar: 'MechanicalAccuracy',
    spelling: 'MechanicalAccuracy',
    grammar: 'MechanicalAccuracy',
    mechanical_accuracy: 'MechanicalAccuracy',
    format_and_salutation: 'SalutationFormat',
    salutation_format: 'SalutationFormat',
    format: 'SalutationFormat',
    salutation: 'SalutationFormat',
  };
  const normalized = {};
  Object.keys(rubric).forEach((key) => {
    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, '_');
    const target = mapping[normalizedKey] || (key[0]?.toUpperCase() + key.slice(1));
    const value = rubric[key];
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && numericValue > 0) {
      normalized[target] = numericValue;
    }
  });
  return Object.keys(normalized).length ? normalized : null;
};

const deriveAnswerRubric = (ans, q) => {
  const candidateSources = [
    ans?.rubric,
    ans?.markingRubric,
    q?.rubric,
    q?.markingRubric,
    q?.question?.marking_scheme,
    q?.marking_scheme,
    q?.question?.markingScheme,
    q?.markingScheme,
    q?.question?.markingCriteria,
    q?.question?.marking_criteria,
    q?.markingCriteria,
    q?.marking_criteria,
    q?.question?.ai_marking_guide,
  ];
  for (const source of candidateSources) {
    const normalized = normalizeRubric(source);
    if (normalized) return normalized;
  }
  return null;
};

const loadOralConfigFile = async (subject, fileName = "oral.json") => {
  const normalized = normalizeSubjectKey(subject);
  if (!normalized) return null;

  const basePath = await findQuestionDirectory(normalized, "oral", [fileName]);
  if (!basePath) return null;

  const filePath = path.join(basePath, fileName);
  if (!filePath.startsWith(path.join(__dirname, "..", "questions"))) {
    console.error(`[ORAL] Invalid file path for subject ${subject}: ${filePath}`);
    return null;
  }
  if (!fs.existsSync(filePath)) {
    console.error(`[ORAL] Oral question file does not exist: ${filePath}`);
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[ORAL] Failed to load oral config for ${subject}:`, error.message);
    return null;
  }
};

const getAvailableOralTypesForSubject = async (subject) => {
  const oralData = await loadOralConfigFile(subject);
  if (!oralData || typeof oralData !== "object") return [];

  const wrapperKeys = [
    "subject",
    "paper",
    "exam_type",
    "year",
    "duration_minutes",
    "audio_enabled",
    "full_audio",
    "total_questions",
    "tests",
    "years",
    "types",
  ];

  const rawEntries = Object.entries(oralData).filter(([key]) => !wrapperKeys.includes(key));
  if (!rawEntries.length) {
    rawEntries.push(["default", oralData]);
  }

  return rawEntries.map(([typeKey, typeDef]) => {
    const years = typeDef?.years && typeof typeDef.years === "object"
      ? Object.keys(typeDef.years)
      : typeDef?.year
        ? [String(typeDef.year)]
        : [];
    const totalQuestions = years.reduce((sum, year) => {
      const entry = typeDef.years?.[year];
      if (Array.isArray(entry)) {
        return sum + entry.length;
      }
      if (entry && typeof entry === "object") {
        if (Array.isArray(entry.tests)) {
          return sum + entry.tests.reduce((testSum, test) => {
            const questions = Array.isArray(test.questions) ? test.questions : [];
            return testSum + questions.length;
          }, 0);
        }
        return sum + (Array.isArray(entry.questions) ? entry.questions.length : 0);
      }
      return sum;
    }, 0);

    return {
      key: typeKey,
      label: typeDef?.label || typeKey,
      description: typeDef?.description || "",
      mode: typeDef?.mode || (typeKey.toLowerCase().includes("audio") ? "audio" : "no-audio"),
      yearCount: years.length,
      years,
      totalQuestions,
    };
  });
};

const loadOralSectionQuestions = async (subject, section, count, selectedOralType, requestedYear) => {
  const fileName = Array.isArray(section.files) && section.files.length ? section.files[0] : "oral.json";
  const oralData = await loadOralConfigFile(subject, fileName);
  if (!oralData || typeof oralData !== "object") return [];

  const wrapperKeys = [
    "subject",
    "paper",
    "exam_type",
    "year",
    "duration_minutes",
    "audio_enabled",
    "full_audio",
    "total_questions",
    "tests",
    "years",
    "types",
  ];

  const availableTypes = Object.keys(oralData).filter((key) => !wrapperKeys.includes(key));
  let chosenType = null;
  let typeConfig = null;

  if (Object.prototype.hasOwnProperty.call(oralData, "tests") || Object.prototype.hasOwnProperty.call(oralData, "year") || Object.prototype.hasOwnProperty.call(oralData, "full_audio")) {
    chosenType = "default";
    typeConfig = oralData;
  } else {
    if (!availableTypes.length) return [];
    chosenType = resolveOralTypeKey(selectedOralType, availableTypes) || pickRandomItem(availableTypes);
    typeConfig = oralData[chosenType];
  }
  if (!typeConfig || typeof typeConfig !== "object") return [];

  const hasYears = typeConfig.years && typeof typeConfig.years === "object";
  const yearKeys = hasYears
    ? Object.keys(typeConfig.years)
    : typeConfig.year
      ? [String(typeConfig.year)]
      : [];
  if (!yearKeys.length) return [];

  const chosenYear = requestedYear && yearKeys.includes(String(requestedYear))
    ? String(requestedYear)
    : pickRandomItem(yearKeys);

  const yearData = hasYears
    ? typeConfig.years[chosenYear]
    : String(typeConfig.year) === chosenYear
      ? typeConfig
      : typeConfig;
  if (!yearData || typeof yearData !== "object") return [];

  const tests = Array.isArray(yearData.tests)
    ? yearData.tests
    : Array.isArray(yearData)
      ? [{ title: "Oral", instruction: "", questions: yearData }]
      : yearData.questions
        ? [yearData]
        : [];

  const questions = tests.flatMap((testSection, testIndex) => {
    const sectionQuestions = Array.isArray(testSection.questions)
      ? testSection.questions
      : Array.isArray(testSection)
        ? testSection
        : [];

    if (!sectionQuestions.length) return [];

    const selected = (tests.length === 1 && count > 0 && sectionQuestions.length > count)
    ? shuffleArray(sectionQuestions).slice(0, count)
    : sectionQuestions;

    const sectionTitle = testSection.title || testSection.name || `TEST ${testIndex + 1}`;
    const sectionInstruction = testSection.instruction || testSection.instructions || "";
    const sectionExamples = Array.isArray(testSection.examples)
      ? testSection.examples
      : testSection.examples
        ? [testSection.examples]
        : [];
    const sectionAudioEnabled = testSection.audioEnabled !== false;

    return normalizeQuestionItems(selected, `${subject}/oral/${chosenType}/${chosenYear}/${sectionTitle}`).map((question, index) => ({
      ...question,
      questionId: question.id || `${subject}-oral-${section.key}-${testIndex}-${index}`,
      prompt: question.prompt || question.text || "",
      text: question.prompt || question.text || "",
      type: "oral",
      questionType: "oral",
      subType: section.key,
      oralType: chosenType,
      oralYear: chosenYear,
      oralMode: typeConfig?.mode || (chosenType.toLowerCase().includes("audio") ? "audio" : "no-audio"),
      sectionName: sectionTitle,
      sectionInstructions: sectionInstruction,
      sectionExamples,
      sectionAudioEnabled,
      sampleAnswer: question.sampleAnswer || question.answer || "",
      difficulty: question.difficulty || "medium",
    }));
  });

  // Ensure we return at least `count` items by padding clones when the bank is small.
  const expectedCount = Number(count) || questions.length;
  if (questions.length < expectedCount && questions.length > 0) {
    const padded = [...questions];
    let idx = 0;
    while (padded.length < expectedCount) {
      const src = questions[idx % questions.length];
      const clone = { ...src };
      const variant = Math.floor(padded.length / questions.length);
      // Adjust ids and prompts slightly to avoid exact duplicates
      clone.questionId = `${clone.questionId || clone.id || 'oral'}-clone-${variant}-${idx}`;
      clone.id = clone.questionId;
      clone.prompt = `${clone.prompt || clone.text || ''} (Variant ${variant + 1})`;
      padded.push(clone);
      idx += 1;
    }
    return padded.slice(0, expectedCount);
  }

  // Attach oral metadata for consumers (e.g., full_audio, chosenType, chosenYear, duration)
  try {
    const fullAudio =
      (typeConfig && typeConfig.years && typeConfig.years[chosenYear] && (typeConfig.years[chosenYear].full_audio || typeConfig.full_audio))
      || (typeConfig && typeConfig.full_audio)
      || null;
    const durationMinutes =
      typeConfig?.duration_minutes
      || (typeConfig?.years && typeConfig.years[chosenYear] && typeConfig.years[chosenYear].duration_minutes)
      || null;
    const oralMode = typeConfig?.mode || (chosenType.toLowerCase().includes("audio") ? "audio" : "no-audio");
    const meta = {
      oralType: chosenType,
      oralYear: chosenYear,
      oralMode,
      full_audio: fullAudio,
      duration_minutes: durationMinutes,
    };
    questions.forEach((question) => {
      if (question && typeof question === "object") {
        question.fullAudio = fullAudio || null;
        question.oralType = question.oralType || chosenType;
        question.oralYear = question.oralYear || chosenYear;
        question.oralMode = question.oralMode || oralMode;
        question.oralDurationMinutes = durationMinutes || null;
      }
    });
    Object.defineProperty(questions, "_oralMeta", { value: meta, enumerable: false, writable: true, configurable: true });
  } catch (e) {
    // ignore
  }

  return questions;
};

console.error('[DEBUG] connectDB.isMongoConnected:', connectDB.isMongoConnected?.());
console.error('[DEBUG] mongoose.connection.readyState:', mongoose.connection.readyState);
console.error('[DEBUG] MONGO_URI set:', !!process.env.MONGO_URI);

// Subject to Category mapping
const subjectCategoryMap = {
  // Science Subjects
  "physics": "Science Subjects",
  "chemistry": "Science Subjects",
  "biology": "Science Subjects",
  "integrated science": "Science Subjects",
  // Arts Subjects
  "arts": "Arts",
  "literature in english": "Arts Subjects",
  "history": "Arts Subjects",
  "geography": "Arts Subjects",
  "government": "Arts Subjects",
  "islamic religious studies": "Arts Subjects",
  "islamic religious studies (irs)": "Arts Subjects",
  "christian religious studies": "Arts Subjects",
  "christian religious studies (crs)": "Arts Subjects",
  "arabic": "Arts Subjects",
  "french": "Arts Subjects",
  // Commerce Subjects
  "principles of accounts": "Commerce Subjects",
  "economics": "Commerce Subjects",
  "commerce": "Commerce Subjects",
  "financial accounting": "Commerce Subjects",
  "business management": "Commerce Subjects",
};

const getSubjectCategory = (subject) => {
  if (!subject) return null;
  const normalized = subject.toLowerCase().trim();
  return subjectCategoryMap[normalized] || null;
};

const buildGlobalAssessmentParts = (subjectConfig) => {
  const parts = [];
  const defaultPartDuration = Number(subjectConfig.timeLimit ?? subjectConfig.duration ?? 0);

  if (subjectConfig.objective?.parts?.length) {
    const sections = subjectConfig.objective.parts.map((section) => ({
      key: section.key || section.name || "A",
      name: section.name || "Section",
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? 20,
      bankPath: section.bankPath || "",
      files: section.files || [`section${section.key || "A"}.json`],
    }));
    parts.push({
      title: "Objective",
      partName: "Objective",
      type: "objective",
      partType: "Objective",
      duration: defaultPartDuration,
      totalMarks: subjectConfig.objective.totalMarks ?? 40,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
    });
  }

  if (subjectConfig.theory?.types?.length) {
    const sections = subjectConfig.theory.types.map((section) => ({
      key: section.key || section.name || "theory",
      name: section.name || "Theory",
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? 10,
      bankPath: section.bankPath || "",
      files: section.files || [`${section.key || "theory"}.json`],
    }));
    parts.push({
      title: "Theory",
      partName: "Theory",
      type: "theory",
      partType: "Theory",
      duration: defaultPartDuration,
      totalMarks: subjectConfig.theory.totalMarks ?? 40,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
    });
  }

  if (subjectConfig.practical?.sections?.length) {
    const sections = subjectConfig.practical.sections.map((section) => ({
      key: section.key || section.name || "practical",
      name: section.name || "Practical",
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? 10,
      bankPath: section.bankPath || "",
      files: section.files || [`${section.key || "practical"}.json`],
    }));
    parts.push({
      title: "Practical",
      partName: "Practical",
      type: "practical",
      partType: "Practical",
      duration: defaultPartDuration,
      totalMarks: subjectConfig.practical.totalMarks ?? 40,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
    });
  }

  if (subjectConfig.oral?.sections?.length) {
    const sections = subjectConfig.oral.sections.map((section) => ({
      key: section.key || section.name || "oral",
      name: section.name || "Oral",
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? 5,
      bankPath: section.bankPath || "",
      files: section.files || [`${section.key || "oral"}.json`],
    }));
    parts.push({
      title: "Oral",
      partName: "Oral",
      type: "oral",
      partType: "Oral",
      duration: defaultPartDuration,
      totalMarks: subjectConfig.oral.totalMarks ?? 20,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
    });
  }

  return parts;
};

const flattenQuestionCollection = (data, bankPath = "") => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const pathKey = String(bankPath || "").toLowerCase();
  const hasPassage = data.passage && (Array.isArray(data.passage) || typeof data.passage === "string");
  const hasQuestions = Array.isArray(data.questions);
  const hasSummaryQuestions = data.summary && Array.isArray(data.summary.questions);
  const isSummaryBank = pathKey.includes("summary");
  const isComprehensionBank = pathKey.includes("comprehension");

  if (hasPassage && (hasQuestions || hasSummaryQuestions)) {
    const sections = [];

    const addComprehension = () => {
      sections.push({
        ...data,
        type: data.type || data.questionType || "theory",
        questionType: data.questionType || data.type || "comprehension",
        subType: data.subType || "comprehension",
        passage: data.passage,
        questions: data.questions,
        instruction: data.instruction || data.section_instruction || (data.summary?.instruction || ""),
        sectionName: data.section_title || data.section || data.sectionName || "Comprehension",
      });
    };

    const addSummary = () => {
      sections.push({
        ...data.summary,
        type: data.summary.type || data.type || data.questionType || "theory",
        questionType: data.summary.questionType || "summary",
        subType: data.summary.subType || "summary",
        passage: data.summary.passage || data.passage,
        questions: data.summary.questions,
        instruction: data.summary.instruction || data.instruction || "",
        sectionName: data.summary.section_title || data.summary.section || "Summary",
      });
    };

    if (hasQuestions && (!hasSummaryQuestions || isComprehensionBank || !isSummaryBank)) {
      addComprehension();
    }
    if (hasSummaryQuestions && (!hasComprehensionBank || isSummaryBank)) {
      addSummary();
    }

    if (sections.length > 0) return sections;
  }

  if (data.question && typeof data.question === "object" && !Array.isArray(data.question)) {
    const candidateQuestion = data.question;
    const hasQuestionFields = candidateQuestion.id || candidateQuestion.question || candidateQuestion.prompt || candidateQuestion.text || candidateQuestion.title || candidateQuestion.correctAnswer || typeof candidateQuestion.answer !== "undefined";
    if (hasQuestionFields) {
      return [candidateQuestion];
    }
    return flattenQuestionCollection(candidateQuestion, bankPath);
  }

  if (
    Array.isArray(data.options) ||
    typeof data.question === "string" ||
    typeof data.text === "string" ||
    typeof data.correctAnswer !== "undefined" ||
    typeof data.answer !== "undefined"
  ) {
    return [data];
  }

  return Object.values(data).flatMap(flattenQuestionCollection);
};

const normalizeQuestionItems = (questions = [], bankPath = "") => {
  const seen = new Set();

  const normalizeOptionsAndAnswer = (question) => {
    let options = question.options;
    let correctAnswer = question.correctAnswer ?? question.answer;

    if (options && !Array.isArray(options) && typeof options === "object") {
      const optionList = Object.values(options);
      if (typeof correctAnswer === "string") {
        const answerKey = correctAnswer.trim().toUpperCase();
        if (options[answerKey] !== undefined) {
          correctAnswer = options[answerKey];
        }
      }
      options = optionList;
    }

    if (Array.isArray(options) && typeof correctAnswer === "string" && /^[A-Z]$/.test(correctAnswer.trim().toUpperCase())) {
      const idx = correctAnswer.trim().toUpperCase().charCodeAt(0) - 65;
      if (options[idx] !== undefined) {
        correctAnswer = options[idx];
      }
    }

    return {
      ...question,
      options,
      correctAnswer,
      answer: correctAnswer,
    };
  };

  return questions
    .map((question, index) => {
      const id = String(
        question.questionId || question.id || question._id?.toString() || `${bankPath || "bank"}_${index}`
      ).trim();
      // Normalize essay questions: map 'prompt' to 'text' if text is missing
      const normalized = {
        ...question,
        questionId: id,
        text: question.text || question.prompt || question.question || question.topic || "",
        sampleAnswer:
          question.sampleAnswer ||
          question.sample_answer ||
          question.sample_answer_summary ||
          question.answer ||
          "",
      };
      return normalizeOptionsAndAnswer(normalized);
    })
    .filter((question) => {
      const dedupeKey = question.questionId || question.text || question.question;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
};

// New function to build question path from subject and type
const normalizeSubjectFolder = (subject) => {
  const cleaned = String(subject || "").trim();
  if (!cleaned) return "";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const buildQuestionPaths = (subject, partType) => {
  const category = getSubjectCategory(subject);
  const normalizedSubject = String(subject || "").trim();
  const titleCaseSubject = normalizeSubjectFolder(normalizedSubject);
  const subjectCandidates = [...new Set([
    normalizedSubject,
    normalizedSubject.toLowerCase(),
    normalizedSubject.toUpperCase(),
    titleCaseSubject,
  ].filter(Boolean))];

  let typeFolder = partType ? partType.toLowerCase().replace(/\s+/g, "") : "objective";
  const typeCandidates = typeFolder === "practical" ? ["paratical", "practical"] : [typeFolder, partType?.toLowerCase()];

  const paths = [];
  for (const subjectFolder of subjectCandidates) {
    for (const typeName of typeCandidates.filter(Boolean)) {
      if (category) {
        paths.push(`${category}/${subjectFolder}/${typeName}/questions.json`);
      }
      paths.push(`${subjectFolder}/${typeName}/questions.json`);
    }
  }

  return [...new Set(paths)];
};

const readQuestionsFromDirectory = (dirPath) => {
  const questions = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      questions.push(...readQuestionsFromDirectory(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      try {
        const raw = fs.readFileSync(entryPath, "utf-8");
        const parsed = JSON.parse(raw);
        questions.push(...flattenQuestionCollection(parsed, path.relative(path.join(__dirname, "../questions"), entryPath)));
      } catch (error) {
        console.warn(`Skipping invalid question file ${entryPath}: ${error.message}`);
      }
    }
  }
  return questions;
};

const loadQuestionsFromBank = async (bankPath, questionCount) => {
  try {
    const fullPath = path.join(__dirname, "../questions", bankPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Question bank not found: ${fullPath}`);
      return [];
    }

    let questions = [];
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      questions = readQuestionsFromDirectory(fullPath);
    } else {
      const data = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(data);
      questions = flattenQuestionCollection(parsed, bankPath);
    }

    if (!questions.length) return [];

    const normalized = normalizeQuestionItems(questions, bankPath);
    if (questionCount && questionCount < normalized.length) {
      return shuffleArray(normalized).slice(0, questionCount);
    }

    return normalized;
  } catch (err) {
    console.error("Question bank load error", err);
    return [];
  }
};

// GET essay questions for a subject and essay type
const getEssayQuestions = async (req, res) => {
  try {
    const subject = req.params.subject;
    const type = String(req.params.type || "").trim().toLowerCase();
    const normalized = normalizeSubjectKey(subject);
    if (!normalized) return res.status(404).json({ message: "Subject not found" });
    if (!type) return res.status(400).json({ message: "Essay type is required" });

    // Try a few candidate file paths to locate the essay bank
    const candidates = [
      `essay/${type}/questions.json`,
      `${type}/questions.json`,
      `${type}.json`,
    ];

    let rawQuestions = [];
    for (const candidate of candidates) {
      rawQuestions = await loadQuestionsFromFiles(normalized, "theory", [candidate]);
      if (rawQuestions && rawQuestions.length) break;
    }

    if (!rawQuestions.length) {
      // fallback: attempt to load via generic new-path loader
      rawQuestions = await loadQuestionsFromNewPath(normalized, "theory", 0, candidates);
    }

    const questions = normalizeQuestionItems(rawQuestions, `${normalized}/theory`);
    return res.json({ message: "Essay questions fetched", questions });
  } catch (error) {
    console.error("Get essay questions error", error);
    return res.status(500).json({ message: "Unable to fetch essay questions", error: error.message });
  }
};

// New function to load questions from the folder structure using examLoader helpers
const loadQuestionsFromNewPath = async (subject, partType, questionCount, sectionOrFiles = []) => {
  try {
    let fileList = [];
    let section = null;

    if (Array.isArray(sectionOrFiles) && sectionOrFiles.length) {
      fileList = sectionOrFiles.map((file) => String(file || "").trim()).filter(Boolean);
    } else if (sectionOrFiles && typeof sectionOrFiles === "object") {
      section = sectionOrFiles;
      fileList = Array.isArray(section.files) && section.files.length
        ? section.files.map((file) => String(file || "").trim()).filter(Boolean)
        : [];
    }

    if (!fileList.length || (fileList.length === 1 && String(fileList[0]).trim().toLowerCase() === "questions.json")) {
      const candidateFiles = section ? getSectionFileCandidates(section) : [];
      fileList = [...new Set([...(fileList || []), ...candidateFiles, "questions.json"])]
        .filter((file) => Boolean(file));
    }

    if (fileList.length > 1) {
      const specificFiles = fileList.filter((file) => String(file).trim().toLowerCase() !== "questions.json");
      if (specificFiles.length) {
        fileList = [...new Set(specificFiles)];
      }
    }

    if (!fileList.length) {
      fileList = ["questions.json"];
    }

    const normalizedType = String(partType || "objective").trim().toLowerCase();
    const questions = await loadQuestionsFromFiles(subject, normalizedType, fileList);

    if (!questions.length) {
      console.warn(`No questions found for subject=${subject}, type=${normalizedType}, files=${JSON.stringify(fileList)}`);
      return [];
    }

    const normalized = normalizeQuestionItems(questions, `${subject}/${normalizedType}`);
    if (questionCount && questionCount < normalized.length) {
      return shuffleArray(normalized).slice(0, questionCount);
    }

    return normalized;
  } catch (err) {
    console.error("Error loading questions from new path:", err);
    return [];
  }
};

// GET questions by path params (subject, part, section, subsection)
const getQuestionsByPath = async (req, res) => {
  try {
    const subjectRaw = req.query.subject || req.body.subject || req.params.subject;
    const partRaw = req.query.part || req.body.part || req.params.part;
    const sectionRaw = req.query.section || req.body.section || req.params.section;
    const subsectionRaw = req.query.subsection || req.body.subsection || req.params.subsection;
    const count = Number(req.query.count || req.body.count || 0) || 0;

    if (!subjectRaw || !partRaw) return res.status(400).json({ message: 'subject and part are required' });

    const subject = normalizeSubjectKey(subjectRaw) || String(subjectRaw).trim().toLowerCase();
    const part = String(partRaw || '').trim().toLowerCase();
    const section = sectionRaw ? String(sectionRaw).trim().toLowerCase() : null;
    const subsection = subsectionRaw ? String(subsectionRaw).trim().toLowerCase() : null;

    const candidates = [];
    if (section && subsection) candidates.push(`${section}/${subsection}/questions.json`);
    if (section) candidates.push(`${section}/questions.json`);
    if (subsection) candidates.push(`${subsection}/questions.json`);
    // also try nested folder like `${section}/${subsection}.json` variants
    if (section && subsection) candidates.push(`${section}/${subsection}.json`);
    candidates.push(`${part}/questions.json`);
    candidates.push('questions.json');

    const questions = await loadQuestionsFromNewPath(subject, part, count, candidates);

    return res.json({ message: 'Questions loaded', questions });
  } catch (error) {
    console.error('getQuestionsByPath error', error);
    return res.status(500).json({ message: 'Unable to load questions', error: error.message });
  }
};

// New function to load questions from database based on assessment/part/section
const loadQuestionsFromDatabase = async (assessmentId, partName, sectionName, questionCount) => {
  try {
    const QuestionModel = getQuestionModel();
    const query = { assessmentId };
    if (partName) query.partName = partName;
    if (sectionName) query.sectionName = sectionName;

    let questions = await QuestionModel.find(query);
    questions = normalizeQuestionItems(questions);

    if (questionCount && questionCount < questions.length) {
      questions = shuffleArray(questions).slice(0, questionCount);
    }

    return questions;
  } catch (err) {
    console.error("Database question load error", err);
    return [];
  }
};

const getQuestionUniqueKey = (question) => {
  if (!question || typeof question !== "object") return "";
  return String(question.questionId || question.id || question._id || question.text || question.question || "").trim();
};

// Search the questions directory recursively for a question matching an id string
const searchQuestionById = (rootDir, idToFind) => {
  try {
    const files = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of files) {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        const found = searchQuestionById(entryPath, idToFind);
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        try {
          const raw = fs.readFileSync(entryPath, 'utf8');
          const parsed = JSON.parse(raw);
          const items = flattenQuestionCollection(parsed);
          for (const q of items) {
            const key = String(q.questionId || q.id || q._id || '').trim();
            if (!key) continue;
            if (key === idToFind || key.endsWith(idToFind)) {
              return q;
            }
          }
        } catch (err) {
          // ignore parse errors
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
};

const filterUniqueQuestions = (questions = [], usedKeys = new Set()) => {
  const unique = [];
  for (const question of questions) {
    const key = getQuestionUniqueKey(question);
    if (!key || usedKeys.has(key)) continue;
    usedKeys.add(key);
    unique.push(question);
  }
  return unique;
};

const flattenQuestionTree = (questions = []) => {
  const flat = [];
  const traverse = (item) => {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item.questions) && item.questions.length) {
      item.questions.forEach(traverse);
      return;
    }
    if (item.summary && Array.isArray(item.summary.questions) && item.summary.questions.length) {
      item.summary.questions.forEach(traverse);
      return;
    }
    flat.push(item);
  };
  questions.forEach(traverse);
  return flat;
};

const getQuestionId = (question, fallbackIndex) => {
  if (!question || typeof question !== "object") return String(fallbackIndex || "");
  return String(question.questionId || question.id || question._id || `q_${fallbackIndex}`).trim();
};

const flattenAttemptQuestions = (questions = []) => {
  const flat = [];
  const traverse = (question) => {
    if (!question || typeof question !== "object") return;
    if (Array.isArray(question.questions) && question.questions.length) {
      question.questions.forEach(traverse);
      return;
    }
    if (question.summary && Array.isArray(question.summary.questions) && question.summary.questions.length) {
      question.summary.questions.forEach(traverse);
      return;
    }
    flat.push(question);
  };
  questions.forEach(traverse);
  return flat;
};

// Function to save questions to database for assessment/part/section
const saveQuestionsToDatabase = async (assessmentId, partName, sectionName, questions) => {
  try {
    const QuestionModel = getQuestionModel();
    const questionDocs = questions.map(q => ({
      ...q,
      assessmentId,
      partName,
      sectionName,
      questionId: q.questionId || `${assessmentId}_${partName}_${sectionName}_${Date.now()}_${Math.random()}`
    }));

    if (typeof QuestionModel.insertMany === "function") {
      await QuestionModel.insertMany(questionDocs);
    } else {
      await Promise.all(questionDocs.map((doc) => QuestionModel.create(doc)));
    }
    return true;
  } catch (err) {
    console.error("Database question save error", err);
    return false;
  }
};

const validateAssessmentStructure = (parts) => {
  if (!Array.isArray(parts)) {
    return { valid: false, message: "Parts must be an array." };
  }

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const partName = part.partName || `Part ${i + 1}`;
    const partType = part.partType;
    const duration = Number(part.duration);
    const totalQuestions = Number(part.totalQuestions);

    if (!partName || !partType || !duration || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(totalQuestions) || totalQuestions < 0) {
      return {
        valid: false,
        message: `Invalid part data for ${partName}. Ensure name, type, duration and totalQuestions are provided and valid.`,
      };
    }

    const sections = Array.isArray(part.sections) ? part.sections : [];
    if (sections.length > 0) {
      const sectionTotal = sections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
      if (sectionTotal !== totalQuestions) {
        return {
          valid: false,
          message: `Section questions for ${partName} must equal part total questions (${sectionTotal} vs ${totalQuestions}).`,
        };
      }
    }
  }

  return { valid: true };
};

const createAssessment = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  const logPath = path.join(__dirname, '../assessment_debug.log');
  try {
    console.log("CreateAssessment called with body:", JSON.stringify(req.body, null, 2));
    
    const { name, description, type, courseId, subject, duration, totalMarks, passingScore, parts, antiCheat, markingScheme, retakeRules, visibility } = req.body;

    if (!name || !type || !subject || !duration || !parts) {
      return res.status(400).json({ message: "Missing required fields: name, type, subject, duration, and parts are required" });
    }

    // Ensure required numeric fields have valid values
    const validDuration = Number(duration);
    const validTotalMarks = Number(totalMarks) || 100;
    const validPassingScore = Number(passingScore) || 50;

    if (!validDuration || validDuration <= 0) {
      return res.status(400).json({ message: "Duration must be a positive number" });
    }

    if (validTotalMarks <= 0) {
      return res.status(400).json({ message: "Total marks must be a positive number" });
    }

    if (validPassingScore < 0 || validPassingScore > validTotalMarks) {
      return res.status(400).json({ message: "Passing score must be between 0 and total marks" });
    }

    const structureValidation = validateAssessmentStructure(parts);
    if (!structureValidation.valid) {
      return res.status(400).json({ message: structureValidation.message });
    }

    console.log("All validations passed, creating assessment...");
    console.log("AssessmentModel:", typeof AssessmentModel);
    console.log("AssessmentModel.create:", typeof AssessmentModel.create);

    const assessment = await AssessmentModel.create({
      name,
      description,
      type,
      courseId,
      subject,
      duration: validDuration,
      totalMarks: validTotalMarks,
      passingScore: validPassingScore,
      parts,
      allowedParts: parts.map((_, index) => String.fromCharCode(65 + index)), // A, B, C, etc.
      antiCheat,
      markingScheme,
      retakeRules,
      visibility: visibility !== undefined ? visibility : true,
      createdBy: req.user?.id || req.user?._id,
    });

    console.log("Assessment created successfully:", assessment._id);
    fs.appendFileSync(logPath, `\nSuccess! Assessment ID: ${assessment._id}\n`);
    res.status(201).json({ assessment });
  } catch (error) {
    const errorLog = `\n\nERROR: ${error.message}\nName: ${error.name}\nStack: ${error.stack}\n`;
    fs.appendFileSync(logPath, errorLog);
    
    console.error("Assessment creation error:", error);
    console.error("Error message:", error.message);
    console.error("Error name:", error.name);
    res.status(500).json({ 
      message: "Unable to create assessment", 
      error: error.message,
      errorName: error.name
    });
  }
};

const getAssessmentTemplate = async (req, res) => {
  try {
    const { subject, name, description, duration, totalMarks, passingScore, visibility, retakeRules } = req.body;
    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const { assessmentPayload, warnings } = await buildGlobalAssessmentTemplate({
      subject,
      name,
      description,
      duration,
      totalMarks,
      passingScore,
      visibility,
      retakeRules,
    });

    res.json({ template: assessmentPayload, warnings });
  } catch (error) {
    console.error("Get assessment template error:", error);
    res.status(500).json({ message: error.message || "Unable to build assessment template" });
  }
};

const updateAssessment = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  console.log("=== CREATE ASSESSMENT STARTED ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  console.log("Request user:", req.user);
  console.log("Request headers:", req.headers);
  try {
    const { id } = req.params;
    const payload = req.body;

    if (payload.parts) {
      const structureValidation = validateAssessmentStructure(payload.parts);
      if (!structureValidation.valid) {
        return res.status(400).json({ message: structureValidation.message });
      }
    }

    const assessment = await AssessmentModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }
    res.json({ assessment });
  } catch (error) {
    console.error("Assessment update error", error);
    res.status(500).json({ message: "Unable to update assessment" });
  }
};

const getAssessments = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  try {
    const { type, subject, courseId, visibility } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (subject) filter.subject = subject;
    if (courseId) filter.courseId = courseId;
    if (visibility !== undefined) filter.visibility = visibility === "true";

    const assessments = await AssessmentModel.find(filter);
    res.json({ assessments });
  } catch (error) {
    console.error("Assessment fetch error", error);
    res.status(500).json({ message: "Unable to fetch assessments" });
  }
};

const getPublicGlobalAssessments = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  try {
    console.error('[DEBUG] getPublicGlobalAssessments called; isMongoConnected=', connectDB.isMongoConnected?.(), 'mongooseState=', mongoose.connection.readyState);
    const assessments = await AssessmentModel.find({ type: "global", visibility: true, status: "published" });
    const grouped = groupGlobalAssessmentsBySubject(assessments);
    res.json({ assessments: grouped });
  } catch (error) {
    console.error("Public global assessments fetch error", error);
    res.status(500).json({ message: "Unable to fetch public assessments" });
  }
};

const groupGlobalAssessmentsBySubject = (assessments = []) => {
  const grouped = new Map();

  for (const assessment of assessments) {
    const assessmentData = assessment && typeof assessment.toObject === "function" ? assessment.toObject() : { ...assessment };
    const subjectKey = normalizeSubjectKey(assessmentData.subject) || String(assessmentData.subject || assessmentData.displayName || assessmentData.name || "").trim().toLowerCase();
    if (!subjectKey) {
      grouped.set(assessmentData._id?.toString() || `${Math.random()}`, { ...assessmentData });
      continue;
    }

    const existing = grouped.get(subjectKey);
    if (!existing) {
      grouped.set(subjectKey, {
        ...assessmentData,
        parts: Array.isArray(assessmentData.parts) ? [...assessmentData.parts] : [],
      });
      continue;
    }

    existing._id = existing._id || assessmentData._id || assessmentData.id;
    if (!existing.subject) existing.subject = assessmentData.subject;
    if (!existing.name) existing.name = assessmentData.name;
    if (!existing.displayName) existing.displayName = assessmentData.displayName;
    if (!existing.description) existing.description = assessmentData.description;
    const existingParts = Array.isArray(existing.parts) ? [...existing.parts] : [];
    const incomingParts = Array.isArray(assessmentData.parts) ? assessmentData.parts : [];

    for (const part of incomingParts) {
      const partKey = String(part.partType || part.type || part.partName || part.name || "").toLowerCase();
      const existingIndex = existingParts.findIndex((p) => String(p.partType || p.type || p.partName || p.name || "").toLowerCase() === partKey);

      if (existingIndex === -1) {
        existingParts.push(part);
        continue;
      }

      const existingPart = existingParts[existingIndex];
      const mergedSections = [];
      const seenSectionKeys = new Set();
      const addSections = (sections) => {
        if (!Array.isArray(sections)) return;
        for (const section of sections) {
          const sectionKey = String(section.key || section.name || section.sectionName || "").toLowerCase();
          if (!sectionKey) {
            mergedSections.push(section);
            continue;
          }
          if (seenSectionKeys.has(sectionKey)) continue;
          seenSectionKeys.add(sectionKey);
          mergedSections.push(section);
        }
      };

      addSections(existingPart.sections);
      addSections(part.sections);

      existingPart.sections = mergedSections;
      existingPart.totalQuestions = Math.max(Number(existingPart.totalQuestions) || 0, Number(part.totalQuestions) || 0, mergedSections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0));
      existingPart.totalMarks = Math.max(Number(existingPart.totalMarks) || 0, Number(part.totalMarks) || 0, mergedSections.reduce((sum, section) => sum + (Number(section.totalMarks) || 0), 0));
      existingPart.duration = existingPart.duration || part.duration;
      existingPart.instructions = existingPart.instructions || part.instructions;
    }

    existing.parts = existingParts;
    existing.totalQuestions = existingParts.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0);
    existing.totalMarks = Math.max(Number(existing.totalMarks) || 0, existingParts.reduce((sum, part) => sum + (Number(part.totalMarks) || 0), 0));
    existing.price = existing.price || assessment.price;
    existing.visibility = existing.visibility || assessment.visibility;
    existing.status = existing.status || assessment.status;
    existing.name = existing.name || assessment.name;
    existing.displayName = existing.displayName || assessment.displayName;
    existing.description = existing.description || assessment.description;
    existing.subject = existing.subject || assessment.subject;

    const partOrder = { objective: 1, theory: 2, oral: 3, practical: 4 };
    existing.parts.sort((a, b) => {
      const aKey = String(a.partType || a.type || a.partName || a.name || "").toLowerCase();
      const bKey = String(b.partType || b.type || b.partName || b.name || "").toLowerCase();
      return (partOrder[aKey] || 99) - (partOrder[bKey] || 99);
    });

    grouped.set(subjectKey, existing);
  }

  return Array.from(grouped.values()).map((assessment) => ({
    ...assessment,
    totalQuestions: assessment.parts?.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0) || assessment.totalQuestions,
    totalMarks: assessment.totalMarks || assessment.parts?.reduce((sum, part) => sum + (Number(part.totalMarks) || 0), 0) || 0,
    allowedParts: assessment.allowedParts?.length ? assessment.allowedParts : assessment.parts?.map((_, index) => String.fromCharCode(65 + index)),
  }));
};

const selectPreferredAssessment = (assessments = []) => {
  if (!Array.isArray(assessments) || !assessments.length) return null;
  return [...assessments].sort((a, b) => {
    const aParts = Array.isArray(a.parts) ? a.parts.length : 0;
    const bParts = Array.isArray(b.parts) ? b.parts.length : 0;
    if (aParts !== bParts) return bParts - aParts;
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  })[0];
};

const getAssessmentById = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  try {
    const { id } = req.params;

    // Handle special case for "global" - return all global assessments
    if (id === "global") {
      const assessments = await AssessmentModel.find({ type: "global", visibility: true, status: "published" });
      return res.json({ assessments: groupGlobalAssessmentsBySubject(assessments) });
    }

    // Check if id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const assessment = await AssessmentModel.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Ensure allowedParts is set for backward compatibility
    const assessmentData = assessment.toObject();
    if (!assessmentData.allowedParts || !assessmentData.allowedParts.length) {
      assessmentData.allowedParts = assessmentData.parts?.map((_, index) => String.fromCharCode(65 + index)) || ["A", "B"];
    }

    assessmentData.timeLimit = assessmentData.duration;
    res.json({ assessment: assessmentData });
  } catch (error) {
    console.error("Assessment fetch error", error);
    res.status(500).json({ message: "Unable to fetch assessment" });
  }
};

const startAssessment = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
  const AssessmentAttemptModel = getAssessmentAttemptModel();
  const startLog = `startAssessment invoked: DEBUG_ASSESSMENT_LOAD=${process.env.DEBUG_ASSESSMENT_LOAD} params=${JSON.stringify(req.params)} userId=${req.user?.id || req.user?._id}`;
  console.error('[LOG startAssessment]', startLog);
  appendStartAssessmentDebug(startLog);
  try {
    const { assessmentId } = req.params;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const assessment = await AssessmentModel.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Check enrollment and subscription access for global assessments
    if (assessment.type === "global") {
      let enrollment = await AssessmentEnrollmentModel.findOne({
        assessmentId,
        studentId,
        accessGranted: true,
      });

      if (enrollment) {
        if (enrollment.subscriptionStatus === "expired" || enrollment.subscriptionStatus === "cancelled") {
          return res.status(403).json({
            message: "Your subscription has expired or been cancelled. Please renew to continue.",
          });
        }

        if (enrollment.expiryDate && new Date() > enrollment.expiryDate) {
          enrollment.subscriptionStatus = "expired";
          await enrollment.save().catch((err) => console.error("Failed to update enrollment status", err));
          return res.status(403).json({
            message: `Your ${enrollment.subscriptionType || "subscription"} subscription expired on ${enrollment.expiryDate.toLocaleDateString()}. Please renew to continue.`,
            requiresPayment: true,
            subscriptionStatus: "expired",
            expiryDate: enrollment.expiryDate,
          });
        }
      } else {
        if (assessment.price === 0 || assessment.price === undefined) {
          enrollment = await AssessmentEnrollmentModel.create({
            assessmentId,
            studentId,
            enrolledDate: new Date(),
            accessGranted: true,
            subscriptionType: "free",
            subscriptionStatus: "active",
          });
        } else {
          return res.status(402).json({
            message: "You must enroll in this assessment first. Please complete the payment.",
            requiresPayment: true,
            assessmentId,
            price: assessment.price,
          });
        }
      }
    } else if (assessment.type === "course") {
      // Check course enrollment
      const Enrollment = getModel("Enrollment");
      const courseEnrollment = await Enrollment.findOne({
        courseId: assessment.courseId,
        student: studentId,
      });

      if (!courseEnrollment) {
        return res.status(403).json({ message: "Not enrolled in this course" });
      }
    }

    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const assessmentData = JSON.parse(JSON.stringify(assessment));
    const questionsData = {
      parts: [],
    };

    // Count previous attempts by this student for rotation offset
    const previousAttemptsCount = await AssessmentAttemptModel.countDocuments({ assessmentId, studentId }).catch(() => 0);

    for (const part of assessmentData.parts) {
      const partData = { ...part, sections: [] };

      for (const section of part.sections) {
        const requestedQuestionCount = Number(section.questionCount);
        if (!Number.isInteger(requestedQuestionCount) || requestedQuestionCount <= 0) {
          return res.status(400).json({
            message: `Invalid configured questionCount for section "${section.name || section.key}" of part "${part.partName || part.type}". Please configure a positive integer count.`,
          });
        }

        let effectiveQuestionCount = requestedQuestionCount;
        try {
          console.error(`[DEBUG startAssessment] Checking availability for section="${section.name || section.key}" part="${part.partName || part.type}" bankPath="${section.bankPath || ''}"`);
          const availableQuestions = await countAvailableQuestionsForSection(assessmentData.subject, part.partType, section);
          console.error(`[DEBUG startAssessment] availableQuestions=${availableQuestions}`);
          if (availableQuestions === 0) {
            return res.status(400).json({
              message: `No questions available for section "${section.name || section.key}" of part "${part.partName || part.type}". Ensure the configured question bank contains at least ${requestedQuestionCount} questions.`,
            });
          }
          if (availableQuestions > 0 && requestedQuestionCount > availableQuestions) {
            effectiveQuestionCount = availableQuestions;
            console.error(`[WARN] Section "${section.name || section.key}" requested ${requestedQuestionCount} questions but only ${availableQuestions} are available. Using ${effectiveQuestionCount} questions.`);
          }
        } catch (availabilityError) {
          console.error(`Failed to determine available questions for section "${section.name || section.key}":`, availabilityError.message);
        }

        const sectionToLoad = {
          ...section,
          questionCount: effectiveQuestionCount,
        };

        console.error(`[DEBUG startAssessment] loadQuestionsFromDatabase assessmentId=${assessmentId} partName=${part.partName} sectionName=${section.name} count=${effectiveQuestionCount}`);
        let questions = await loadQuestionsFromDatabase(assessmentId, part.partName, section.name, effectiveQuestionCount);
        console.error(`[DEBUG startAssessment] databaseQuestions=${questions.length}`);
        if (!questions.length) {
          console.error(`[DEBUG startAssessment] loadSectionQuestions subject=${assessmentData.subject} partType=${part.partType} section=${JSON.stringify(sectionToLoad)}`);
            questions = await loadSectionQuestions(
              assessmentData.subject,
              part.partType,
              sectionToLoad,
              undefined,
              { assessmentId, studentId, previousAttemptsCount }
            );
          console.error(`[DEBUG startAssessment] sectionQuestions=${questions.length}`);
        }
        if (!questions.length && section.bankPath) {
          console.error(`[DEBUG startAssessment] loadQuestionsFromBank bankPath=${section.bankPath} count=${effectiveQuestionCount}`);
          questions = await loadQuestionsFromBank(section.bankPath, effectiveQuestionCount);
          console.error(`[DEBUG startAssessment] bankQuestions=${questions.length}`);
        }
        if (!questions.length) {
          return res.status(400).json({
            message: `No questions available for section "${section.name || section.key}" of part "${part.partName || part.type}". Ensure the configured question bank contains at least ${effectiveQuestionCount} questions.`,
          });
        }
        if (questions.length < effectiveQuestionCount) {
          return res.status(400).json({
            message: `Not enough questions available for section "${section.name || section.key}". Expected ${effectiveQuestionCount}, found ${questions.length}.`,
          });
        }
        partData.sections.push({
          ...section,
          questionCount: effectiveQuestionCount,
          questions,
        });
      }

      questionsData.parts.push(partData);
    }

    const oralMeta = (questionsData.parts || [])
      .flatMap((part) => part.sections || [])
      .map((section) => section.questions)
      .find((questionsArray) => questionsArray && questionsArray._oralMeta)?._oralMeta || {};

    const normalizedQuestions = questionsData.parts.flatMap((part, partIndex) =>
      part.sections.flatMap((section, sectionIndex) =>
        section.questions.map((question) => ({
          ...question,
          partName: part.partName || part.name || `Part ${partIndex + 1}`,
          sectionName: section.name || section.sectionName || `Section ${sectionIndex + 1}`,
          questionId: getQuestionId(question),
        }))
      )
    ).map((question, index) => ({
      ...question,
      questionIndex: index,
    }));

    // Final safety shuffle/rotation per-section in case questions were loaded from DB in canonical order.
    try {
      const perPartSections = questionsData.parts || [];
      perPartSections.forEach((part, pIdx) => {
        (part.sections || []).forEach((section) => {
          try {
            const N = (section.questions || []).length;
            const k = Number(section.questionCount) || N;
            const prev = Number(previousAttemptsCount) || 0;
            if (!N) return;
            if (N <= k) {
              const shuffledFull = shuffleArray(section.questions || []);
              const offsetFull = prev % N;
              const rotated = shuffledFull.slice(offsetFull).concat(shuffledFull.slice(0, offsetFull));
              section.questions = rotated.slice(0, k);
            } else {
              const shuffled = shuffleArray(section.questions || []);
              const offset = (prev * k) % N;
              const selected = [];
              for (let i = 0; i < k; i++) selected.push(shuffled[(offset + i) % N]);
              section.questions = selected;
            }
          } catch (e) {
            // ignore per-section shuffle errors
          }
        });
      });
      // Recompute normalizedQuestions after shuffling
      // (flatten again to reflect updated section.question orders)
      const recomputed = questionsData.parts.flatMap((part, partIndex) =>
        part.sections.flatMap((section, sectionIndex) =>
          section.questions.map((question) => ({
            ...question,
            partName: part.partName || part.name || `Part ${partIndex + 1}`,
            sectionName: section.name || section.sectionName || `Section ${sectionIndex + 1}`,
            questionId: getQuestionId(question),
          }))
        )
      ).map((question, index) => ({
        ...question,
        questionIndex: index,
      }));
      // Use recomputed
      for (let i = 0; i < recomputed.length; i++) normalizedQuestions[i] = recomputed[i] || normalizedQuestions[i];
    } catch (e) {
      console.error('Final per-section shuffle failed', e && e.message);
    }

    const attemptTotalMarks = Number(assessment.totalMarks) || normalizedQuestions.reduce((sum, question) => {
      const questionMarks = Number(question.totalMarks || question.marks);
      return sum + (Number.isFinite(questionMarks) && questionMarks > 0 ? questionMarks : 1);
    }, 0);

    const attemptPayload = {
      assessmentType: "standard",
      assessmentTypeRef: "StandardAssessment",
      assessmentId,
      studentId,
      courseId: assessment.courseId,
      status: "in-progress",
      sessionToken,
      ipAddress,
      startedAt: new Date(),
      duration: Number(assessment.duration) || 0,
      timeLeft: (Number(assessment.duration) || 0) * 60,
      totalMarks: attemptTotalMarks,
      questions: normalizedQuestions,
      total: normalizedQuestions.length,
      fullAudio: oralMeta.full_audio || null,
      oralType: oralMeta.oralType || null,
      oralYear: oralMeta.oralYear || null,
    };
    console.error('[DEBUG startAssessment] attemptPayload keys=', Object.keys(attemptPayload));
    console.error('[DEBUG startAssessment] attemptPayload sample=', JSON.stringify({
      assessmentType: attemptPayload.assessmentType,
      assessmentTypeRef: attemptPayload.assessmentTypeRef,
      duration: attemptPayload.duration,
      totalMarks: attemptPayload.totalMarks,
      questions: attemptPayload.questions.length,
    }, null, 2));
    appendStartAssessmentDebug(`attemptPayload ${JSON.stringify({
      assessmentType: attemptPayload.assessmentType,
      assessmentTypeRef: attemptPayload.assessmentTypeRef,
      duration: attemptPayload.duration,
      totalMarks: attemptPayload.totalMarks,
      questions: attemptPayload.questions.length,
    })}`);
    try {
      console.error('[DEBUG startAssessment] attemptPayload questionOrder:', (attemptPayload.questions || []).map(q => String(q.questionId || q.id || q._id || q.text).slice(0,40)));
    } catch (e) {}

    const attemptWithQuestions = await AssessmentAttemptModel.create(attemptPayload);

    try {
      console.error('[DEBUG afterCreate] raw attemptWithQuestions.questionOrder:', (attemptWithQuestions.questions || []).map(q => String(q.questionId || q.id || q._id || q.text).slice(0,40)));
      appendStartAssessmentDebug(`afterCreate raw ${JSON.stringify((attemptWithQuestions.questions || []).map(q => String(q.questionId || q.id || q._id || q.text)))}`);
    } catch (e) { console.error('[DEBUG afterCreate] error logging raw', e); }

    const sanitizedAttempt = attemptWithQuestions.toObject ? attemptWithQuestions.toObject() : { ...attemptWithQuestions };
    try {
      sanitizedAttempt._debugSavedOrder = (attemptWithQuestions.questions || []).map(q => String(q.questionId || q.id || q._id || q.text));
      sanitizedAttempt._debugAttemptPayloadOrder = (attemptPayload && attemptPayload.questions) ? (attemptPayload.questions || []).map(q => String(q.questionId || q.id || q._id || q.text)) : [];
    } catch (e) {}
    sanitizedAttempt.questions = removeQuestionAnswers(sanitizedAttempt.questions || []);
    const safeQuestionsData = {
      parts: questionsData.parts.map((part) => ({
        ...part,
        sections: (part.sections || []).map((section) => ({
          ...section,
          questions: removeQuestionAnswers(section.questions || []),
        })),
      })),
    };

    // Build a simple question order list for debugging/verification
    const questionOrder = (sanitizedAttempt.questions || []).map((q, idx) => {
      return String(q.questionId || q.id || q._id || q.text?.slice(0, 40) || `q_${idx}`);
    });

    const debugEnabled = (process.env.DEBUG_ASSESSMENT_LOAD === '1' || String(process.env.DEBUG_ASSESSMENT_LOAD).toLowerCase() === 'true')
      || req?.query?.debug === '1'
      || (req?.headers && (req.headers['x-debug-assessment-load'] === '1' || req.headers['x-debug-assessment-load'] === 'true'));

    if (debugEnabled) {
      console.error(`[DEBUG startAssessment] Question order for attempt (student=${studentId}, assessment=${assessmentId}):`, questionOrder);
    }

    const responsePayload = {
      attempt: sanitizedAttempt,
      assessmentData,
      questionsData: safeQuestionsData,
      sessionToken,
      fullAudio: oralMeta.full_audio || null,
      oralType: oralMeta.oralType || null,
      oralYear: oralMeta.oralYear || null,
    };

    // Include questionOrder in response when debug flag is enabled to aid verification
    if (debugEnabled) {
      const attemptPayloadOrder = (attemptPayload.questions || []).map(q => String(q.questionId || q.id || q._id || q.text));
      const savedAttemptOrder = (attemptWithQuestions && attemptWithQuestions.questions) ? (attemptWithQuestions.questions || []).map(q => String(q.questionId || q.id || q._id || q.text)) : [];
      responsePayload.debug = { questionOrder, attemptPayloadOrder, savedAttemptOrder };
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("Start assessment error", error && (error.stack || error));
    appendStartAssessmentDebug(`Error in startAssessment: ${error && error.message}`);
    appendStartAssessmentDebug(`Stack: ${error && error.stack}`);
    const responsePayload = { message: "Unable to start assessment", error: error && error.message, stack: error && error.stack };
    res.status(500).json(responsePayload);
  }
};

const findSubjectAssessment = async (subject) => {
  const AssessmentModel = getAssessmentModel();
  const normalized = normalizeSubjectKey(subject) || String(subject || "").trim().toLowerCase();
  if (!normalized) return null;

  const assessments = await AssessmentModel.find({
    type: "global",
    visibility: true,
    status: "published",
    $or: [
      { subject: normalized },
      { subject: { $regex: new RegExp(`^${escapeRegExp(subject)}$`, "i") } },
      { name: { $regex: new RegExp(`^${escapeRegExp(subject)}$`, "i") } },
      { displayName: { $regex: new RegExp(`^${escapeRegExp(subject)}$`, "i") } },
    ],
  });

  if (!assessments || assessments.length === 0) {
    console.error(`[DEBUG] findSubjectAssessment("${subject}") -> normalized="${normalized}", found=0`);
    return null;
  }

  const normalizeAssessmentKey = (assessment) => {
    return [assessment.subject, assessment.name, assessment.displayName]
      .filter(Boolean)
      .map((value) => normalizeSubjectKey(value))
      .find(Boolean);
  };

  const isSubjectMatch = (assessment) => {
    const subjectKey = normalizeSubjectKey(assessment.subject);
    const nameKey = normalizeSubjectKey(assessment.name);
    const displayKey = normalizeSubjectKey(assessment.displayName);
    return subjectKey === normalized || nameKey === normalized || displayKey === normalized;
  };

  const compareAssessments = (a, b) => {
    const aHasParts = Array.isArray(a.parts) && a.parts.length > 0;
    const bHasParts = Array.isArray(b.parts) && b.parts.length > 0;
    if (aHasParts !== bHasParts) return aHasParts ? -1 : 1;

    const aPrice = Number(a.price) || 0;
    const bPrice = Number(b.price) || 0;
    if (aPrice !== bPrice) return bPrice - aPrice;

    const aParts = Array.isArray(a.parts) ? a.parts.length : 0;
    const bParts = Array.isArray(b.parts) ? b.parts.length : 0;
    if (aParts !== bParts) return bParts - aParts;

    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  };

  const subjectMatches = assessments.filter(isSubjectMatch);
  console.error(`[DEBUG] findSubjectAssessment("${subject}") -> subjectMatches=${subjectMatches.length}`);
  subjectMatches.forEach((item) => {
    console.error(`[DEBUG]   match id=${item._id} subject=${item.subject} name=${item.name} parts=${Array.isArray(item.parts)?item.parts.length:'?'} price=${item.price}`);
  });

  let selected = subjectMatches.length > 0
    ? [...subjectMatches].sort(compareAssessments)[0]
    : selectPreferredAssessment(assessments);

  if (selected && (!Array.isArray(selected.parts) || selected.parts.length === 0)) {
    const subjectMatchesWithParts = subjectMatches.filter((assessment) => Array.isArray(assessment.parts) && assessment.parts.length > 0);
    console.error(`[DEBUG] subjectMatchesWithParts=${subjectMatchesWithParts.length}`);
    subjectMatchesWithParts.forEach((item) => {
      console.error(`[DEBUG]   parts match id=${item._id} subject=${item.subject} name=${item.name} parts=${Array.isArray(item.parts)?item.parts.length:'?'} price=${item.price}`);
    });
    if (subjectMatchesWithParts.length > 0) {
      selected = [...subjectMatchesWithParts].sort(compareAssessments)[0];
    }
  }

  console.error(`[DEBUG] findSubjectAssessment("${subject}") -> normalized="${normalized}", found=${assessments.length}, selectedId=${selected?._id}`);
  return selected;
};

const getAssessmentBySubject = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  try {
    console.error('[DEBUG] getAssessmentBySubject called; isMongoConnected=', connectDB.isMongoConnected?.(), 'mongooseState=', mongoose.connection.readyState);
    const subject = req.params.subject;
    console.error('[DEBUG] subject param:', subject);
    const normalized = normalizeSubjectKey(subject);
    console.error('[DEBUG] normalized:', normalized);
    if (!normalized) {
      return res.status(404).json({ message: "Subject not found" });
    }

    console.error('[DEBUG] finding assessment...');
    const assessment = await findSubjectAssessment(normalized);
    console.error('[DEBUG] assessment:', !!assessment);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found for this subject" });
    }

    let effectiveAssessment = assessment;
    if (!Array.isArray(effectiveAssessment.parts) || effectiveAssessment.parts.length === 0) {
      try {
        const templateResult = await buildGlobalAssessmentTemplate({
          subject: effectiveAssessment.subject || normalized,
          name: effectiveAssessment.name,
          description: effectiveAssessment.description,
          duration: effectiveAssessment.duration,
          totalMarks: effectiveAssessment.totalMarks,
          passingScore: effectiveAssessment.passingScore,
          visibility: effectiveAssessment.visibility,
        });
        if (templateResult && Array.isArray(templateResult.assessmentPayload?.parts) && templateResult.assessmentPayload.parts.length) {
          effectiveAssessment = {
            ...effectiveAssessment.toObject?.() || effectiveAssessment,
            parts: templateResult.assessmentPayload.parts,
            totalQuestions: templateResult.assessmentPayload.totalQuestions,
            totalMarks: templateResult.assessmentPayload.totalMarks,
            allowedParts: templateResult.assessmentPayload.parts.map((_, index) => String.fromCharCode(65 + index)),
          };
          console.error('[DEBUG] getAssessmentBySubject fallback to inferred assessment parts');
        }
      } catch (fallbackErr) {
        console.error('[WARN] getAssessmentBySubject fallback build template failed:', fallbackErr.message);
      }
    }

    const metadata = {
      _id: effectiveAssessment._id,
      name: effectiveAssessment.name,
      description: effectiveAssessment.description,
      subject: normalized,
      displayName: effectiveAssessment.displayName || normalized,
      price: effectiveAssessment.price || 0,
      subscription: effectiveAssessment.subscription || "monthly",
      status: effectiveAssessment.status || "published",
      duration: effectiveAssessment.duration,
      timeLimit: effectiveAssessment.duration,
      totalQuestions: effectiveAssessment.totalQuestions || (Array.isArray(effectiveAssessment.parts) ? effectiveAssessment.parts.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0) : 0),
      totalMarks: effectiveAssessment.totalMarks || 100,
      passingScore: effectiveAssessment.passingScore || 50,
      visibility: effectiveAssessment.visibility,
      allowedParts: effectiveAssessment.allowedParts || [],
      parts: effectiveAssessment.parts && effectiveAssessment.parts.length > 0 ? effectiveAssessment.parts : [],
    };

    const warnings = [];
    for (const part of metadata.parts) {
      const partType = part.partType || part.type || 'objective';
      let partHasQuestions = false;
      for (const section of part.sections || []) {
        try {
          const candidateTypes = partType ? [partType] : ["objective", "theory", "oral", "practical"];
          let fileCheck = null;
          let resolvedType = candidateTypes[0];

          for (const t of candidateTypes) {
            const fc = await checkQuestionFilesExist(normalized, t, section.files);
            if (fc.anyExists) {
              fileCheck = fc;
              resolvedType = t;
              break;
            }
            // keep the last checked as fallback
            fileCheck = fc;
          }

          if (!fileCheck.anyExists) {
            const expectedFiles = Array.isArray(section.files) && section.files.length ? section.files.join(", ") : "questions.json";
            const warningMsg = `No question file found for ${part.partName || part.title} / ${section.name || section.key || "section"} in ${normalized} ${resolvedType} folders. Expected files: ${expectedFiles}.`;
            warnings.push(warningMsg);
          }

          const availableQuestions = await countAvailableQuestionsForSection(normalized, resolvedType, section);
          section.availableQuestions = availableQuestions;

          if (Number(section.questionCount) > 0) {
            section.questionCount = Number(section.questionCount);
          } else {
            section.questionCount = availableQuestions;
          }

          if (availableQuestions > 0 && section.questionCount > availableQuestions) {
            warnings.push(`Section ${section.name || section.key} has only ${availableQuestions} available questions but is configured for ${section.questionCount}.`);
            section.questionCount = availableQuestions;
          } else if (availableQuestions > 0 && section.questionCount < availableQuestions) {
            warnings.push(`Section ${section.name || section.key} has ${availableQuestions} available questions; configured count ${section.questionCount} will be used.`);
          }
          if (availableQuestions > 0) {
            partHasQuestions = true;
          }
        } catch (fileCheckError) {
          console.warn(`Error checking question files for ${normalized}:`, fileCheckError.message);
          section.availableQuestions = Number(section.availableQuestions || 0);
        }
      }

      part.available = partHasQuestions;
      part.totalQuestions = (part.sections || []).reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
    }

    metadata.parts = metadata.parts || [];
    metadata.available = metadata.parts.some((part) => part.available);
    metadata.totalQuestions = metadata.parts.reduce((sum, part) => sum + (Number(part.totalQuestions) || 0), 0);

    if (warnings.length) {
      metadata.questionWarnings = warnings;
    }

    let userId = req.user?.id || req.user?._id;
    if (!userId && req.headers?.authorization && process.env.JWT_SECRET) {
      try {
        const token = String(req.headers.authorization).replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id;
      } catch (error) {
        userId = null;
      }
    }

    if (userId) {
      const enrollment = await findActiveAssessmentEnrollment({
        studentId: userId,
        assessmentId: metadata._id,
        subject: normalized,
      });
      metadata.isEnrolledAssessment = Boolean(enrollment);
      metadata.enrollmentExpiry = enrollment?.expiresAt || enrollment?.expiryDate || null;
    } else {
      metadata.isEnrolledAssessment = false;
    }

    res.json({ message: "Subject assessment metadata retrieved successfully", assessment: metadata });
  } catch (error) {
    console.error("Get assessment by subject error", error);
    res.status(500).json({ message: "Unable to fetch subject assessment metadata" });
  }
};

const getAvailableOralTypes = async (req, res) => {
  try {
    const subject = req.params.subject;
    const normalized = normalizeSubjectKey(subject);
    if (!normalized) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const types = await getAvailableOralTypesForSubject(normalized);
    if (!types.length) {
      return res.status(404).json({ message: "No oral exam types available for this subject" });
    }

    res.json({ message: "Oral exam types retrieved successfully", types });
  } catch (error) {
    console.error("Get available oral types error", error);
    res.status(500).json({ message: "Unable to fetch oral exam types" });
  }
};

const startAssessmentBySubject = async (req, res) => {
  const AssessmentModel = getAssessmentModel();
  const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
  const AssessmentAttemptModel = getAssessmentAttemptModel();
  console.error(`\n========== ENDPOINT HIT: POST /assessments/global/subject/${req.params.subject}/start ==========\n`);
  try {
    const subject = req.params.subject;
    console.error(`[LOG] Subject: ${subject}`);
    console.error(`[LOG] Full Auth Header:`, req.headers.authorization);
    console.error(`[LOG] User info (from JWT middleware):`, JSON.stringify(req.user, null, 2));
    console.error(`[LOG] req.user.id:`, req.user?.id);
    console.error(`[LOG] req.user._id:`, req.user?._id);
    console.error(`[LOG] Request body:`, JSON.stringify(req.body, null, 2));
    
    const normalized = normalizeSubjectKey(subject);
    if (!normalized) {
      console.error(`[LOG] Subject not normalized for: ${subject}`);
      return res.status(404).json({ message: "Subject not found" });
    }

    let assessment = null;
    if (req.body && req.body.assessmentId) {
      try {
        assessment = await AssessmentModel.findById(req.body.assessmentId);
        console.error(`[LOG] Loaded assessment by id from request body: ${req.body.assessmentId} -> ${assessment ? assessment._id : 'not found'}`);
      } catch (err) {
        console.error(`[LOG] Invalid assessmentId in request body: ${req.body.assessmentId}`, err && err.message);
      }
    }

    if (!assessment) {
      assessment = await findSubjectAssessment(normalized);
      console.error(`[LOG] Loaded assessment by subject lookup: ${normalized} -> ${assessment ? assessment._id : 'not found'}`);
    }

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not available" });
    }

    if (!Array.isArray(assessment.parts) || assessment.parts.length === 0) {
      try {
        const templateResult = await buildGlobalAssessmentTemplate({
          subject: assessment.subject || normalized,
          name: assessment.name,
          description: assessment.description,
          duration: assessment.duration,
          totalMarks: assessment.totalMarks,
          passingScore: assessment.passingScore,
          visibility: assessment.visibility,
        });
        if (templateResult && Array.isArray(templateResult.assessmentPayload?.parts) && templateResult.assessmentPayload.parts.length) {
          assessment = {
            ...assessment.toObject?.() || assessment,
            parts: templateResult.assessmentPayload.parts,
            totalQuestions: templateResult.assessmentPayload.totalQuestions,
            totalMarks: templateResult.assessmentPayload.totalMarks,
            allowedParts: templateResult.assessmentPayload.parts.map((_, index) => String.fromCharCode(65 + index)),
          };
          console.error('[DEBUG] startAssessmentBySubject fallback to inferred assessment parts');
        }
      } catch (fallbackErr) {
        console.error('[WARN] startAssessmentBySubject fallback build template failed:', fallbackErr.message);
      }
    }

    const studentId = req.user?.id || req.user?._id;
    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check enrollment for global assessment
    let enrollment = await AssessmentEnrollmentModel.findOne({
      assessmentId: assessment._id,
      studentId,
      accessGranted: true,
    });


      // Check if enrollment exists and subscription is still valid
      if (enrollment) {
        // Check subscription status
        if (enrollment.subscriptionStatus === "expired" || enrollment.subscriptionStatus === "cancelled") {
          console.error(`[LOG] Subscription ${enrollment.subscriptionStatus} for student ${studentId}`);
          return res.status(403).json({ 
            message: `Your ${enrollment.subscriptionType} subscription has ${enrollment.subscriptionStatus}. Please renew your subscription to continue.`,
            requiresPayment: true,
            subscriptionStatus: enrollment.subscriptionStatus,
          });
        }
      
        // Check if expiry date has passed
        if (enrollment.expiryDate && new Date() > enrollment.expiryDate) {
          enrollment.subscriptionStatus = "expired";
          await enrollment.save().catch(err => console.error("Failed to update enrollment status", err));
          console.error(`[LOG] Subscription expired for student ${studentId}`);
          return res.status(403).json({ 
            message: `Your ${enrollment.subscriptionType} subscription expired on ${enrollment.expiryDate.toLocaleDateString()}. Please renew to continue.`,
            requiresPayment: true,
            subscriptionStatus: "expired",
            expiryDate: enrollment.expiryDate,
          });
        }
        console.error(`[LOG] Valid enrollment found for student ${studentId}. Subscription active until ${enrollment.expiryDate?.toLocaleDateString() || "never"}`);
      } else {
        // Auto-enroll if not already enrolled (for free assessments)
        if (assessment.price === 0 || assessment.price === undefined) {
          enrollment = await AssessmentEnrollmentModel.create({
            assessmentId: assessment._id,
            studentId,
            enrolledDate: new Date(),
            accessGranted: true,
            subscriptionType: "free",
            subscriptionStatus: "active",
          });
          console.error(`[LOG] Auto-created free assessment enrollment for student ${studentId}`);
        } else {
          // For paid assessments, require enrollment/payment
          console.error(`[LOG] Student ${studentId} not enrolled in paid assessment ${assessment._id}`);
          return res.status(402).json({ 
            message: `You must enroll in this assessment first. Please complete the payment.`,
            requiresPayment: true,
            assessmentId: assessment._id,
            price: assessment.price,
          });
        }
      }
    const selectedPart = (req.body.selectedPart || "A").toString().toUpperCase();
    const partIndex = Math.max(0, Math.min(25, selectedPart.charCodeAt(0) - 65));
    const part = assessment.parts?.[partIndex] || assessment.parts?.[0];

    let selectedQuestions = [];
    let timeLimit = assessment.duration;
    let oralMeta = {};

    // Count previous attempts for rotation-aware selection
    let previousAttemptsCount = 0;
    try {
      previousAttemptsCount = await AssessmentAttemptModel.countDocuments({ assessmentId: assessment._id, studentId });
      console.error(`[DEBUG] previousAttemptsCount for student ${studentId}, assessment ${assessment._id}:`, previousAttemptsCount);
    } catch (err) {
      console.error('Failed to count previous attempts for rotation:', err && err.message);
      previousAttemptsCount = 0;
    }

    if (part) {
      const partType = part.partType || part.type || "objective";
      console.error(`[DEBUG] Loading questions for part: ${partType}, sections: ${part.sections?.length}`);
      const sectionLoads = [];

      // If client provided explicit essay selection for theory, attempt to load that single essay question directly
      if (String(partType || "").trim().toLowerCase() === "theory" && req.body && req.body.essayType && req.body.essayQuestionId) {
        try {
          const essayTypeRaw = String(req.body.essayType || "").trim().toLowerCase();
          const essayQuestionId = String(req.body.essayQuestionId || "").trim();
          const candidateFiles = [`essay/${essayTypeRaw}/questions.json`, `${essayTypeRaw}/questions.json`, `${essayTypeRaw}.json`];
          const rawQuestions = await loadQuestionsFromNewPath(normalized, partType, 0, candidateFiles);
          const normalizedQs = normalizeQuestionItems(rawQuestions, `${normalized}/theory`);
          const found = normalizedQs.filter((q) => {
            const id = String(q.questionId || q.id || q._id || "");
            return id === essayQuestionId || id.endsWith(essayQuestionId);
          });
          if (found.length) {
            // Use the selected essay question as the sole question for the essay section
            selectedQuestions = normalizeQuestionItems(found.slice(0, 1), normalized);
            console.error(`[DEBUG] Loaded explicit essay question ${essayQuestionId} for subject ${normalized}`);
            // set part duration
            const partDuration = Number(part.duration);
            timeLimit = partDuration > 0 ? partDuration : Number(assessment.duration);
          } else {
            // fallback: try scanning the questions directory for the id
            try {
              const questionsDir = path.join(__dirname, "../questions");
              const foundQ = searchQuestionById(questionsDir, essayQuestionId);
              if (foundQ) {
                selectedQuestions = normalizeQuestionItems([foundQ], normalized);
                console.error(`[DEBUG] Found essay question by scanning files: ${essayQuestionId}`);
                const partDuration = Number(part.duration);
                timeLimit = partDuration > 0 ? partDuration : Number(assessment.duration);
              }
            } catch (err) {
              console.error("Essay scan fallback failed", err.message);
            }
          }
        } catch (err) {
          console.error("Explicit essay load failed:", err.message);
        }
      }

      for (const section of part.sections) {
        console.error(`[DEBUG] Loading section: ${section.name}, questionCount: ${section.questionCount}, files: ${JSON.stringify(section.files)}`);
        // Detect essay-style theory sections (multiple nested files)
        const normalizedTypeForSection = String(partType || "objective").trim().toLowerCase();
        const sectionFileCandidates = Array.isArray(section.files) && section.files.length ? section.files : [];
        // Treat any section with name/key containing 'essay' as an essay section, even if files are not explicit
        const essaySection = normalizedTypeForSection === "theory" && String(section.key || section.name || "").trim().toLowerCase().includes("essay");

        let questions;

        // If this is an essay section and the client provided an essayType, load only that essay group's questions
        if (essaySection && req.body && req.body.essayType) {
          const essayTypeRaw = String(req.body.essayType || "").trim().toLowerCase();
          const essayQuestionId = req.body.essayQuestionId;
          const candidateFiles = [];

          // Prefer matching files from explicit section.files
          for (const f of sectionFileCandidates) {
            try {
              if (String(f || "").toLowerCase().includes(essayTypeRaw)) candidateFiles.push(String(f));
            } catch (e) {
              // ignore
            }
          }

          // Add common fallbacks
          if (!candidateFiles.length) {
            candidateFiles.push(`essay/${essayTypeRaw}/questions.json`);
            candidateFiles.push(`${essayTypeRaw}/questions.json`);
            candidateFiles.push(`${essayTypeRaw}.json`);
          }

          questions = await loadQuestionsFromNewPath(normalized, partType, Number(section.questionCount) || 0, candidateFiles);
          console.error(`[DEBUG] Essay group load: candidateFiles=${JSON.stringify(candidateFiles)}, loadedCount=${(questions||[]).length}, ids=${JSON.stringify((questions||[]).map(q=> String(q.questionId||q.id||q._id||'')).slice(0,10))}`);

          if (essayQuestionId) {
            const found = questions.filter((q) => {
              const id = String(q.questionId || q.id || q._id || "");
              return id === String(essayQuestionId) || id.endsWith(String(essayQuestionId));
            });
            if (!found.length) {
              return res.status(400).json({ message: `Essay question not found for type "${essayTypeRaw}" with id "${essayQuestionId}".` });
            }
            questions = found.slice(0, 1);
          }

        } else if (String(partType || "").trim().toLowerCase() === "oral") {
          questions = await loadOralSectionQuestions(normalized, section, Number(section.questionCount) || 0, req.body.oralType, req.body.oralYear);
        } else {
          questions = await loadSectionQuestions(assessment.subject, partType, section, undefined, { previousAttemptsCount });
        }
        if (!questions.length && section.bankPath) {
          questions = await loadQuestionsFromBank(section.bankPath, Number(section.questionCount) || 0);
        }

        if (!questions.length) {
          return res.status(400).json({
            message: `No questions available for section "${section.name || section.key}" of part "${part.partName || part.type}". Verify section.questionCount and question bank files.`,
          });
        }
        if (questions.length < Number(section.questionCount || 0)) {
          return res.status(400).json({
            message: `Not enough questions available for section "${section.name || section.key}". Expected ${section.questionCount}, found ${questions.length}.`,
          });
        }
        sectionLoads.push({ questions });
      }

      // Apply per-section shuffle/rotation (safety) so repeated starts produce different orders
      try {
        for (let si = 0; si < sectionLoads.length; si += 1) {
          const sec = sectionLoads[si];
          if (!sec || !Array.isArray(sec.questions)) continue;
          const N = sec.questions.length;
          const k = Number((part.sections || [])[si]?.questionCount) || N;
          const prev = Number(previousAttemptsCount) || 0;
          if (!N) continue;
          if (N <= k) {
            const shuffledFull = shuffleArray(sec.questions || []);
            const offsetFull = prev % N;
            const rotated = shuffledFull.slice(offsetFull).concat(shuffledFull.slice(0, offsetFull));
            sec.questions = rotated.slice(0, k);
          } else {
            const shuffled = shuffleArray(sec.questions || []);
            const offset = (prev * k) % N;
            const selected = [];
            for (let i = 0; i < k; i++) selected.push(shuffled[(offset + i) % N]);
            sec.questions = selected;
          }
        }
      } catch (e) {
        console.error('[DEBUG] Per-section safety shuffle failed in startAssessmentBySubject', e && e.message);
      }
      try {
        console.error('[DEBUG] sectionLoads post-shuffle ids=', sectionLoads.map((s, idx) => ({ idx, ids: (s.questions||[]).map(q => getQuestionId(q)) })) );
      } catch (e) {}
      const questionsBySection = sectionLoads.map((item) => item.questions);
      console.error(`[DEBUG] Questions loaded from sections:`, questionsBySection.map((q) => q.length));

      // If the client provided an explicit essayQuestionId, integrate it into the loaded sections
      if (req.body && req.body.essayQuestionId) {
        try {
          const essaySectionIdx = part.sections.findIndex((s) => String(s.key || s.name || "").toLowerCase().includes("essay"));
          const essayId = String(req.body.essayQuestionId || "");
          if (essaySectionIdx !== -1 && essayId) {
            if (selectedQuestions && selectedQuestions.length) {
              sectionLoads[essaySectionIdx].questions = selectedQuestions;
              console.error(`[DEBUG] Replaced essay section ${essaySectionIdx} with explicit selected question(s)`);
            } else {
              // Try to locate the essay question among already-loaded section questions
              let located = false;
              for (let i = 0; i < sectionLoads.length; i += 1) {
                const found = (sectionLoads[i].questions || []).filter((q) => {
                  const id = String(q.questionId || q.id || q._id || "");
                  return id === essayId || id.endsWith(essayId);
                });
                if (found.length) {
                  sectionLoads[essaySectionIdx].questions = found.slice(0, 1);
                  located = true;
                  console.error(`[DEBUG] Located essay question in loaded sections and replaced essay section`);
                  break;
                }
              }

              // As a final fallback, scan question files for the id
              if (!located) {
                try {
                  const questionsDir = path.join(__dirname, "../questions");
                  const foundQ = searchQuestionById(questionsDir, essayId);
                  if (foundQ) {
                    sectionLoads[essaySectionIdx].questions = normalizeQuestionItems([foundQ], normalized);
                    console.error(`[DEBUG] Scanned files and found essay question ${essayId}; replaced essay section`);
                  }
                } catch (err) {
                  console.error("Essay integration scan failed", err.message);
                }
              }
            }
          }
        } catch (err) {
          console.error("Essay integration failed", err.message);
        }
      }

      // Recompute questionsBySection in case we replaced the essay section
      const finalQuestionsBySection = sectionLoads.map((item) => item.questions);
      selectedQuestions = normalizeQuestionItems(finalQuestionsBySection.flat(), normalized);
      const oralMeta = sectionLoads
        .map((item) => item.questions)
        .find((questionsArray) => questionsArray && questionsArray._oralMeta)?._oralMeta || {};
      console.error(`[DEBUG] oralMeta detected:`, JSON.stringify(oralMeta, null, 2));
      console.error(`[DEBUG] After normalization: ${selectedQuestions.length} questions`);
      const partDuration = Number(part.duration);
      timeLimit = partDuration > 0 ? partDuration : Number(assessment.duration);
    }

    // Ensure explicitly chosen essay question is present in final selection
    if (req.body && req.body.essayQuestionId) {
      try {
        const eId = String(req.body.essayQuestionId || "");
        const already = selectedQuestions.some((q) => {
          const id = String(q.questionId || q.id || q._id || "");
          return id === eId || id.endsWith(eId);
        });
        if (!already) {
          // Try to locate essay question in current selections
          let essayIndex = selectedQuestions.findIndex((q) => String(q.sectionName || "").toLowerCase().includes("essay"));
          let chosenQ = null;

          // Search files directly
          try {
            const questionsDir = path.join(__dirname, "../questions");
            const found = searchQuestionById(questionsDir, eId);
            if (found) {
              chosenQ = normalizeQuestionItems([found], normalized)[0];
            }
          } catch (err) {
            // ignore
          }

          // If still not found, attempt loading from specified essay type files
          if (!chosenQ && req.body.essayType) {
            try {
              const et = String(req.body.essayType || "").toLowerCase();
              const candidateFiles = [`essay/${et}/questions.json`, `${et}/questions.json`, `${et}.json`];
              const raw = await loadQuestionsFromNewPath(normalized, "theory", 0, candidateFiles);
              const norm = normalizeQuestionItems(raw, normalized);
              const found2 = norm.find((q) => {
                const id = String(q.questionId || q.id || q._id || "");
                return id === eId || id.endsWith(eId);
              });
              if (found2) chosenQ = found2;
            } catch (err) {
              // ignore
            }
          }

          if (chosenQ) {
            if (essayIndex !== -1) {
              selectedQuestions[essayIndex] = chosenQ;
              console.error(`[DEBUG] Replaced essay question at index ${essayIndex} with chosen essay ${eId}`);
            } else {
              selectedQuestions.push(chosenQ);
              console.error(`[DEBUG] Appended chosen essay question ${eId} to selectedQuestions`);
            }
          } else {
            console.error(`[DEBUG] Could not locate chosen essay question ${eId} to insert into attempt`);
          }
        } else {
          console.error(`[DEBUG] Chosen essay question ${req.body.essayQuestionId} already present in selectedQuestions`);
        }
      } catch (err) {
        console.error("Essay post-insert failed", err.message);
      }
    }

    const partTotalMarks = Number(part?.totalMarks || assessment.totalMarks || selectedQuestions.length);
    console.error(`[DEBUG] Before create attempt - selectedQuestions[0]:`, JSON.stringify(selectedQuestions[0], null, 2));
    const attemptPayloadOrder = (selectedQuestions || []).map(q => String(q.questionId || q.id || q._id || q.text));
    appendStartAssessmentDebug && appendStartAssessmentDebug(`startAssessmentBySubject attemptPayloadOrder ${JSON.stringify(attemptPayloadOrder.slice(0,50))}`);

    const attemptPayload = {
      assessmentType: "standard",
      assessmentId: assessment._id,
      assessmentTypeRef: "StandardAssessment",
      studentId,
      status: "in-progress",
      sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      duration: timeLimit,
      timeLeft: timeLimit * 60,
      totalMarks: partTotalMarks,
      selectedPart,
      fullAudio: oralMeta.full_audio || selectedQuestions[0]?.fullAudio || null,
      oralType: oralMeta.oralType || selectedQuestions[0]?.oralType || null,
      oralYear: oralMeta.oralYear || selectedQuestions[0]?.oralYear || null,
      oralMode: selectedQuestions[0]?.oralMode || null,
      answers: [],
      questions: selectedQuestions,
      total: selectedQuestions.length,
    };

    // If caller wants to inspect the payload before persistence, return it directly
    if (req && req.query && String(req.query.echoPayload) === '1') {
      appendStartAssessmentDebug && appendStartAssessmentDebug(`startAssessmentBySubject echoAttemptPayload ${JSON.stringify((attemptPayloadOrder||[]).slice(0,50))}`);
      return res.json({ message: 'Attempt payload (not persisted)', attemptPayloadOrder, attemptPayload });
    }

    const attempt = await AssessmentAttemptModel.create(attemptPayload);
    console.error(`[LOG] Attempt created: ${attempt._id}`);
    try {
      const savedAttemptOrder = (attempt.questions || []).map(q => String(q.questionId || q.id || q._id || q.text));
      appendStartAssessmentDebug && appendStartAssessmentDebug(`startAssessmentBySubject savedAttemptOrder ${JSON.stringify(savedAttemptOrder.slice(0,50))}`);
      console.error('[DEBUG startAssessmentBySubject] savedAttemptOrder:', savedAttemptOrder);
    } catch (e) { console.error('[DEBUG startAssessmentBySubject] error logging savedAttemptOrder', e); }

    const sanitizedAttempt = attempt.toObject ? attempt.toObject() : { ...attempt };
    try {
      sanitizedAttempt._debugSavedOrder = (attempt.questions || []).map(q => String(q.questionId || q.id || q._id || q.text));
      sanitizedAttempt._debugAttemptPayloadOrder = attemptPayloadOrder || [];
    } catch (e) {}
    console.error(`[DEBUG] After toObject - sanitizedAttempt.questions[0]:`, JSON.stringify(sanitizedAttempt.questions?.[0], null, 2));
    
    sanitizedAttempt.questions = removeQuestionAnswers(selectedQuestions);
    console.error(`[DEBUG] After removeQuestionAnswers - sanitizedAttempt.questions[0]:`, JSON.stringify(sanitizedAttempt.questions?.[0], null, 2));
    // Build question order for debugging
    const questionOrder = (sanitizedAttempt.questions || []).map((q, idx) => String(q.questionId || q.id || q._id || q.text?.slice(0,40) || `q_${idx}`));
    const debugEnabled = (process.env.DEBUG_ASSESSMENT_LOAD === '1' || String(process.env.DEBUG_ASSESSMENT_LOAD).toLowerCase() === 'true')
      || req?.query?.debug === '1'
      || (req?.headers && (req.headers['x-debug-assessment-load'] === '1' || req.headers['x-debug-assessment-load'] === 'true'));
    if (debugEnabled) {
      console.error(`[DEBUG startAssessmentBySubject] Question order for student=${studentId}, subject=${normalized}:`, questionOrder);
    }

    const payload = {
      message: "Assessment started",
      attempt: sanitizedAttempt,
      attemptId: attempt._id,
      questions: sanitizedAttempt.questions,
      timeLimit: attempt.timeLeft / 60,
      fullAudio: attempt.fullAudio || sanitizedAttempt.questions?.[0]?.fullAudio || null,
      oralType: attempt.oralType || sanitizedAttempt.questions?.[0]?.oralType || null,
      oralYear: attempt.oralYear || sanitizedAttempt.questions?.[0]?.oralYear || null,
    };
    if (debugEnabled || (req && req.query && String(req.query.forceNew) === '1')) payload.debug = { questionOrder, attemptPayloadOrder: attemptPayloadOrder || [], savedAttemptOrder: (attempt && attempt.questions) ? (attempt.questions || []).map(q => String(q.questionId || q.id || q._id || q.text)) : [] };
    res.json(payload);
  } catch (error) {
    console.error(`\n========== ERROR in startAssessmentBySubject ==========`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error name: ${error.name}`);
    console.error(`Full error:`, error);
    console.error(`Stack: ${error.stack}`);
    console.error(`==========================================================\n`);
    res.status(500).json({ message: "Unable to start subject assessment", error: error.message });
  }
};

// Debug: run the loader logic for a subject/part without creating an attempt
const previewStartBySubject = async (req, res) => {
  try {
    const subject = req.query.subject || req.params.subject;
    if (!subject) return res.status(400).json({ message: 'subject is required' });
    const normalized = normalizeSubjectKey(subject);
    if (!normalized) return res.status(404).json({ message: 'Subject not found' });

    const AssessmentModel = getAssessmentModel();
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    let assessment = await findSubjectAssessment(normalized);
    if (!assessment) return res.status(404).json({ message: 'Assessment not available' });

    const selectedPart = (req.query.selectedPart || 'A').toString().toUpperCase();
    const partIndex = Math.max(0, Math.min(25, selectedPart.charCodeAt(0) - 65));
    const part = assessment.parts?.[partIndex] || assessment.parts?.[0];

    let previousAttemptsCount = 0;
    try {
      const studentId = req.user?.id || req.user?._id;
      if (studentId) previousAttemptsCount = await AssessmentAttemptModel.countDocuments({ assessmentId: assessment._id, studentId }).catch(() => 0);
    } catch (e) { previousAttemptsCount = 0; }

    if (!part) return res.status(400).json({ message: 'Part not found on assessment' });

    const sectionLoads = [];
    for (const section of part.sections || []) {
      const partType = part.partType || part.type || 'objective';
      let questions = [];
      if (String(partType).toLowerCase() === 'oral') {
        questions = await loadOralSectionQuestions(normalized, section, Number(section.questionCount) || 0, req.query.oralType, req.query.oralYear);
      } else {
        questions = await loadSectionQuestions(assessment.subject, partType, section, undefined, { previousAttemptsCount });
      }
      sectionLoads.push({ sectionName: section.name || section.key, count: questions.length, ids: (questions||[]).map(q => String(q.questionId || q.id || q._id || q.text)) });
    }

    const combined = sectionLoads.flatMap(s => s.ids);
    return res.json({ subject: normalized, part: selectedPart, previousAttemptsCount, sections: sectionLoads, combinedOrder: combined });
  } catch (err) {
    console.error('previewStartBySubject error', err);
    return res.status(500).json({ message: err && err.message });
  }
};

const startCourseSectionByCourseSection = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const sectionId = req.params.sectionId;
    const Course = getModel("Course");
    const Enrollment = getModel("Enrollment");

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const courseEnrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
    if (!courseEnrollment) {
      return res.status(403).json({ message: "You must be enrolled in this course to take the quiz." });
    }

    const subjectMap = {
      IT: "ict",
      Science: "english",
      Commerce: "english",
      Arts: "english",
      Language: "english",
    };
    const subject = subjectMap[course.category] || course.subject || "english";
    const exam = await generateExam(subject);
    if (!exam || !Number.isFinite(exam.timeLimit) || exam.timeLimit <= 0) {
      return res.status(500).json({ message: "Configured time limit is missing or invalid for this subject quiz." });
    }

    const allQuestions = [
      ...(exam.objective || []).flatMap((s) => s.questions),
      ...(exam.theory || []).flatMap((s) => s.questions),
      ...(exam.oral || []).flatMap((s) => s.questions),
    ];

    if (!allQuestions.length) {
      return res.status(400).json({ message: "No quiz questions are available for this course section." });
    }

    const selectedQuestions = allQuestions.slice(0, Math.min(allQuestions.length, 20));
    const normalizedQuestions = normalizeQuestionItems(selectedQuestions, subject).map((question, index) => ({
      ...question,
      questionIndex: index,
      questionId: question.questionId || question._id?.toString() || `q_${index}`,
    }));

    const attempt = await AssessmentAttemptModel.create({
      assessmentId: courseId,
      studentId: req.user.id,
      courseId,
      status: "in-progress",
      sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      timeLeft: exam.timeLimit * 60,
      questions: normalizedQuestions,
      answers: [],
      total: normalizedQuestions.length,
    });

    res.json({ message: "Assessment started", attemptId: attempt._id, questions: normalizedQuestions, timeLimit: attempt.timeLeft / 60 });
  } catch (error) {
    console.error("Start course section assessment error", error);
    res.status(500).json({ message: "Unable to start course section assessment" });
  }
};

const autoSaveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const { answer, questionId, questionIndex, partName, sectionName, currentQuestionIndex, audioCurrentTime, timeLeft, startTime } = req.body;

    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const attempt = await AssessmentAttemptModel.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!isAuthorizedAttemptUser(req, attempt)) {
      return res.status(403).json({ message: "Not authorized to modify this attempt" });
    }

    const answerValue = normalizeAnswerValue(answer);
    const answerPayload = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
    const question = (attempt.questions || []).find((q, idx) => {
      const qId = String(getQuestionId(q, idx));
      const targetId = String(questionId || answerPayload.questionId || getQuestionId(answer, questionIndex) || '');
      return qId === targetId || (questionIndex != null && idx === Number(questionIndex));
    });
    const defaultQuestionText = question
      ? question.text || question.prompt || question.question || `Question ${questionIndex != null ? Number(questionIndex) + 1 : ''}`
      : '';
    const defaultTotalMarks = question
      ? getExpectedTotalMarksForQuestion(question, attempt.questions)
      : 1;
    const savedRecord = {
      ...answerPayload,
      questionId: questionId || answerPayload.questionId || getQuestionId(answer, questionIndex),
      questionIndex: questionIndex != null ? Number(questionIndex) : null,
      partName,
      sectionName,
      questionText: answerPayload.questionText || defaultQuestionText,
      questionType: answerPayload.questionType || question?.questionType || question?.type || 'short-answer',
      totalMarks: Number(answerPayload.totalMarks ?? question?.totalMarks ?? question?.total_marks ?? defaultTotalMarks) || defaultTotalMarks,
      studentAnswer: answerPayload.studentAnswer ?? answerPayload.answer ?? answerPayload.value ?? answerValue,
      timestamp: new Date(),
    };

    // Defensive fixes: ensure required fields exist to satisfy schema validation
    if (!savedRecord.questionId) {
      savedRecord.questionId = question ? (question.questionId || question._id || `q_${questionIndex != null ? questionIndex : Date.now()}`) : `q_${questionIndex != null ? questionIndex : Date.now()}`;
    }
    if (!savedRecord.questionText || String(savedRecord.questionText).trim() === "") {
      const fallbackText = question ? (question.text || question.prompt || question.question) : null;
      savedRecord.questionText = fallbackText && String(fallbackText).trim() !== "" ? String(fallbackText).trim() : `Question ${questionIndex != null ? Number(questionIndex) + 1 : ''}`;
    }
    if (!savedRecord.totalMarks || Number.isNaN(Number(savedRecord.totalMarks))) {
      savedRecord.totalMarks = defaultTotalMarks || 1;
    }

    attempt.answers = attempt.answers || [];
    const existingIndex = attempt.answers.findIndex((a) => {
      if (questionId && a.questionId) return String(a.questionId) === String(questionId);
      return a.questionIndex === questionIndex && a.sectionName === sectionName;
    });

    if (existingIndex >= 0) {
      attempt.answers[existingIndex] = {
        ...attempt.answers[existingIndex],
        ...savedRecord,
      };
    } else {
      attempt.answers.push(savedRecord);
    }

    attempt.currentQuestionIndex = currentQuestionIndex != null ? Number(currentQuestionIndex) : attempt.currentQuestionIndex;
    // Persist audio/time sync fields when provided
    if (typeof audioCurrentTime !== 'undefined' && audioCurrentTime !== null) {
      const t = Number(audioCurrentTime) || 0;
      attempt.audioCurrentTime = t;
      attempt.lastAudioSync = new Date();
    }
    if (typeof timeLeft !== 'undefined' && timeLeft !== null) {
      attempt.timeLeft = Number(timeLeft);
    }
    if (startTime) {
      const st = new Date(startTime);
      if (!isNaN(st.getTime())) attempt.startedAt = st;
    }

    attempt.lastAutoSave = new Date();
    // Normalize any invalid questionType values to allowed enums before saving
    const normalizeQuestionTypeForStorage = (qt) => {
      if (!qt) return 'short-answer';
      const key = String(qt).trim().toLowerCase();
      if (key.includes('multiple') || key.includes('choice')) return 'multiple-choice';
      if (key.includes('true') && key.includes('false')) return 'true-false';
      if (key.includes('essay') || key.includes('article') || key.includes('debate') || key.includes('story')) return 'essay';
      if (key.includes('objective')) return 'objective';
      // treat oral or unknown types as short-answer for storage
      return 'short-answer';
    };
    attempt.answers = (attempt.answers || []).map((a) => ({
      ...a,
      questionType: normalizeQuestionTypeForStorage(a.questionType || a.type || a.questionType),
    }));

    await attempt.save();

    res.json({ saved: true });
  } catch (error) {
    console.error("Auto-save error", error.message, error.stack);
    res.status(500).json({ message: "Unable to save answer", error: error.message });
  }
};

const submitAssessment = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const { answers: submittedAnswers } = req.body;
    console.log(`[SUBMIT] AttemptID: ${attemptId}`, `Answers: ${Array.isArray(submittedAnswers) ? submittedAnswers.length : 0}`);
    console.log(`[SUBMIT] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[SUBMIT] SubmittedAnswers type:`, typeof submittedAnswers, `isArray:`, Array.isArray(submittedAnswers));
    if (submittedAnswers && submittedAnswers[0]) {
      console.log(`[SUBMIT] First answer:`, JSON.stringify(submittedAnswers[0]));
    }
    
    const attempt = await getAssessmentAttemptModel().findById(attemptId);
    if (!attempt) {
      console.error(`[SUBMIT] Attempt not found: ${attemptId}`);
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!isAuthorizedAttemptUser(req, attempt)) {
      console.error(`[SUBMIT] Unauthorized submit attempt: ${attemptId}`);
      return res.status(403).json({ message: "Not authorized to submit this attempt" });
    }

    const assessment = await getAssessmentModel().findById(attempt.assessmentId);
    if (!assessment) {
      console.error(`[SUBMIT] Assessment not found: ${attempt.assessmentId}`);
      return res.status(404).json({ message: "Assessment not found" });
    }
    
    console.log(`[SUBMIT] Questions count: ${attempt.questions?.length || 0}`);
    attempt.status = "submitted";
    attempt.submittedAt = new Date();
    attempt.timeLeft = 0;

    const questions = attempt.questions || [];
    const flattenedQuestions = flattenAttemptQuestions(questions);
    console.log(`[SUBMIT] Loaded ${questions.length} attempt questions, flattened to ${flattenedQuestions.length}`);
    
    const totalQuestions = flattenedQuestions.length || (Array.isArray(submittedAnswers) ? submittedAnswers.length : 0);
    attempt.total = totalQuestions;
    let correctCount = 0;

    const normalizedSubmittedAnswers = normalizeSubmittedAnswers(submittedAnswers);
    const isOral = isOralAttempt(attempt);

    const submittedAnswerMap = new Map();
    normalizedSubmittedAnswers.forEach((answer) => {
      if (answer && answer.questionId) {
        submittedAnswerMap.set(String(answer.questionId), answer);
      }
      if (answer && answer.questionIndex != null) {
        submittedAnswerMap.set(`index:${Number(answer.questionIndex)}`, answer);
      }
    });

    const existingAnswerMap = new Map();
    (attempt.answers || []).forEach((answer) => {
      if (answer && answer.questionId) {
        existingAnswerMap.set(String(answer.questionId), normalizeAnswerValue(answer.studentAnswer ?? answer.answer ?? answer.value ?? ""));
      }
      if (answer && answer.questionIndex != null) {
        existingAnswerMap.set(`index:${Number(answer.questionIndex)}`, normalizeAnswerValue(answer.studentAnswer ?? answer.answer ?? answer.value ?? ""));
      }
    });

    if (isOral) {
      const savedAnswers = flattenedQuestions.map((question, index) => {
        const questionId = getQuestionId(question, index);
        const submitted = submittedAnswerMap.get(questionId) || submittedAnswerMap.get(`index:${index}`);
        const questionText = question.text || question.prompt || question.question || submitted?.questionText || submitted?.prompt || submitted?.question || `Question ${index + 1}`;

        let userAnswer = "";
        if (submitted) {
          userAnswer = normalizeAnswerValue(submitted.studentAnswer ?? submitted.answer ?? submitted.value ?? "");
        } else if (existingAnswerMap.has(questionId)) {
          userAnswer = normalizeAnswerValue(existingAnswerMap.get(questionId));
        } else if (existingAnswerMap.has(`index:${index}`)) {
          userAnswer = normalizeAnswerValue(existingAnswerMap.get(`index:${index}`));
        }

        const correctCandidates = getNormalizedCorrectAnswers(question.correctAnswer ?? question.answer ?? question.expectedAnswer ?? "");
        const normalizedUserAnswer = normalizeAnswerValue(userAnswer).toLowerCase();
        const isCorrect = normalizedUserAnswer !== "" && correctCandidates.some((candidate) => candidate.toLowerCase() === normalizedUserAnswer);
        if (isCorrect) correctCount += 1;

        const defaultTotalMarks = getExpectedTotalMarksForQuestion(question, questions);
        const answerTotalMarks = Number(submitted?.totalMarks ?? question.totalMarks ?? question.total_marks ?? defaultTotalMarks) || defaultTotalMarks;
        const marks = isCorrect ? answerTotalMarks : 0;

        return {
          questionIndex: index,
          questionId,
          questionText,
          studentAnswer: userAnswer,
          correctAnswer: question.correctAnswer ?? question.answer ?? question.expectedAnswer ?? "",
          totalMarks: answerTotalMarks,
          isCorrect,
          marks,
          questionType: normalizeQuestionTypeForStorage(question.questionType || question.type || "oral"),
          oralType: question.oralType || attempt.oralType || null,
          oralYear: question.oralYear || attempt.oralYear || null,
          aiMarked: false,
          aiReport: null,
        };
      });

      if (typeof req.body.audioCurrentTime !== 'undefined' && req.body.audioCurrentTime !== null) {
        attempt.audioCurrentTime = Number(req.body.audioCurrentTime) || 0;
        attempt.lastAudioSync = new Date();
      }
      attempt.answers = savedAnswers;
      attempt.correct = correctCount;
      attempt.objectiveMarks = correctCount;
      attempt.obtainedMarks = savedAnswers.reduce((sum, answer) => sum + (Number(answer.marks) || 0), 0);
      attempt.totalMarks = savedAnswers.reduce((sum, answer) => sum + (Number(answer.totalMarks) || 0), 0) || attempt.totalMarks || assessment?.totalMarks || 0;
      attempt.percentage = attempt.totalMarks > 0 ? (attempt.obtainedMarks / attempt.totalMarks) * 100 : 0;
      attempt.passed = attempt.percentage >= (assessment?.passingScore || 50);
      attempt.status = "completed";
      attempt.markedAt = new Date();
      attempt.grade = attempt.calculateGrade();

      const savedAttempt = await attempt.save();
      const resultQuestions = questions.map((question, index) => ({
        ...question,
        questionIndex: index,
        questionId: getQuestionId(question, index),
      }));

      return res.json({
        attempt: savedAttempt,
        score: Number(correctCount),
        obtainedMarks: Number.isFinite(Number(attempt.obtainedMarks)) ? Math.round(Number(attempt.obtainedMarks)) : Number(correctCount),
        correct: Number(correctCount),
        wrong: Number(totalQuestions - correctCount),
        total: Number(totalQuestions),
        totalMarks: attempt.totalMarks,
        percentage: Number(attempt.percentage.toFixed(2)),
        grade: attempt.calculateGrade(),
        status: attempt.passed ? "PASS" : "FAIL",
        result: {
          totalMarks: attempt.totalMarks,
          percentage: attempt.percentage,
          passed: attempt.passed,
          correct: Number(correctCount),
          wrong: Number(totalQuestions - correctCount),
          questions: resultQuestions,
          answers: savedAnswers,
        },
      });
    }

    const savedAnswers = flattenedQuestions.map((question, index) => {
      const questionId = getQuestionId(question, index);
      const submitted = submittedAnswerMap.get(questionId) || submittedAnswerMap.get(`index:${index}`);
      const questionText = question.text || question.prompt || question.question || submitted?.questionText || submitted?.prompt || submitted?.question || `Question ${index + 1}`;
      
      let userAnswer = "";
      if (submitted) {
        userAnswer = String(submitted.studentAnswer ?? submitted.answer ?? submitted.value ?? "").trim();
      } else if (existingAnswerMap.has(questionId)) {
        userAnswer = String(existingAnswerMap.get(questionId) ?? "").trim();
      } else if (existingAnswerMap.has(`index:${index}`)) {
        userAnswer = String(existingAnswerMap.get(`index:${index}`) ?? "").trim();
      }

      const hasCorrectAnswer = question.correctAnswer !== undefined && question.correctAnswer !== null && String(question.correctAnswer).trim() !== "";
      let isCorrect = false;
      let marks = 0;
      const defaultTotalMarks = getExpectedTotalMarksForQuestion(question, questions);
      const answerTotalMarks = Number(submitted?.totalMarks ?? question.totalMarks ?? question.total_marks ?? defaultTotalMarks) || defaultTotalMarks;
      
      if (hasCorrectAnswer) {
        const correctAnswer = String(question.correctAnswer || question.answer || "").trim().toLowerCase();
        const normalizedUserAnswer = String(userAnswer).trim().toLowerCase();
        isCorrect = normalizedUserAnswer !== "" && normalizedUserAnswer === correctAnswer;
        if (isCorrect) {
          correctCount += 1;
          marks = answerTotalMarks;
        }
        console.log(`[SUBMIT] Q${index} (OBJECTIVE): user="${userAnswer}" vs correct="${question.correctAnswer}" => ${isCorrect ? "CORRECT" : "WRONG"}`);
      } else {
        console.log(`[SUBMIT] Q${index} (ESSAY): saved ${userAnswer.length} chars for AI marking`);
      }
      
      const savedAnswer = {
        questionIndex: index,
        questionId,
        questionText,
        studentAnswer: userAnswer,
        correctAnswer: question.correctAnswer || question.answer || "",
        totalMarks: answerTotalMarks,
        questionType: normalizeQuestionTypeForStorage(question.questionType || question.type || (hasCorrectAnswer ? 'objective' : 'short-answer')),
        isCorrect,
        marks,
        aiMarked: false,
        aiReport: null,
      };
      if (submitted && submitted.rubric) savedAnswer.rubric = submitted.rubric;
      return savedAnswer;
    });
    console.log(`[SUBMIT] Created ${savedAnswers.length} saved answers (correct: ${savedAnswers.filter(a => a.isCorrect).length})`);
    
    // Provisional local grading: give non-empty essay/comprehension/summary answers a partial/local grade
    try {
      for (let i = 0; i < savedAnswers.length; i++) {
        const a = savedAnswers[i];
        if (a.isCorrect) continue; // objective correct already handled
        const text = String(a.studentAnswer || "").trim();
        if (!text) continue; // blank answer
        try {
          const q = (questions || [])[a.questionIndex] || {};
          const questionText = a.questionText || q.prompt || q.text || '';
          const totalMarksForQ = Number(a.totalMarks || q.totalMarks || q.marks || 5) || 5;
          const rubric = a.rubric || deriveAnswerRubric(a, q);
          const fallback = await aiMarkingService.simpleLocalGrader({ questionText, rubric, modelAnswer: q.modelAnswer || null, studentAnswer: text, totalMarks: totalMarksForQ });
          if (fallback && fallback.report) {
            a.aiReport = a.aiReport || fallback.report;
            a.aiFeedback = a.aiFeedback || fallback.report.feedback || '';
            // mark as provisional (still needs AI verification if provider enabled)
            a.provisional = true;
            // Only set marks if not already set (objective correct may have set marks)
            a.marks = Number.isFinite(Number(fallback.report.score)) ? Number(fallback.report.score) : (a.marks || 0);
          }
        } catch (inner) {
          console.error('[SUBMIT] provisional local grading failed for answer', a.questionIndex, inner);
        }
      }
    } catch (pgErr) {
      console.error('[SUBMIT] Error running provisional local grading:', pgErr);
    }

    if (savedAnswers.length > 0) {
      attempt.answers = savedAnswers;
      console.log(`[SUBMIT] Setting attempt.answers to ${savedAnswers.length} items`);
    } else {
      console.log(`[SUBMIT] ⚠️ savedAnswers is empty! No answers to save.`);
    }

    // Normalize total marks: prefer assessment.totalMarks as authoritative when available
    const marksPerQuestionFromAssessment = assessment && Number.isFinite(Number(assessment.totalMarks)) && totalQuestions ? Number(assessment.totalMarks) / totalQuestions : null;

    // If assessment totalMarks is provided, ensure each saved answer has that per-question weight
    if (marksPerQuestionFromAssessment) {
      savedAnswers.forEach((a) => {
        a.totalMarks = Number(marksPerQuestionFromAssessment);
      });
    }

    // If all questions are objective (have explicit correctAnswer), prefer integer scoring
    const objectiveOnly = flattenedQuestions.length > 0 && flattenedQuestions.every((q) => {
      const ca = q?.correctAnswer ?? q?.answer ?? q?.expectedAnswer;
      return typeof ca !== 'undefined' && ca !== null && String(ca).trim() !== '';
    });
    if (objectiveOnly) {
      // normalize to 1 mark per question for display of score/total
      savedAnswers.forEach((a) => {
        a.totalMarks = 1;
        a.marks = a.isCorrect ? 1 : 0;
      });
    }

    const totalPossibleMarks = (assessment && Number.isFinite(Number(assessment.totalMarks)) ? Number(assessment.totalMarks) : savedAnswers.reduce((sum, answer) => sum + (Number(answer.totalMarks) || 0), 0)) || attempt.totalMarks || 0;
    const marksPerQuestion = marksPerQuestionFromAssessment || (savedAnswers.length ? (savedAnswers.reduce((s,a)=>s + (Number(a.totalMarks)||0),0) / savedAnswers.length) : 1);

    if (objectiveOnly) {
      attempt.objectiveMarks = Number(correctCount || 0);
      attempt.obtainedMarks = Number(correctCount || 0);
      attempt.totalMarks = savedAnswers.length || Number(totalPossibleMarks || 0);
      attempt.percentage = attempt.totalMarks > 0 ? (attempt.obtainedMarks / attempt.totalMarks) * 100 : 0;
    } else {
      attempt.objectiveMarks = Math.round((correctCount || 0) * marksPerQuestion);
      attempt.obtainedMarks = Number.isFinite(Number(attempt.objectiveMarks)) ? Number(attempt.objectiveMarks) : 0;
      attempt.totalMarks = Number(totalPossibleMarks || 0);
      attempt.percentage = attempt.totalMarks > 0 ? (attempt.obtainedMarks / attempt.totalMarks) * 100 : 0;
    }
    attempt.passed = attempt.percentage >= (assessment?.passingScore || 50);
    attempt.correct = correctCount;
    
    console.log(`[SUBMIT] Graded: correct=${correctCount}/${totalQuestions}, marks=${attempt.totalMarks}, percentage=${attempt.percentage.toFixed(2)}%, passed=${attempt.passed}`);

    // Queue theory for AI marking if enabled
    if (assessment?.markingScheme?.aiTheoryMarking) {
      attempt.status = "pending-review";
    } else {
      attempt.status = "marked";
      attempt.markedAt = new Date();
    }

    let savedAttempt;
    if (typeof attempt.save === "function") {
      try {
        savedAttempt = await attempt.save();
        console.log(`[SUBMIT] Saved via attempt.save(). Answers in savedAttempt before return:`, savedAttempt.answers ? savedAttempt.answers.length : 0);
        if (savedAttempt.answers && savedAttempt.answers.length > 0) {
          console.log(`[SUBMIT] First answer in saved: questionIndex=${savedAttempt.answers[0].questionIndex}, studentAnswer=${savedAttempt.answers[0].studentAnswer?.substring(0, 50)}`);
        }
      } catch (saveErr) {
        console.error(`[SUBMIT] ERROR saving attempt via save():`, saveErr);
        throw saveErr;
      }
    } else if (typeof getAssessmentAttemptModel().findByIdAndUpdate === "function") {
      try {
        savedAttempt = await getAssessmentAttemptModel().findByIdAndUpdate(attempt._id || attemptId, attempt, { new: true });
        console.log(`[SUBMIT] Saved via findByIdAndUpdate(). Answers in savedAttempt:`, savedAttempt.answers ? savedAttempt.answers.length : 0);
      } catch (saveErr) {
        console.error(`[SUBMIT] ERROR saving attempt via findByIdAndUpdate():`, saveErr);
        throw saveErr;
      }
    } else {
      savedAttempt = attempt;
      console.log(`[SUBMIT] ⚠️ Could not save - using in-memory attempt`);
    }
    console.log(`[SUBMIT] Final savedAttempt.answers:`, savedAttempt.answers ? savedAttempt.answers.length : 0);

    // If there are essay/comprehension/summary answers that need AI marking, run marking now
    try {
      const needsAiMarking = (savedAttempt.answers || []).some(a => !a.isCorrect && !a.aiMarked);
      if (needsAiMarking) {
        console.log(`[SUBMIT] Detected ${savedAttempt.answers.filter(a=>!a.isCorrect && !a.aiMarked).length} answers needing AI marking for attempt ${savedAttempt._id}. Running AI marking inline.`);
        for (let i = 0; i < savedAttempt.answers.length; i++) {
          const ans = savedAttempt.answers[i];
          if (ans.aiMarked) continue;
          const q = (attempt.questions || [])[ans.questionIndex] || {};
          const questionText = ans.questionText || q.prompt || q.text || (typeof q.question === 'string' ? q.question : '') || q.question?.prompt || q.question?.text || '';
          const rubric = deriveAnswerRubric(ans, q);
          const englishEssayRubric = normalizeEnglishEssayRubric(rubric);
          const minimumWordCount = q.minimumWords || q.minimum_words || q.question?.minimumWords || q.question?.minimum_words || null;
          const computedTotalMarks = Number(ans.totalMarks ?? q.totalMarks ?? q.total_marks ?? q.marks ?? (rubric ? Object.values(rubric).reduce((s,v)=>s+Number(v||0),0) : 5)) || 5;
          const expectedTotalMarks = getExpectedTotalMarksForQuestion(q, questions);
          const totalMarks = expectedTotalMarks || computedTotalMarks;
          if (!ans.totalMarks || ans.totalMarks !== totalMarks) ans.totalMarks = totalMarks;
          try {
            let report = null;
            const qTypeKey = String(q.questionType || q.type || q.subType || q.sectionName || q.section_title || '').trim().toLowerCase();
            const isEssayQuestion = isEnglishEssayQuestion(q) || !!englishEssayRubric || qTypeKey.includes('essay');
            const isComprehensionQuestion = qTypeKey.includes('comprehension');
            const isSummaryQuestion = qTypeKey.includes('summary');

            if (isEssayQuestion) {
              const essayType = q.question?.essay_type || q.essayType || q.type || q.questionType || 'essay';
              const evaluation = await aiMarkingService.evaluateEnglishEssay({
                essayType,
                essayText: questionText,
                studentAnswer: ans.studentAnswer || '',
                modelAnswer: q.modelAnswer || q.model_answer || q.question?.modelAnswer || q.question?.model_answer || null,
                rubric: englishEssayRubric || { WordCount:5, Content:10, Organization:10, Expression:10, MechanicalAccuracy:15 },
                minimumWordCount: minimumWordCount || 450,
              });
              report = evaluation.report;
              if (evaluation.rawResponse) report.rawResponse = evaluation.rawResponse;
            } else if (isComprehensionQuestion || isSummaryQuestion) {
              const evaluation = await aiMarkingService.evaluateComprehensionOrSummary({
                passageText: q.passage || q.passageText || q.question?.passage || q.question?.passageText || '',
                questionText,
                studentAnswer: ans.studentAnswer || '',
                modelAnswer: q.modelAnswer || q.model_answer || q.question?.modelAnswer || q.question?.model_answer || null,
                questionType: isSummaryQuestion ? 'summary' : 'comprehension',
                acceptedAnswers: q.acceptedAnswers || q.accepted_answers || q.question?.acceptedAnswers || q.question?.accepted_answers || [],
              });
              report = evaluation.report;
              if (evaluation.rawResponse) report.rawResponse = evaluation.rawResponse;
            } else {
              const evaluation = await aiMarkingService.evaluateAnswer({
                questionText,
                rubric,
                markingCriteria: q.markingCriteria || q.marking_criteria || q.question?.markingCriteria || q.question?.marking_criteria || null,
                expectedPoints: Number(q.totalMarks ?? q.total_marks ?? ans.totalMarks ?? totalMarks) || totalMarks,
                minimumWordCount,
                modelAnswer: q.modelAnswer || q.model_answer || q.question?.modelAnswer || q.question?.model_answer || null,
                studentAnswer: ans.studentAnswer || '',
                totalMarks,
              });
              report = evaluation.report;
            }

            if (report && report.totalScore != null && report.score == null) report.score = report.totalScore;
            if (report && report.score == null && report.categoryScores) report.score = Object.values(report.categoryScores).reduce((s,v)=>s+Number(v||0),0);

            ans.aiReport = report;
            ans.aiFeedback = report?.feedback || '';
            ans.aiMarked = true;
            ans.marks = Number.isFinite(Number(report?.score)) ? Number(report.score) : 0;
          } catch (err) {
            console.error('[SUBMIT] AI inline mark error for answer', ans.questionId, err);
            try {
              const fallback = await aiMarkingService.simpleLocalGrader({ questionText, rubric, modelAnswer: q.modelAnswer || null, studentAnswer: ans.studentAnswer || '', totalMarks });
              ans.aiReport = fallback.report;
              ans.aiFeedback = fallback.report.feedback || '';
              ans.aiMarked = true;
              ans.marks = Number.isFinite(Number(fallback.report.score)) ? Number(fallback.report.score) : 0;
            } catch (fbErr) {
              console.error('[SUBMIT] Local fallback failed', fbErr);
            }
          }
        }
        // Recompute totals after AI marking
        savedAttempt.totalMarks = savedAttempt.answers.reduce((s,a)=>s + (Number(a.totalMarks)||0), 0) || savedAttempt.totalMarks || assessment?.totalMarks || 0;
        savedAttempt.obtainedMarks = savedAttempt.answers.reduce((s,a)=>s + (Number(a.marks)||0), 0);
        savedAttempt.percentage = savedAttempt.totalMarks > 0 ? (savedAttempt.obtainedMarks / savedAttempt.totalMarks) * 100 : 0;
        savedAttempt.passed = savedAttempt.percentage >= (assessment?.passingScore || 50);
        savedAttempt.status = 'marked';
        savedAttempt.markedAt = new Date();
        savedAttempt.aiReport = buildAttemptAiReport(savedAttempt);
        await savedAttempt.save();
        console.log('[SUBMIT] AI inline marking complete for attempt', savedAttempt._id, 'obtainedMarks=', savedAttempt.obtainedMarks);
      }
    } catch (aiInlineErr) {
      console.error('[SUBMIT] Error running inline AI marking:', aiInlineErr);
    }

    // Update enrollment attempt count if global
    if (assessment?.type === "global") {
      try {
        await getAssessmentEnrollmentModel().findOneAndUpdate(
          { assessmentId: attempt.assessmentId, studentId: attempt.studentId },
          {
            $inc: { attempts: 1 },
            $max: { bestScore: attempt.totalMarks, bestPercentage: attempt.percentage },
          }
        );
      } catch (enrollError) {
        console.error(`[SUBMIT] Enrollment update failed:`, enrollError);
      }
    }

    const resultQuestions = removeQuestionAnswers(questions).map((question, index) => ({
      ...question,
      questionIndex: index,
      questionId: getQuestionId(question, index),
    }));

    res.json({
      attempt: savedAttempt,
      score: Number(correctCount),
      obtainedMarks: Number.isFinite(Number(attempt.obtainedMarks)) ? Math.round(Number(attempt.obtainedMarks)) : Number(correctCount),
      correct: Number(correctCount),
      total: Number(totalQuestions),
      totalMarks: attempt.totalMarks,
      percentage: Number(attempt.percentage.toFixed(2)),
      status: attempt.passed ? "PASS" : "FAIL",
      result: {
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        correct: Number(correctCount),
        questions: resultQuestions,
        answers: savedAnswers,
      },
    });
  } catch (error) {
    console.error("[SUBMIT] Error:", error);
    if (error && error.name) {
      console.error("[SUBMIT] Error name:", error.name);
    }
    if (error && error.errors) {
      console.error("[SUBMIT] Validation errors:", JSON.stringify(error.errors, null, 2));
    }
    if (error && error.stack) {
      console.error(error.stack);
    }
    res.status(500).json({
      message: "Unable to submit assessment",
      error: error.message || "Unknown error",
    });
  }
};

const buildOralAttemptQuestions = async ({ subject, oralType, oralYear, count = 60 }) => {
  const normalized = normalizeSubjectKey(subject) || String(subject || "").trim().toLowerCase();
  const section = {
    files: ["oral.json"],
    questionCount: count,
    key: String(oralType || "oral").toLowerCase(),
  };

  const loadedQuestions = await loadOralSectionQuestions(normalized, section, Number(count) || 60, oralType, oralYear);
  if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
    return {
      questions: Array.from({ length: Number(count) || 60 }).map((_, index) => ({
        questionId: `oral-${String(oralType || "oral").toLowerCase()}-${index + 1}`,
        questionIndex: index,
        text: `Oral question ${index + 1}`,
        prompt: `Oral question ${index + 1}`,
        type: "oral",
        questionType: "oral",
        oralType,
        oralYear: oralYear || null,
      })),
      meta: {
        oralType,
        oralYear: oralYear || null,
        durationMinutes: 40,
        fullAudio: null,
      },
    };
  }

  const questions = loadedQuestions.map((question, index) => ({
    ...question,
    questionIndex: index,
    questionId: question.questionId || question.id || `oral-${String(oralType || "oral").toLowerCase()}-${index + 1}`,
  }));

  const oralMeta = loadedQuestions._oralMeta || {};
  return {
    questions,
    meta: {
      oralType: oralMeta.oralType || String(oralType || "oral").toLowerCase(),
      oralYear: oralMeta.oralYear || String(oralYear || "").toLowerCase() || null,
      durationMinutes: Number(oralMeta.duration_minutes || questions[0]?.oralDurationMinutes || 40) || 40,
      fullAudio: oralMeta.full_audio || questions[0]?.fullAudio || null,
    },
  };
};

const startOralAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { oralType = "wassce", oralYear } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const AssessmentModel = getAssessmentModel();
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const assessment = await AssessmentModel.findById(assessmentId);
    const subject = assessment?.subject || assessment?.name || "english";
    const normalizedSubject = normalizeSubjectKey(subject) || "english";

    // Reuse any existing in-progress oral attempt for this student, assessment and oral type
    const existingAttempt = await AssessmentAttemptModel.findOne({
      assessmentId,
      studentId,
      status: "in-progress",
      oralType: String(oralType).toLowerCase(),
    });

    if (existingAttempt) {
      return res.json({
        message: "Existing oral attempt resumed",
        attemptId: existingAttempt._id,
        timeLeft: existingAttempt.timeLeft,
        oralType: existingAttempt.oralType,
        oralYear: existingAttempt.oralYear,
        fullAudio: existingAttempt.fullAudio,
      });
    }

    const { questions, meta } = await buildOralAttemptQuestions({
      subject: normalizedSubject,
      oralType: String(oralType).toLowerCase(),
      oralYear,
      count: 60,
    });

    const durationMinutes = Number(meta.durationMinutes || 40) || 40;
    const timeLeft = durationMinutes * 60;

    const totalMarks = questions.reduce((sum, question) => {
      const marks = Number(question.totalMarks ?? question.marks ?? question.total_marks);
      return sum + (Number.isFinite(marks) && marks > 0 ? marks : 1);
    }, 0);

    const attemptPayload = {
      assessmentType: "standard",
      assessmentTypeRef: "StandardAssessment",
      assessmentId,
      studentId,
      status: "in-progress",
      sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      timeLeft,
      duration: durationMinutes,
      totalMarks,
      questions: removeQuestionAnswers(questions),
      total: questions.length,
      fullAudio: meta.fullAudio || null,
      oralType: String(oralType).toLowerCase(),
      oralYear: meta.oralYear || String(oralYear || "").toLowerCase() || null,
    };

    const attempt = await AssessmentAttemptModel.create(attemptPayload);

    res.json({
      message: "Oral assessment started",
      attemptId: attempt._id,
      timeLeft: attempt.timeLeft,
      fullAudio: attempt.fullAudio,
      oralType: attempt.oralType,
      oralYear: attempt.oralYear,
    });
  } catch (error) {
    console.error("Start oral assessment error", error);
    res.status(500).json({ message: "Unable to start oral assessment" });
  }
};

const updateAttemptTimeLeft = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const { timeLeft, audioCurrentTime, startTime } = req.body;
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const attempt = await AssessmentAttemptModel.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!isAuthorizedAttemptUser(req, attempt)) {
      return res.status(403).json({ message: "Not authorized to update this attempt" });
    }

    if (typeof timeLeft !== "undefined" && timeLeft !== null) {
      attempt.timeLeft = Number(timeLeft);
    }
    if (typeof audioCurrentTime !== "undefined" && audioCurrentTime !== null) {
      attempt.audioCurrentTime = Number(audioCurrentTime);
      attempt.lastAudioSync = new Date();
    }
    if (startTime) {
      const parsed = new Date(startTime);
      if (!Number.isNaN(parsed.getTime())) {
        attempt.startedAt = parsed;
      }
    }

    await attempt.save();
    res.json({ message: "Attempt time updated", timeLeft: attempt.timeLeft, audioCurrentTime: attempt.audioCurrentTime });
  } catch (error) {
    console.error("Update attempt time-left error", error);
    res.status(500).json({ message: "Unable to update time left" });
  }
};

const getAttemptResume = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const attempt = await AssessmentAttemptModel.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!isAuthorizedAttemptUser(req, attempt)) {
      return res.status(403).json({ message: "Not authorized to view this attempt" });
    }

    res.json({
      message: "Attempt retrieved",
      attempt,
    });
  } catch (error) {
    console.error("Get attempt resume error", error);
    res.status(500).json({ message: "Unable to retrieve attempt" });
  }
};

const enrollInAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { paymentId } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const assessment = await getAssessmentModel().findById(assessmentId);
    if (!assessment || !["global", "course"].includes(assessment.type)) {
      return res.status(400).json({ message: "Invalid assessment" });
    }

    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const isPaidAssessment = assessment.price > 0;
    const expiryDate = isPaidAssessment ? defaultExpiry : undefined;
    const validUntil = isPaidAssessment ? defaultExpiry : undefined;
    const subscriptionType = isPaidAssessment ? "monthly" : "free";

    let paymentReference = "";
    let paymentStatus = "pending";
    let paymentMethod = "Manual";
    let paymentAmount = assessment.price || 0;
    let verifiedPayment = null;

    if (isPaidAssessment) {
      if (!paymentId) {
        return res.status(402).json({
          message: "Payment is required to enroll in this assessment. Please complete the payment flow.",
          requiresPayment: true,
          assessmentId,
          price: assessment.price,
        });
      }
      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        return res.status(400).json({ message: "Invalid paymentId" });
      }
      const Payment = getPayment();
      verifiedPayment = await Payment.findById(paymentId);
      if (!verifiedPayment || String(verifiedPayment.studentId) !== String(studentId) || verifiedPayment.productType !== "assessment" || String(verifiedPayment.productId) !== String(assessmentId) || verifiedPayment.status !== "completed" || verifiedPayment.verificationStatus !== "verified") {
        return res.status(403).json({ message: "Payment record is not verified or does not match this assessment." });
      }
      paymentReference = verifiedPayment.paymentId;
      paymentStatus = "paid";
      paymentMethod = verifiedPayment.paymentMethod || "Wave";
      paymentAmount = verifiedPayment.amount || paymentAmount;
    }

    const enrollmentData = {
      assessmentId: assessment._id,
      studentId,
      enrolledDate: new Date(),
      accessGranted: true,
      subscriptionType,
      subscriptionStatus: "active",
      expiryDate,
      paymentReference,
      paymentStatus,
      paymentAmount,
      paymentMethod,
      paymentCurrency: "GMD",
      paymentDate: isPaidAssessment ? new Date() : undefined,
      transactionId: paymentReference,
      accessType: "assessment",
      validUntil,
      paymentId: verifiedPayment?._id || null,
    };

    const enrollment = await getAssessmentEnrollmentModel().findOneAndUpdate(
      { assessmentId, studentId },
      { $set: enrollmentData, $setOnInsert: { enrolledDate: new Date(), accessGranted: true } },
      { upsert: true, new: true }
    );

    res.json({ enrollment, message: "Enrolled in assessment" });
  } catch (error) {
    console.error("Enrollment error", error);
    res.status(500).json({ message: "Unable to enroll in assessment" });
  }
};

const deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const AssessmentModel = getAssessmentModel();
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();

    // Delete related attempts
    await AssessmentAttemptModel.deleteMany({ assessmentId: id });

    // Delete related enrollments
    await AssessmentEnrollmentModel.deleteMany({ assessmentId: id });

    // Delete the assessment
    await AssessmentModel.findByIdAndDelete(id);
    res.json({ message: "Assessment deleted" });
  } catch (error) {
    console.error("Assessment deletion error", error);
    res.status(500).json({ message: "Unable to delete assessment" });
  }
};

const recordTabSwitch = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const attempt = await AssessmentAttemptModel.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }
    if (!isAuthorizedAttemptUser(req, attempt)) {
      return res.status(403).json({ message: "Not authorized to update this attempt" });
    }

    // Support multiple anti-cheat event types via request body
    const rawEvent = (req.body && req.body.event) || 'tab-switch';
    const eventType = String(rawEvent || 'tab-switch').trim().toLowerCase();

    // Load assessment and anti-cheat configuration
    const AssessmentModel = getAssessmentModel();
    const assessment = await AssessmentModel.findById(attempt.assessmentId);
    const antiCheatConfig = (assessment && assessment.antiCheat) || {};

    // Per-event thresholds: { "tab-switch": 3, "copy-paste": 1, "inspect-opened": 1 }
    const eventThresholds = (antiCheatConfig.thresholds && typeof antiCheatConfig.thresholds === 'object') ? antiCheatConfig.thresholds : {};
    const eventMax = Number(eventThresholds[eventType]) || (eventType === 'tab-switch' ? 3 : 1);
    const maxWarnings = Number(antiCheatConfig.maxWarnings) || 3;
    const exitAction = antiCheatConfig.exitAction || 'warning';
    const autoSubmitOnCritical = typeof antiCheatConfig.autoSubmitOnCritical === 'boolean' ? antiCheatConfig.autoSubmitOnCritical : true;

    // Decide severity by event type (critical events may trigger immediate actions)
    const criticalEvents = Array.isArray(antiCheatConfig.criticalEvents) && antiCheatConfig.criticalEvents.length ? antiCheatConfig.criticalEvents : ['inspect-opened', 'copy-paste'];
    const severity = criticalEvents.includes(eventType) ? 'critical' : 'warning';

    // Record event in antiCheatLog
    attempt.antiCheatLog = attempt.antiCheatLog || [];
    attempt.antiCheatLog.push({ event: eventType, timestamp: new Date(), severity });

    // Increment counters for known events
    if (eventType === 'tab-switch') {
      attempt.tabSwitches = (attempt.tabSwitches || 0) + 1;
    }
    // Increase warnings (generic counter) when any security event occurs
    attempt.warnings = (attempt.warnings || 0) + 1;

    // Flag attempt for review on suspicious events
    if (severity === 'critical') {
      attempt.suspiciousActivity = true;
      attempt.flaggedForReview = true;
    }

    await attempt.save();

    // If this event is critical and configured to auto-submit, do so immediately
    if (severity === 'critical' && autoSubmitOnCritical) {
      console.warn(`[ANTI-CHEAT] Critical event (${eventType}) detected for attempt ${attemptId}. Auto-submitting.`);
      // Reuse submitAssessment controller to perform grading and finalization
      return submitAssessment(req, res);
    }

    // If cumulative warnings exceed configured maximum, auto-submit
    if ((attempt.warnings || 0) >= maxWarnings) {
      console.warn(`[ANTI-CHEAT] Max warnings reached for attempt ${attemptId} (${attempt.warnings}). Auto-submitting.`);
      return submitAssessment(req, res);
    }

    return res.json({ warnings: attempt.warnings, action: exitAction, event: eventType });
  } catch (error) {
    console.error("Tab switch recording error", error && error.stack ? error.stack : error);
    console.error("Tab switch request context", {
      attemptId: req?.params?.attemptId,
      user: req?.user,
    });
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.join(__dirname, '../tmp_tab_switch_error.log'),
        `${new Date().toISOString()} - Tab switch error: ${error && error.stack ? error.stack : JSON.stringify(error)}\nContext: ${JSON.stringify({ attemptId: req?.params?.attemptId, user: req?.user })}\n`,
        'utf8'
      );
    } catch (logErr) {
      console.error('Failed to write tmp_tab_switch_error.log', logErr && logErr.stack ? logErr.stack : logErr);
    }
    res.status(500).json({ message: "Unable to record tab switch" });
  }
};

const getAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const attempt = await AssessmentAttemptModel.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!isAuthorizedAttemptUser(req, attempt)) {
      return res.status(403).json({ message: "Not authorized to view this attempt" });
    }

    res.json({ attempt });
  } catch (error) {
    console.error("Get attempt error", error);
    res.status(500).json({ message: "Unable to fetch attempt" });
  }
};

// Admin: list attempts (supports optional query filters)
const getAttempts = async (req, res) => {
  try {
    const { quiz, student, status } = req.query;
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const UserModel = getModel("User");
    const QuizModel = getModel("Quiz");

    const query = {};
    if (student) query.studentId = student;
    if (quiz) query.quizId = quiz;
    if (status) query.status = status;

    const attempts = await AssessmentAttemptModel.find(query).sort({ createdAt: -1 }).exec();

    const enriched = await Promise.all(
      (Array.isArray(attempts) ? attempts : []).map(async (a) => {
        const doc = a && a._doc ? a._doc : a || {};
        let studentObj = doc.student || null;
        let quizObj = doc.quiz || null;

        if (!studentObj && doc.studentId) {
          try {
            const u = await UserModel.findById(doc.studentId);
            studentObj = u && u._doc ? u._doc : u;
          } catch (e) {
            studentObj = null;
          }
        }

        if (!quizObj && doc.quizId) {
          try {
            const q = await QuizModel.findById(doc.quizId);
            quizObj = q && q._doc ? q._doc : q;
          } catch (e) {
            quizObj = null;
          }
        }

        return {
          ...doc,
          student: studentObj,
          quiz: quizObj,
        };
      })
    );

    res.json({ attempts: enriched });
  } catch (error) {
    console.error("Get attempts error", error);
    res.status(500).json({ message: "Unable to fetch attempts" });
  }
};

// New functions for question management
const createQuestion = async (req, res) => {
  try {
    const { assessmentId, partName, sectionName, questionData } = req.body;

    if (!assessmentId || !partName || !sectionName || !questionData) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const question = await Question.create({
      ...questionData,
      assessmentId,
      partName,
      sectionName,
      questionId: questionData.questionId || `${assessmentId}_${partName}_${sectionName}_${Date.now()}_${Math.random()}`
    });

    res.status(201).json({ question });
  } catch (error) {
    console.error("Question creation error", error);
    res.status(500).json({ message: "Unable to create question" });
  }
};

const getQuestions = async (req, res) => {
  try {
    const { assessmentId, partName, sectionName } = req.query;
    const filter = {};

    if (assessmentId) filter.assessmentId = assessmentId;
    if (partName) filter.partName = partName;
    if (sectionName) filter.sectionName = sectionName;

    const questions = await Question.find(filter);
    res.json({ questions });
  } catch (error) {
    console.error("Questions fetch error", error);
    res.status(500).json({ message: "Unable to fetch questions" });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const question = await Question.findByIdAndUpdate(id, updateData, { new: true });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ question });
  } catch (error) {
    console.error("Question update error", error);
    res.status(500).json({ message: "Unable to update question" });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    await Question.findByIdAndDelete(id);
    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Question deletion error", error);
    res.status(500).json({ message: "Unable to delete question" });
  }
};

const importQuestionsFromBank = async (req, res) => {
  try {
    const { assessmentId, partName, sectionName, bankPath, subject, partType } = req.body;

    if (!assessmentId || !partName || !sectionName) {
      return res.status(400).json({ message: "Missing required fields: assessmentId, partName, sectionName" });
    }

    // Support both old bankPath and new subject/partType structure
    let questions = [];
    
    if (bankPath) {
      // Old method using explicit bankPath
      questions = await loadQuestionsFromBank(bankPath);
    } else if (subject && partType) {
      // New method using subject and partType
      questions = await loadQuestionsFromNewPath(subject, partType);
    } else {
      return res.status(400).json({ message: "Must provide either bankPath or (subject and partType)" });
    }

    if (!questions.length) {
      return res.status(400).json({ message: "No questions found" });
    }

    const success = await saveQuestionsToDatabase(assessmentId, partName, sectionName, questions);
    if (!success) {
      return res.status(500).json({ message: "Failed to save questions" });
    }

    res.json({ message: "Questions imported successfully", count: questions.length });
  } catch (error) {
    console.error("Question import error", error);
    res.status(500).json({ message: "Unable to import questions" });
  }
};

const getEnrolledAssessments = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?._id;
    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
    const AssessmentModel = getAssessmentModel();

    let query = AssessmentEnrollmentModel.find({ studentId, accessGranted: true });
    if (typeof query.populate === "function") {
      query = query.populate("assessmentId");
    }

    const enrollments = typeof query.lean === "function" ? await query.lean() : await query;
    const assessments = [];

    for (const enrollment of enrollments) {
      const enrollmentStatus = enrollment.status || enrollment.subscriptionStatus || "active";
      const isExpired = enrollment.expiryDate && new Date() > new Date(enrollment.expiryDate);

      if (["expired", "cancelled"].includes(enrollmentStatus) || isExpired) {
        if (enrollment._id && typeof AssessmentEnrollmentModel.findByIdAndUpdate === "function") {
          await AssessmentEnrollmentModel.findByIdAndUpdate(enrollment._id, {
            status: "expired",
            subscriptionStatus: "expired",
            accessGranted: false,
          }).catch((err) => console.error("Failed to update enrollment status", err));
        }
        continue;
      }

      let assessment = enrollment.assessmentId;
      let assessmentId = assessment?._id ? assessment._id : assessment;
      if (assessment && typeof assessment === "object" && !assessmentId && assessment.toString) {
        assessmentId = assessment.toString();
      }

      if (assessment && typeof assessment === "object" && assessment._id) {
        assessment = { ...assessment };
      } else if (assessmentId) {
        try {
          const fetchedAssessment = await AssessmentModel.findById(assessmentId).lean();
          assessment = fetchedAssessment || null;
        } catch (err) {
          console.log("Failed to fetch assessment:", err.message);
          assessment = null;
        }
      } else {
        assessment = null;
      }

      if (!assessment) {
        continue;
      }

      const expiryDate = enrollment.expiryDate ? new Date(enrollment.expiryDate) : null;
      let daysRemaining = null;
      if (expiryDate) {
        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        daysRemaining = diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
      }

      assessments.push({
        ...assessment,
        subscriptionType: enrollment.subscriptionType || enrollment.source || "direct-purchase",
        subscriptionStatus: enrollment.subscriptionStatus || enrollment.status || "active",
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        daysRemaining,
      });
    }

    res.json({ assessments });
  } catch (error) {
    console.error("Get enrolled assessments error", error);
    console.error(error?.stack || error);
    res.status(500).json({ message: "Unable to fetch enrolled assessments", error: error?.message || "Unknown error" });
  }
};

// NEW ASSESSMENT FLOW ENDPOINTS

// Get assessment with all parts and metadata (for part selection UI)
const getAssessmentWithParts = async (req, res) => {
  try {
    const subject = normalizeSubjectKey(req.params.subject);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const assessment = await getAssessmentModel().findOne({
      subject,
      type: "global",
      status: "published"
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found for this subject" });
    }

    // Return assessment with parts for UI to display part selection
    const response = {
      assessmentId: assessment._id,
      name: assessment.name,
      description: assessment.description,
      subject,
      totalMarks: assessment.totalMarks,
      parts: (assessment.parts || []).map(part => ({
        partName: part.partName,
        partType: part.partType,
        duration: part.duration,
        totalQuestions: part.totalQuestions,
        totalMarks: part.totalMarks,
        instructions: part.instructions,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error("Get assessment with parts error", error);
    res.status(500).json({ message: "Unable to fetch assessment" });
  }
};

// Get available essay types for a given subject theory part
const getAvailableEssayTypes = async (req, res) => {
  try {
    const subject = normalizeSubjectKey(req.params.subject);
    const essayType = String(req.params.essayType || "").trim().toLowerCase();

    if (!subject || subject !== "english") {
      return res.status(400).json({ message: "Essay types only available for English" });
    }

    // Detect available essay types from folder structure
    const theoryDir = path.join(__dirname, "../questions", subject, "theory", "essay");
    
    if (!fs.existsSync(theoryDir)) {
      return res.json({ essayTypes: [] });
    }

    const entries = fs.readdirSync(theoryDir, { withFileTypes: true });
    const essayTypes = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    res.json({
      essayTypes,
      message: essayTypes.length ? "Essay types available" : "No essay types found",
    });
  } catch (error) {
    console.error("Get essay types error", error);
    res.status(500).json({ message: "Unable to fetch essay types" });
  }
};

// Get questions for a specific essay type
const getEssayTypeQuestions = async (req, res) => {
  try {
    const subject = normalizeSubjectKey(req.params.subject);
    const essayType = String(req.params.essayType || "").trim().toLowerCase();

    if (!subject || subject !== "english") {
      return res.status(400).json({ message: "Essay questions only available for English" });
    }

    if (!essayType) {
      return res.status(400).json({ message: "Essay type is required" });
    }

    const candidates = [
      `essay/${essayType}/questions.json`,
      `${essayType}/questions.json`,
      `${essayType}.json`,
    ];

    let rawQuestions = [];
    for (const candidate of candidates) {
      rawQuestions = await loadQuestionsFromFiles(subject, "theory", [candidate]);
      if (rawQuestions && rawQuestions.length) break;
    }

    if (!rawQuestions.length) {
      rawQuestions = await loadQuestionsFromNewPath(subject, "theory", 0, candidates);
    }

    const questions = normalizeQuestionItems(rawQuestions, `${subject}/theory`);
    
    // Return questions with metadata for UI selection
    const questionsList = questions.map((q, idx) => ({
      id: q.questionId || q.id,
      text: q.prompt || q.question,
      guidance: q.guidance,
      index: idx,
    }));

    res.json({
      essayType,
      questions: questionsList,
      count: questionsList.length,
    });
  } catch (error) {
    console.error("Get essay type questions error", error);
    res.status(500).json({ message: "Unable to fetch essay questions" });
  }
};

// Start assessment with part and optional essay selection
const startAssessmentPart = async (req, res) => {
  try {
    fs.appendFileSync(path.join(__dirname, '../start-part-invoked.log'), `startAssessmentPart invoked: ${new Date().toISOString()} - body=${JSON.stringify(req.body)}\n`, 'utf8');
    const { subject, partName, essayType, essayQuestionId } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!subject || !partName) {
      return res.status(400).json({ message: "Subject and part name are required" });
    }

    const normalized = normalizeSubjectKey(subject);
    if (!normalized) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const assessment = await getAssessmentModel().findOne({
      subject: normalized,
      type: "global",
      status: "published"
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Check enrollment/payment
    const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
    let enrollment = await AssessmentEnrollmentModel.findOne({
      assessmentId: assessment._id,
      studentId
    });

    if (!enrollment && assessment.price > 0) {
      return res.status(402).json({
        message: "You must enroll in this assessment first",
        requiresPayment: true,
        assessmentId: assessment._id,
        price: assessment.price,
      });
    }

    // Find the part by any supported name/key
    const normalizedPartName = String(partName || "").trim().toLowerCase();
    const part = assessment.parts?.find((p) => {
      const names = [
        p.partName,
        p.title,
        p.type,
        p.partType,
      ].filter(Boolean).map((val) => String(val).trim().toLowerCase());
      return names.includes(normalizedPartName);
    });
    if (!part) {
      return res.status(404).json({ message: `Part "${partName}" not found in assessment` });
    }

    const selectedPart = partName;

    // Load questions for this part
    let selectedQuestions = [];
    const partType = part.partType?.toLowerCase() || "objective";

    // For theory parts with essay
    if (partType === "theory" && normalized === "english" && essayType) {
      const candidates = [
        `essay/${essayType}/questions.json`,
        `${essayType}/questions.json`,
        `${essayType}.json`,
      ];

      let rawQuestions = await loadQuestionsFromFiles(normalized, partType, candidates);
      if (!rawQuestions.length) {
        rawQuestions = await loadQuestionsFromNewPath(normalized, partType, 0, candidates);
      }

      let normalizedQs = normalizeQuestionItems(rawQuestions, `${normalized}/theory`);

      // If specific essay question ID provided, use only that
      if (essayQuestionId) {
        const essayId = String(essayQuestionId).trim();
        const found = normalizedQs.find(q => {
          const id = String(q.questionId || q.id || q._id || "");
          return id === essayId || id.endsWith(essayId);
        });
        if (!found) {
          return res.status(400).json({ message: `Essay question "${essayId}" not found` });
        }
        selectedQuestions = [found];
      } else {
        selectedQuestions = normalizedQs;
      }
    } else {
      // For objective and other parts, load normally. For oral parts, use the specialized loader.
      let oralMeta = null;
      for (const section of part.sections || []) {
        let sectionQuestions = [];
        if (String(partType || "").trim().toLowerCase() === "oral") {
          sectionQuestions = await loadOralSectionQuestions(normalized, section, Number(section.questionCount) || 0, req.body.oralType, req.body.oralYear);
          // capture oral metadata if provided by loader
          if (!oralMeta && sectionQuestions && sectionQuestions._oralMeta) {
            oralMeta = sectionQuestions._oralMeta;
          }
        } else {
          sectionQuestions = await loadSectionQuestions(normalized, partType, section);
        }

        if (sectionQuestions && sectionQuestions.length) {
          selectedQuestions.push(...sectionQuestions);
        }
      }

      selectedQuestions = normalizeQuestionItems(selectedQuestions, normalized);
      // expose oralMeta for later inclusion in attempt/response
      if (oralMeta) {
        selectedQuestions._oralMeta = oralMeta;
      }
    }

    if (!selectedQuestions.length) {
      return res.status(400).json({ message: `No questions available for ${partName}` });
    }

    // Compute duration and total marks for the part (fall back to assessment values)
    const partDuration = Number(part?.duration || assessment?.duration || 0);
    const partTotalMarks = Number(part?.totalMarks || assessment?.totalMarks || selectedQuestions.length || 0);

    const attemptPayload = {
      assessmentType: 'standard',
      assessmentId: assessment._id,
      assessmentTypeRef: 'StandardAssessment',
      studentId,
      status: 'in-progress',
      sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      duration: partDuration,
      timeLeft: partDuration * 60,
      totalMarks: partTotalMarks,
      selectedPart: partName,
      answers: [],
      questions: selectedQuestions,
      total: selectedQuestions.length,
    };

    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        partName,
        partType,
        partDuration,
        partTotalMarks,
        selectedQuestions: selectedQuestions.length,
        payloadSample: {
          assessmentType: attemptPayload.assessmentType,
          assessmentTypeRef: attemptPayload.assessmentTypeRef,
          duration: attemptPayload.duration,
          totalMarks: attemptPayload.totalMarks,
          selectedPart: attemptPayload.selectedPart,
          total: attemptPayload.total,
        },
      };
      fs.appendFileSync(path.join(__dirname, '../start-part-debug.log'), JSON.stringify(debugData, null, 2) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write start-part debug log', err);
    }

    console.error('[DEBUG startAssessmentPart] partName=', partName, 'partType=', partType, 'partDuration=', partDuration, 'partTotalMarks=', partTotalMarks, 'selectedQuestions=', selectedQuestions.length);
    console.error('[DEBUG startAssessmentPart] attemptPayload keys=', Object.keys(attemptPayload));
    console.error('[DEBUG startAssessmentPart] attemptPayload sample=', JSON.stringify({
      assessmentType: attemptPayload.assessmentType,
      assessmentTypeRef: attemptPayload.assessmentTypeRef,
      duration: attemptPayload.duration,
      totalMarks: attemptPayload.totalMarks,
      selectedPart: attemptPayload.selectedPart,
      total: attemptPayload.total,
    }, null, 2));

    // Determine if client requests a forced new attempt
    const forceNew = req?.query?.forceNew === '1' || req?.body?.forceNew === true || (req?.headers && (req.headers['x-force-new-attempt'] === '1' || req.headers['x-force-new-attempt'] === 'true'));

    // Prevent reopening submitted/completed attempts; resume in-progress attempts unless forced
    const AttemptModel = getAssessmentAttemptModel();
    const existingAttempt = await AttemptModel.findOne({ assessmentId: assessment._id, studentId, selectedPart }).sort({ createdAt: -1 }).lean();
    if (existingAttempt && (existingAttempt.status === 'submitted' || existingAttempt.status === 'completed' || existingAttempt.status === 'graded')) {
      return res.status(403).json({ message: 'This assessment attempt has already been submitted and cannot be reopened.' });
    }
    if (!forceNew && existingAttempt && existingAttempt.status === 'in-progress') {
      // Resume existing in-progress attempt
      const resumed = await AttemptModel.findById(existingAttempt._id);
      if (selectedQuestions && selectedQuestions._oralMeta) {
        resumed.fullAudio = selectedQuestions._oralMeta.full_audio || resumed.fullAudio || null;
        resumed.oralType = selectedQuestions._oralMeta.oralType || resumed.oralType || null;
        resumed.oralYear = selectedQuestions._oralMeta.oralYear || resumed.oralYear || null;
      } else if (selectedQuestions && selectedQuestions[0]) {
        resumed.fullAudio = selectedQuestions[0]?.fullAudio || resumed.fullAudio || null;
        resumed.oralType = selectedQuestions[0]?.oralType || resumed.oralType || null;
        resumed.oralYear = selectedQuestions[0]?.oralYear || resumed.oralYear || null;
      }
      await resumed.save();
      const sanitized = resumed.toObject ? resumed.toObject() : { ...resumed };
      sanitized.questions = removeQuestionAnswers(sanitized.questions || selectedQuestions);
      return res.json({
        message: 'Resuming existing attempt',
        attemptId: resumed._id,
        questions: sanitized.questions,
        answers: resumed.answers || [],
        timeLeft: resumed.timeLeft != null ? resumed.timeLeft : part.duration * 60,
        currentQuestionIndex: resumed.currentQuestionIndex != null ? resumed.currentQuestionIndex : 0,
        timeLimit: part.duration,
        partName,
        fullAudio: resumed.fullAudio || null,
        oralType: resumed.oralType || null,
        oralYear: resumed.oralYear || null,
      });
    }

    // Create attempt (include required fields from AssessmentAttempt schema)
    const attemptPayloadDb = {
      assessmentType: "standard",
      assessmentId: assessment._id,
      assessmentTypeRef: "StandardAssessment",
      studentId,
      status: "in-progress",
      sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      duration: partDuration,
      timeLeft: partDuration * 60,
      totalMarks: partTotalMarks,
      selectedPart: partName,
      answers: [],
      questions: selectedQuestions,
      total: selectedQuestions.length,
    };

    // If oral metadata exists on the selectedQuestions array, include it in the DB record
    if (selectedQuestions && selectedQuestions._oralMeta) {
      attemptPayloadDb.fullAudio = selectedQuestions._oralMeta.full_audio || null;
      attemptPayloadDb.oralType = selectedQuestions._oralMeta.oralType || null;
      attemptPayloadDb.oralYear = selectedQuestions._oralMeta.oralYear || null;
      attemptPayloadDb.oralDurationMinutes = selectedQuestions._oralMeta.duration_minutes || null;
    } else if (selectedQuestions && selectedQuestions[0]) {
      attemptPayloadDb.fullAudio = selectedQuestions[0]?.fullAudio || null;
      attemptPayloadDb.oralType = selectedQuestions[0]?.oralType || null;
      attemptPayloadDb.oralYear = selectedQuestions[0]?.oralYear || null;
      attemptPayloadDb.oralDurationMinutes = selectedQuestions[0]?.oralDurationMinutes || null;
    }

    const attempt = await getAssessmentAttemptModel().create(attemptPayloadDb);

    const sanitizedAttempt = attempt.toObject ? attempt.toObject() : { ...attempt };
    sanitizedAttempt.questions = removeQuestionAnswers(selectedQuestions);

    const responsePayload = {
      message: "Assessment part started",
      attemptId: attempt._id,
      questions: sanitizedAttempt.questions,
      answers: attempt.answers || [],
      timeLeft: attempt.timeLeft != null ? attempt.timeLeft : part.duration * 60,
      currentQuestionIndex: attempt.currentQuestionIndex != null ? attempt.currentQuestionIndex : 0,
      timeLimit: part.duration,
      partName,
    };

    if (selectedQuestions && selectedQuestions._oralMeta) {
      responsePayload.fullAudio = selectedQuestions._oralMeta.full_audio || null;
      responsePayload.oralType = selectedQuestions._oralMeta.oralType || null;
      responsePayload.oralYear = selectedQuestions._oralMeta.oralYear || null;
      responsePayload.oralDurationMinutes = selectedQuestions._oralMeta.duration_minutes || null;
    } else if (selectedQuestions && selectedQuestions[0]) {
      responsePayload.fullAudio = selectedQuestions[0]?.fullAudio || null;
      responsePayload.oralType = selectedQuestions[0]?.oralType || null;
      responsePayload.oralYear = selectedQuestions[0]?.oralYear || null;
      responsePayload.oralDurationMinutes = selectedQuestions[0]?.oralDurationMinutes || null;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("Start assessment part error", error);
    res.status(500).json({ message: "Unable to start assessment part", error: error.message });
  }
};

const aiMarkAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: "Invalid attemptId" });
    }
    console.log('aiMarkAttempt called for', attemptId);
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    let attempt = null;
    attempt = await AssessmentAttemptModel.findById(attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const assessment = await getAssessmentModel().findById(attempt.assessmentId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    const questions = attempt.questions || [];
    attempt.answers = attempt.answers || [];

    for (let i = 0; i < attempt.answers.length; i++) {
      const ans = attempt.answers[i];
      console.log(`Processing answer ${i} questionIndex=${ans.questionIndex} aiMarked=${ans.aiMarked}`);
      const q = questions[ans.questionIndex] || {};
      // Mark any answer that hasn't been AI marked yet. Avoid skipping due to varying question metadata.
      const needsAi = !ans.aiMarked;
      if (!needsAi) continue;

      const questionText = ans.questionText || q.prompt || q.text || (typeof q.question === 'string' ? q.question : '') || q.question?.prompt || q.question?.text || '';
      const rubric = deriveAnswerRubric(ans, q);
      const englishEssayRubric = normalizeEnglishEssayRubric(rubric);
      const markingCriteria = q.markingCriteria || q.marking_criteria || q.question?.markingCriteria || q.question?.marking_criteria || null;
      const minimumWordCount = q.minimumWords || q.minimum_words || q.question?.minimumWords || q.question?.minimum_words || null;
      const totalMarks = Number(
        ans.totalMarks ??
          q.totalMarks ??
          q.total_marks ??
          q.marks ??
          (rubric ? Object.values(rubric).reduce((sum, value) => sum + Number(value || 0), 0) : 5)
      ) || 5;
      const expectedPoints = Number(
        q.totalMarks ?? q.total_marks ?? ans.totalMarks ?? totalMarks
      ) || totalMarks;
      const modelAnswer = q.modelAnswer || q.model_answer || q.question?.modelAnswer || q.question?.model_answer || null;
      const markingType = String(
        q.markingType || q.marking_type || q.question?.markingType || q.question?.marking_type || ''
      ).trim().toLowerCase();
      const markingGuide =
        q.markingGuide || q.marking_guide || q.markingCriteria || q.marking_criteria ||
        q.question?.markingGuide || q.question?.marking_guide || q.question?.markingCriteria || q.question?.marking_criteria || null;
      if (!ans.totalMarks) ans.totalMarks = totalMarks;

      const qTypeKey = String(q.questionType || q.type || q.subType || q.sectionName || q.section_title || '').trim().toLowerCase();
      const isEssayQuestion = isEnglishEssayQuestion(q) || !!englishEssayRubric || qTypeKey.includes('essay');
      const isComprehensionQuestion = qTypeKey.includes('comprehension');
      const isSummaryQuestion = qTypeKey.includes('summary');
      const isAnswerKeyBased = markingType === 'answer_key';
      const isInstructionBased = markingType === 'instruction';

      try {
        let report = null;

        if (isInstructionBased) {
          const essayType = q.question?.essay_type || q.essayType || q.type || q.questionType || 'essay';
          if (isEssayQuestion || !markingGuide) {
            const evaluation = await aiMarkingService.evaluateEnglishEssay({
              essayType,
              essayText: questionText,
              studentAnswer: ans.studentAnswer || '',
              modelAnswer,
              rubric: markingGuide || englishEssayRubric || {
                WordCount: 5,
                Content: 10,
                Organization: 10,
                Expression: 10,
                MechanicalAccuracy: 15,
              },
              minimumWordCount: minimumWordCount || 450,
            });
            report = evaluation.report;
          } else {
            const evaluation = await aiMarkingService.evaluateAnswer({
              questionText,
              rubric: markingGuide,
              markingCriteria,
              expectedPoints,
              minimumWordCount,
              modelAnswer,
              studentAnswer: ans.studentAnswer || '',
              totalMarks,
            });
            report = evaluation.report;
          }
        } else if (isAnswerKeyBased) {
          const evaluation = await aiMarkingService.evaluateAnswer({
            questionText,
            rubric,
            markingCriteria,
            expectedPoints,
            minimumWordCount,
            modelAnswer,
            studentAnswer: ans.studentAnswer || '',
            totalMarks,
          });
          report = evaluation.report;
        } else if (isEssayQuestion) {
          const essayType = q.question?.essay_type || q.essayType || q.type || q.questionType || 'essay';
          const evaluation = await aiMarkingService.evaluateEnglishEssay({
            essayType,
            essayText: questionText,
            studentAnswer: ans.studentAnswer || '',
            modelAnswer,
            rubric: englishEssayRubric || markingGuide || {
              WordCount: 5,
              Content: 10,
              Organization: 10,
              Expression: 10,
              MechanicalAccuracy: 15,
            },
            minimumWordCount: minimumWordCount || 450,
          });
          report = evaluation.report;
        } else if (isComprehensionQuestion || isSummaryQuestion) {
          const evaluation = await aiMarkingService.evaluateComprehensionOrSummary({
            passageText: q.passage || q.passageText || q.question?.passage || q.question?.passageText || '',
            questionText,
            studentAnswer: ans.studentAnswer || '',
            modelAnswer,
            questionType: isSummaryQuestion ? 'summary' : 'comprehension',
          });
          report = evaluation.report;
        } else {
          const evaluation = await aiMarkingService.evaluateAnswer({
            questionText,
            rubric,
            markingCriteria,
            expectedPoints,
            minimumWordCount,
            modelAnswer,
            studentAnswer: ans.studentAnswer || '',
            totalMarks,
          });
          report = evaluation.report;
        }

        if (report && report.totalScore != null && report.score == null) {
          report.score = report.totalScore;
        }
        if (report && report.score == null && report.categoryScores) {
          report.score = Object.values(report.categoryScores).reduce((sum, value) => sum + Number(value || 0), 0);
        }

        ans.aiReport = report;
        ans.aiFeedback = report?.feedback || '';
        ans.aiMarked = true;
        ans.marks = Number.isFinite(Number(report?.score)) ? Number(report.score) : 0;
      } catch (err) {
        console.error('AI mark error', err);
        // Fallback: run local heuristic grader so attempt stores an aiReport
        try {
          const fallback = await aiMarkingService.simpleLocalGrader({ questionText, rubric, modelAnswer, studentAnswer: ans.studentAnswer || '', totalMarks });
          ans.aiReport = fallback.report;
          ans.aiFeedback = fallback.report.feedback || '';
          ans.aiMarked = true;
          ans.marks = Number.isFinite(Number(fallback.report.score)) ? Number(fallback.report.score) : 0;
        } catch (fallbackErr) {
          console.error('Local grading fallback failed', fallbackErr);
          ans.aiMarked = false;
          ans.aiFeedback = `AI marking error: ${err.message || err}`;
        }
      }
    }

    attempt.totalMarks = attempt.answers.reduce((sum, answer) => sum + (Number(answer.totalMarks) || 0), 0) || attempt.totalMarks || assessment?.totalMarks || 0;
    attempt.obtainedMarks = attempt.answers.reduce((sum, answer) => sum + (Number(answer.marks) || 0), 0);
    attempt.percentage = attempt.totalMarks > 0 ? (attempt.obtainedMarks / attempt.totalMarks) * 100 : 0;
    attempt.passed = attempt.percentage >= (assessment?.passingScore || 50);
    attempt.status = 'marked';
    attempt.markedAt = new Date();
    attempt.aiReport = buildAttemptAiReport(attempt);
    await attempt.save();

    res.json({ success: true, attempt });
  } catch (error) {
    console.error('aiMarkAttempt error', error);
    if (typeof attempt !== 'undefined' && attempt) {
      try {
        attempt.status = 'pending-review';
        await attempt.save();
      } catch (saveErr) {
        console.error('Failed to save attempt after AI marking failure', saveErr);
      }
    }
    res.status(200).json({
      success: false,
      message: 'AI marking could not be completed right now. Your attempt has been saved for later review.',
      error: error.message || 'AI marking failed',
      attempt: typeof attempt !== 'undefined' ? attempt : null,
    });
  }
};

module.exports = {
  createAssessment,
  updateAssessment,
  getAssessments,
  getPublicGlobalAssessments,
  getAssessmentById,
  getAssessmentTemplate,
  startAssessment,
  getAssessmentBySubject,
  findSubjectAssessment,
  getEssayQuestions,
  startAssessmentBySubject,
  startCourseSectionByCourseSection,
  autoSaveAnswer,
  submitAssessment,
  enrollInAssessment,
  getEnrolledAssessments,
  deleteAssessment,
  recordTabSwitch,
  getAttempt,
  getAttempts,
  startOralAssessment,
  updateAttemptTimeLeft,
  getAttemptResume,
  // AI marking
  aiMarkAttempt,
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  importQuestionsFromBank,
  // New assessment flow exports
  getAssessmentWithParts,
  getAvailableEssayTypes,
  getEssayTypeQuestions,
  getAvailableOralTypes,
  startAssessmentPart,
  getQuestionsByPath,
  previewStartBySubject,
};

// Debug helper: clear in-progress attempts for a student and assessment
const clearInProgressAttempts = async (req, res) => {
  try {
    const { assessmentId, studentId } = req.body || {};
    if (!assessmentId || !studentId) return res.status(400).json({ message: 'assessmentId and studentId are required' });
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const result = await AssessmentAttemptModel.deleteMany({ assessmentId, studentId, status: 'in-progress' });
    return res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('clearInProgressAttempts error', err);
    return res.status(500).json({ message: err && err.message });
  }
};

// Attach debug export
module.exports.clearInProgressAttempts = clearInProgressAttempts;

const clearMyInProgress = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?._id;
    const { assessmentId } = req.body || {};
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });
    if (!assessmentId) return res.status(400).json({ message: 'assessmentId is required' });
    const AssessmentAttemptModel = getAssessmentAttemptModel();
    const result = await AssessmentAttemptModel.deleteMany({ assessmentId, studentId, status: 'in-progress' });
    return res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('clearMyInProgress error', err);
    return res.status(500).json({ message: err && err.message });
  }
};

module.exports.clearMyInProgress = clearMyInProgress;
