const { loadQuestionsFromFiles, getSubjectConfig, inferSubjectConfig, normalizeSubjectKey, resolveSectionFiles, loadQuestionsFromJsonBank } = require("../utils/examLoader");

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const { shuffleArray } = require("../utils/random");
const pickRandom = (items, count) => {
  if (!Array.isArray(items)) return [];
  if (!count || count >= items.length) return [...items];
  return shuffleArray(items).slice(0, count);
};

const normalizeQuestionItems = (questions = [], bankPath = "") => {
  const seen = new Set();

  const getDefaultQuestionType = (question) => {
    if (question.type || question.questionType) {
      return question.type || question.questionType;
    }
    if (question.options) {
      return "mcq";
    }
    if (question.answer || question.correctAnswer || question.sampleAnswer || question.solution) {
      return "text";
    }
    return "text";
  };

  const normalizeOptionsAndAnswer = (question) => {
    let options = question.options;
    let correctAnswer = question.correctAnswer ?? question.answer;
    const defaultType = getDefaultQuestionType(question);
    const sampleAnswer =
      question.sampleAnswer ||
      question.sample_answer ||
      question.sample_answer_summary ||
      question.answer ||
      "";

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
      const index = correctAnswer.trim().toUpperCase().charCodeAt(0) - 65;
      if (options[index] !== undefined) {
        correctAnswer = options[index];
      }
    }

    const explicitType = question.type || question.questionType;
    const normalizedType = options && Array.isArray(options) && options.length > 0
      ? (explicitType && !["comprehension", "summary", "standard"].includes(String(explicitType).trim().toLowerCase())
        ? explicitType
        : "mcq")
      : explicitType || defaultType;

    return {
      ...question,
      type: normalizedType,
      questionType: normalizedType,
      options,
      correctAnswer,
      answer: correctAnswer,
      sampleAnswer,
      text: question.text || question.prompt || question.question || question.topic || "",
    };
  };

  const normalizeQuestion = (question, index) => {
    const id = String(question.questionId || question.id || question._id || `${bankPath || "bank"}_${index}`).trim();
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
  };

  const normalizeGroup = (group, index) => {
    const groupId = String(group.questionId || group.id || group._id || `${bankPath || "bank_group"}_${index}`).trim();
    const questionType = group.questionType || group.type || "comprehension";
    const normalized = {
      ...group,
      questionId: groupId,
      type: questionType,
      questionType,
      text: group.text || group.title || group.section_title || "",
    };

    if (Array.isArray(group.questions)) {
      normalized.questions = group.questions.map((child, childIndex) => normalizeQuestion(child, `${index}.${childIndex}`));
    }

    if (group.summary && Array.isArray(group.summary.questions)) {
      normalized.questions = group.summary.questions.map((child, childIndex) => normalizeQuestion(child, `${index}.${childIndex}`));
      normalized.questionType = group.summary.questionType || "summary";
      normalized.type = group.summary.type || normalized.type;
      normalized.instruction = group.summary.instruction || normalized.instruction;
      normalized.section_title = group.summary.section_title || normalized.section_title;
    }

    return normalized;
  };

  return questions
    .map((question, index) => {
      if (
        question && typeof question === "object" &&
        (Array.isArray(question.passage) || typeof question.passage === "string") &&
        (Array.isArray(question.questions) || (question.summary && Array.isArray(question.summary.questions)))
      ) {
        return normalizeGroup(question, index);
      }
      return normalizeQuestion(question, index);
    })
    .filter((question) => {
      const key = String(question.questionId || question.id || question.text || question.question || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const filterQuestions = (questions = [], filters = {}) => {
  if (!Array.isArray(questions)) return [];
  return questions.filter((question) => {
    if (filters.year && Number(question.year) !== Number(filters.year)) return false;
    if (filters.topic && question.topic && !String(question.topic).toLowerCase().includes(String(filters.topic).toLowerCase())) return false;
    if (filters.difficulty && question.difficulty && String(question.difficulty).toLowerCase() !== String(filters.difficulty).toLowerCase()) return false;
    return true;
  });
};

const removeQuestionAnswers = (questions = []) => {
  const sanitize = (question) => {
    if (!question || typeof question !== "object") return question;
    const {
      correctAnswer,
      answer,
      sampleAnswer,
      explanation,
      solution,
      rationale,
      ...safeFields
    } = question;

    if (Array.isArray(question.questions)) {
      safeFields.questions = question.questions.map((subQuestion) => sanitize(subQuestion));
    }

    if (question.summary && Array.isArray(question.summary.questions)) {
      safeFields.summary = {
        ...question.summary,
        questions: question.summary.questions.map((subQuestion) => sanitize(subQuestion)),
      };
    }

    return safeFields;
  };

  return questions.map((question) => sanitize(question));
};

const loadQuestionsForSection = async (subject, partType, section = {}, questionCount, filters = {}, excludeIds = new Set()) => {
  const normalizedSubject = normalizeSubjectKey(subject) || String(subject || "").trim().toLowerCase();
  const examType = String(partType || "objective").trim().toLowerCase();
  const fileList = resolveSectionFiles(section, "questions.json");
  let rawQuestions = await loadQuestionsFromFiles(normalizedSubject, examType, fileList);
  let normalized = normalizeQuestionItems(rawQuestions, `${normalizedSubject}/${examType}`);

  if (!normalized.length && section.bankPath) {
    const bankQuestions = await loadQuestionsFromJsonBank(section.bankPath);
    normalized = normalizeQuestionItems(bankQuestions, section.bankPath);
  }

  const filtered = filterQuestions(normalized, filters).filter((question) => {
    if (!excludeIds || !(excludeIds instanceof Set)) return true;
    const questionId = String(question.questionId || question.id || question._id || question.text || question.question || "").trim();
    return questionId && !excludeIds.has(questionId);
  });

  if (!questionCount || Number(questionCount) <= 0) {
    console.warn(`Invalid or missing questionCount for subject=${normalizedSubject}, partType=${partType}, files=${JSON.stringify(fileList)}`);
    return [];
  }

  const selectCount = Math.min(Number(questionCount), filtered.length);
  const selected = pickRandom(filtered, selectCount);
  console.error(`[DEBUG] loadQuestionsForSection: subject=${normalizedSubject}, examType=${examType}, files=${JSON.stringify(fileList)}, raw=${rawQuestions.length}, filtered=${filtered.length}, requested=${questionCount}, selected=${selected.length}`);
  if (filtered.length > Number(questionCount)) {
    console.error(`[DEBUG] loadQuestionsForSection: ${filtered.length - Number(questionCount)} extra questions were available and the requested count was used.`);
  }
  if (excludeIds && excludeIds instanceof Set) {
    selected.forEach((question) => {
      const questionId = String(question.questionId || question.id || question._id || question.text || question.question || "").trim();
      if (questionId) excludeIds.add(questionId);
    });
  }

  return selected;
};

const generateExamFromSubject = async (subject) => {
  const normalized = String(subject || "").trim().toLowerCase();
  if (!normalized) return null;

  let subjectConfig = await getSubjectConfig(normalized);
  if (!subjectConfig) {
    subjectConfig = await inferSubjectConfig(normalized);
  }

  if (!subjectConfig) return null;

  return subjectConfig;
};

module.exports = {
  escapeRegExp,
  pickRandom,
  normalizeQuestionItems,
  filterQuestions,
  removeQuestionAnswers,
  loadQuestionsForSection,
  generateExamFromSubject,
};
