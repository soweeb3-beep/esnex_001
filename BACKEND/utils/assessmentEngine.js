const fs = require("fs").promises;
const path = require("path");
const {
  normalizeSubjectKey,
  loadQuestionsFromFiles,
  resolveSectionFiles,
  loadQuestionsFromJsonBank,
  findQuestionDirectory,
} = require("./examLoader");
const {
  normalizeQuestionItems,
  pickRandom,
} = require("../services/questionGenerator.service");

const debugLog = (...args) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[assessmentEngine]", ...args);
  }
};

const getQuestionKey = (question) => {
  if (!question || typeof question !== "object") return "";
  return String(question.questionId || question.id || question._id || question.text || question.question || "").trim();
};

const { shuffleArray } = require("./random");

const loadOneQuestionPerFile = async (subject, partType, fileList = [], excludeIds = new Set()) => {
  const results = [];
  if (!Array.isArray(fileList) || !fileList.length) return results;

  for (const fileName of fileList) {
    const rawQuestions = await loadQuestionsFromFiles(subject, partType, [fileName]);
    let questions = normalizeQuestionItems(rawQuestions, `${subject}/${partType}`);

    if (excludeIds && excludeIds instanceof Set) {
      questions = questions.filter((question) => {
        const key = getQuestionKey(question);
        return key && !excludeIds.has(key);
      });
    }

    if (!questions.length) continue;
    const chosen = questions[Math.floor(Math.random() * questions.length)];
    if (!chosen) continue;
    const key = getQuestionKey(chosen);
    if (key && excludeIds instanceof Set) excludeIds.add(key);
    results.push(chosen);
  }

  return results;
};

const loadSectionQuestions = async (subject, partType, section, excludeIds = new Set(), options = {}) => {
  const normalizedSubject = normalizeSubjectKey(subject);
  const normalizedType = String(partType || "objective").trim().toLowerCase();
  const fileList = resolveSectionFiles(section, "questions.json");
  const questionCount = Number(section.questionCount) || 0;

  debugLog("Loading section questions", { normalizedSubject, normalizedType, section: section.name || section.key, fileList, questionCount });

  let questions = [];
  const essaySection = normalizedType === "theory" && String(section.key || section.name || "").trim().toLowerCase().includes("essay");

  if (essaySection) {
    debugLog("Loading essay section questions", { normalizedSubject, fileList });

    const questionsFromSubdirs = [];
    const basePath = await findQuestionDirectory(normalizedSubject, normalizedType, fileList);
    const essayDir = path.join(basePath, "essay");
    const dirEntries = await fs.readdir(essayDir, { withFileTypes: true }).catch(() => []);
    const essaySubdirs = dirEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    if (essaySubdirs.length) {
      debugLog("Found essay subdirectories", { essaySubdirs });
      const selectedDirs = pickRandom(essaySubdirs, Number(section.questionCount) || 1);
      for (const subdir of selectedDirs) {
        const candidates = [
          `essay/${subdir}/questions.json`,
          `${subdir}/questions.json`,
          `${subdir}.json`,
        ];
        let rawQuestions = [];
        for (const candidate of candidates) {
          rawQuestions = await loadQuestionsFromFiles(normalizedSubject, normalizedType, [candidate]);
          if (rawQuestions && rawQuestions.length) break;
        }
        const normalizedQuestions = normalizeQuestionItems(rawQuestions, `${normalizedSubject}/${normalizedType}`);
        if (normalizedQuestions.length) {
          questionsFromSubdirs.push(...normalizedQuestions);
        }
      }
    }

    if (!questionsFromSubdirs.length) {
      debugLog("Falling back to loadOneQuestionPerFile for essay section", { fileList });
      questions = await loadOneQuestionPerFile(normalizedSubject, normalizedType, fileList, excludeIds);
    } else {
      questions = questionsFromSubdirs;
    }

    if (excludeIds && excludeIds instanceof Set) {
      questions = questions.filter((question) => {
        const key = getQuestionKey(question);
        return key && !excludeIds.has(key);
      });
    }
  } else {
    const rawQuestions = await loadQuestionsFromFiles(normalizedSubject, normalizedType, fileList);
    questions = normalizeQuestionItems(rawQuestions, `${normalizedSubject}/${normalizedType}`);

    const sectionKey = String(section.key || section.name || '').toLowerCase();
    if (sectionKey.includes('summary')) {
      questions = questions.filter((question) =>
        String(question.questionType || question.type || '')
          .toLowerCase()
          .includes('summary')
      );
    } else if (sectionKey.includes('comprehension') || sectionKey.includes('passage')) {
      questions = questions.filter((question) =>
        String(question.questionType || question.type || '')
          .toLowerCase()
          .includes('comprehension')
      );
    }

    if (excludeIds && excludeIds instanceof Set) {
      questions = questions.filter((question) => {
        const key = getQuestionKey(question);
        return key && !excludeIds.has(key);
      });
    }
  }

  if (!questions.length && section.bankPath) {
    debugLog("Falling back to section bankPath", section.bankPath);
    questions = await loadQuestionsFromJsonBank(section.bankPath, 0);
  }

  if (!questions.length) {
    debugLog("No questions found for section", section.name || section.key);
    return [];
  }

    if (questionCount > 0) {
    // If the question bank size is less than or equal to requested count, shuffle and return
    const N = questions.length;
    const k = questionCount;
    const prevAttempts = Number(options.previousAttemptsCount) || 0;
    if (N <= k) {
      // Shuffle full bank and rotate by previousAttempts so repeated attempts show different ordering
      const shuffledFull = shuffleArray(questions);
      try {
        console.error(`[DIAG] loadSectionQuestions (N<=k) before rotate ids=${shuffledFull.map(q=>getQuestionKey(q)).join(',')}`);
      } catch(e) {}
      const offsetFull = prevAttempts % N;
      const rotated = shuffledFull.slice(offsetFull).concat(shuffledFull.slice(0, offsetFull));
      try {
        console.error(`[DIAG] loadSectionQuestions (N<=k) after rotate offset=${offsetFull} ids=${rotated.map(q=>getQuestionKey(q)).join(',')}`);
      } catch(e) {}
      questions = rotated.slice(0, k);
    } else {
      // Rotate a shuffled list based on previousAttemptsCount so items don't repeat until the pool is exhausted
      const shuffled = shuffleArray(questions);
      try {
        console.error(`[DIAG] loadSectionQuestions (N>k) shuffled ids=${shuffled.map(q=>getQuestionKey(q)).join(',')}`);
      } catch(e) {}
      const offset = (prevAttempts * k) % N;
      const selected = [];
      for (let i = 0; i < k; i++) {
        selected.push(shuffled[(offset + i) % N]);
      }
      questions = selected;
    }
  }

  if (excludeIds && excludeIds instanceof Set) {
    questions.forEach((question) => {
      const key = getQuestionKey(question);
      if (key) excludeIds.add(key);
    });
  }

  return questions;
};

const loadPartQuestions = async (subject, part) => {
  const excludeIds = new Set();
  const results = [];

  for (const section of Array.isArray(part.sections) ? part.sections : []) {
    const questions = await loadSectionQuestions(subject, part.partType || part.type, section, excludeIds);
    results.push({ section, questions });
  }

  return results;
};

const countAvailableQuestionsForSection = async (subject, partType, section) => {
  const normalizedSubject = normalizeSubjectKey(subject);
  const normalizedType = String(partType || "objective").trim().toLowerCase();

  const questions = await loadSectionQuestions(normalizedSubject, normalizedType, { ...section, questionCount: 0 }, new Set());
  if (questions.length) {
    return questions.length;
  }

  if (section.bankPath) {
    const fallbackQuestions = await loadQuestionsFromJsonBank(section.bankPath, 0);
    return fallbackQuestions.length;
  }

  return 0;
};

module.exports = {
  loadSectionQuestions,
  loadPartQuestions,
  countAvailableQuestionsForSection,
  loadQuestionsFromJsonBank,
};
