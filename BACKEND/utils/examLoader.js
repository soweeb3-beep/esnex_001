const fs = require("fs").promises;
const path = require("path");

const questionsDir = path.join(__dirname, "..", "questions");
const configPath = path.join(questionsDir, "config.json");

const debugLog = (...args) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[examLoader]", ...args);
  }
};

const verboseLog = (...args) => {
  const enabled = String(process.env.DEBUG_ASSESSMENT_LOAD || "").trim();
  if (enabled === "1" || enabled.toLowerCase() === "true") {
    try {
      console.error("[examLoader:VERBOSE]", ...args);
    } catch (e) {
      // swallow logging errors
    }
  }
};

const shuffleArray = (items) => {
  return [...items].sort(() => 0.5 - Math.random());
};

const sanitizeJsonContent = (raw) => {
  const cleaned = raw.trim();
  if (!cleaned) return cleaned;
  const firstChar = cleaned[0];
  if (firstChar === "{" || firstChar === "[") {
    return cleaned;
  }

  const firstJsonCharIndex = cleaned.search(/[\{\[]/);
  return firstJsonCharIndex >= 0 ? cleaned.slice(firstJsonCharIndex) : cleaned;
};

const readJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = sanitizeJsonContent(raw);
    return JSON.parse(sanitized);
  } catch (err) {
    verboseLog(`Failed to read/parse JSON file: ${filePath}`, err && err.message, err && err.stack);
    throw err;
  }
};

const normalizeSubjectKey = (subject) => {
  if (!subject || typeof subject !== "string") return null;
  const cleaned = subject.trim().toLowerCase();
  const aliasMap = {
    maths: "maths",
    math: "maths",
    mathematics: "maths",
    english: "english",
    eng: "english",
    literature: "english",
    language: "english",
    ict: "ict",
    it: "ict",
    computer: "ict",
    information: "ict",
  };
  return aliasMap[cleaned] || cleaned;
};

const getSubjectConfig = async (subject) => {
  let config;
  try {
    config = await readJson(configPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  const key = normalizeSubjectKey(subject);
  return key ? config[key] || null : null;
};

const toTitleCase = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const inferSubjectConfig = async (subject) => {
  if (!subject) return null;

  const normalizedSubject = normalizeSubjectKey(subject);
  if (!normalizedSubject) return null;

  const subjectDisplayName = toTitleCase(subject);
  const supportedTypes = ["objective", "theory", "oral", "practical"];
  const inferred = {
    displayName: subjectDisplayName,
    examTypes: [],
    objective: { parts: [] },
    theory: { types: [] },
    oral: { sections: [] },
    practical: { sections: [] },
    timeLimit: 60,
  };

  for (const examType of supportedTypes) {
    const basePath = await findQuestionDirectory(normalizedSubject, examType);
    if (!(await pathExists(basePath))) continue;

    const discoverQuestionFiles = async (dir, relative = "") => {
      const results = [];
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const entryRel = normalizePath(relative ? path.join(relative, entry.name) : entry.name);
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await discoverQuestionFiles(entryPath, entryRel)));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
          results.push(entryRel);
        }
      }
      return results;
    };

    const jsonFiles = await discoverQuestionFiles(basePath);
    if (!jsonFiles.length) continue;

    let totalCount = 0;
    const fileQuestions = {};
    for (const fileName of jsonFiles) {
      const questions = await loadQuestionsFromFiles(normalizedSubject, examType, [fileName]);
      if (questions.length) {
        fileQuestions[fileName] = questions.length;
        totalCount += questions.length;
      }
    }
    if (!totalCount) continue;

    inferred.examTypes.push(examType);
    for (const fileName of Object.keys(fileQuestions)) {
      const directoryName = path.dirname(fileName);
      const sectionKey = fileName.toLowerCase().endsWith("questions.json")
        ? (directoryName && directoryName !== "." ? path.basename(directoryName) : examType)
        : path.basename(fileName, path.extname(fileName));
      const sectionData = {
        key: sectionKey || "questions",
        name: toTitleCase(sectionKey || examType),
        count: fileQuestions[fileName],
        files: [fileName],
      };

      if (examType === "objective") {
        inferred.objective.parts.push(sectionData);
      } else if (examType === "theory") {
        inferred.theory.types.push(sectionData);
      } else if (examType === "oral") {
        inferred.oral.sections.push(sectionData);
      } else if (examType === "practical") {
        inferred.practical.sections.push(sectionData);
      }
    }
  }

  return inferred.examTypes.length ? inferred : null;
};

const subjectCategoryMap = {
  maths: "Science Subjects",
  mathematics: "Science Subjects",
  english: "Arts Subjects",
  literature: "Arts Subjects",
  arts: "Arts Subjects",
  history: "Arts Subjects",
  geography: "Arts Subjects",
  government: "Arts Subjects",
  "islamic religious studies": "Arts Subjects",
  "islamic religious studies (irs)": "Arts Subjects",
  "christian religious studies": "Arts Subjects",
  "christian religious studies (crs)": "Arts Subjects",
  arabic: "Arts Subjects",
  french: "Arts Subjects",
  "principles of accounts": "Commerce Subjects",
  economics: "Commerce Subjects",
  commerce: "Commerce Subjects",
  "financial accounting": "Commerce Subjects",
  "business management": "Commerce Subjects",
  ict: "ict",
  "integrated science": "Science Subjects",
  physics: "Science Subjects",
  chemistry: "Science Subjects",
  biology: "Science Subjects",
  "agricultural science": "Science Subjects",
  "further mathematics": "Science Subjects",
};

const getSubjectCategory = (subject) => {
  if (!subject || typeof subject !== "string") return null;
  const normalized = subject.trim().toLowerCase();
  return subjectCategoryMap[normalized] || null;
};

const pathExists = async (targetPath) => {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
};

const normalizeDirName = (text) => {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
};

const normalizeExamType = (examType) => {
  if (!examType || typeof examType !== "string") return "objective";
  const normalized = examType.trim().toLowerCase();
  if (normalized === "pratical") return "practical";
  if (normalized === "practical") return "practical";
  if (normalized === "oral") return "oral";
  if (normalized === "theory") return "theory";
  if (normalized === "objective") return "objective";
  return normalized;
};

const normalizeFileName = (file) => {
  if (!file || typeof file !== "string") return "";
  const trimmed = file.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
};

const normalizeFileList = (files) => {
  if (!files) return ["questions.json"];
  if (typeof files === "string") return [normalizeFileName(files)];
  if (Array.isArray(files) && files.length) return files.map(normalizeFileName).filter(Boolean);
  return ["questions.json"];
};

const normalizePath = (filePath) => {
  if (!filePath || typeof filePath !== "string") return "";
  return filePath.trim().replace(/\\/g, "/");
};

const findFileRecursively = async (startDir, targetFile) => {
  if (!startDir || !targetFile) return null;
  const normalizedTarget = normalizeFileName(targetFile);
  const targetSegments = normalizePath(targetFile).split("/").filter(Boolean);
  const targetBaseName = path.basename(targetFile);
  const targetDirName = path.basename(targetBaseName, path.extname(targetBaseName));

  const entries = await fs.readdir(startDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = path.join(startDir, entry.name);
    if (entry.isFile()) {
      const relativePath = normalizePath(path.relative(startDir, entryPath));
      if (relativePath === normalizePath(targetFile)) {
        return entryPath;
      }
      if (targetSegments.length === 1 && normalizeFileName(entry.name) === normalizedTarget) {
        return entryPath;
      }
    }

    if (entry.isDirectory()) {
      const entryDirName = normalizeDirName(entry.name);
      if (targetSegments.length > 1 && entryDirName === normalizeDirName(targetSegments[0])) {
        const nestedCandidate = path.join(entryPath, ...targetSegments.slice(1));
        const nestedExists = await fs.access(nestedCandidate).then(() => true).catch(() => false);
        if (nestedExists) {
          return nestedCandidate;
        }
      }

      if (entryDirName === normalizeDirName(targetDirName)) {
        const questionsCandidate = path.join(entryPath, "questions.json");
        const questionsExists = await fs.access(questionsCandidate).then(() => true).catch(() => false);
        if (questionsExists) {
          return questionsCandidate;
        }
      }

      const nestedFound = await findFileRecursively(entryPath, targetFile);
      if (nestedFound) {
        return nestedFound;
      }
    }
  }
  return null;
};

const getSectionFileCandidates = (section) => {
  if (!section || typeof section !== "object") {
    return ["questions.json"];
  }

  const normalizeName = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    const cleaned = raw.replace(/[^a-z0-9]+/g, "");
    return cleaned ? `${cleaned}.json` : "";
  };

  const candidates = [];
  const addCandidate = (value) => {
    const fileName = normalizeName(value);
    if (fileName && !candidates.includes(fileName)) {
      candidates.push(fileName);
    }
  };

  addCandidate(section.name);

  if (typeof section.key === "string" && !/^[0-9]+$/.test(section.key.trim())) {
    addCandidate(section.key);
  }

  if (typeof section.name === "string") {
    const sectionNumberMatch = section.name.match(/section\s*([0-9]+)/i);
    if (sectionNumberMatch) {
      addCandidate(`section${sectionNumberMatch[1]}`);
    }
  }

  if (typeof section.key === "string" && /^[0-9]+$/.test(section.key.trim())) {
    addCandidate(`section${section.key.trim()}`);
  }

  if (typeof section.key === "string" && /^[A-Za-z]$/.test(section.key.trim())) {
    const letterIndex = section.key.trim().toUpperCase().charCodeAt(0) - 65;
    if (letterIndex >= 0) {
      addCandidate(`section${letterIndex + 1}`);
    }
  }

  if (!candidates.length) {
    return ["questions.json"];
  }

  return candidates;
};

const resolveSectionFiles = (section, defaultFileName) => {
  const explicitFiles = Array.isArray(section.files) && section.files.length ? normalizeFileList(section.files) : [];
  if (!explicitFiles.length) {
    const candidateFiles = getSectionFileCandidates(section);
    return candidateFiles.length ? candidateFiles : [normalizeFileName(defaultFileName || "questions.json")];
  }

  if (explicitFiles.length === 1 && explicitFiles[0] === "questions.json") {
    const candidateFiles = getSectionFileCandidates(section);
    return candidateFiles.length ? candidateFiles : explicitFiles;
  }

  if (explicitFiles.length > 1) {
    const specificFiles = explicitFiles.filter((file) => file !== "questions.json");
    if (specificFiles.length) {
      return specificFiles;
    }
  }

  return explicitFiles;
};

const hasQuestionFiles = async (dirPath, examType) => {
  const normalizedType = normalizeExamType(examType);
  const typeDir = path.join(dirPath, normalizedType);
  if (await pathExists(typeDir)) {
    const entries = await fs.readdir(typeDir).catch(() => []);
    if (entries.some((name) => name.toLowerCase().endsWith(".json"))) {
      return true;
    }
  }

  if (normalizedType === "practical") {
    const altDir = path.join(dirPath, "paratical");
    if (await pathExists(altDir)) {
      const entries = await fs.readdir(altDir).catch(() => []);
      if (entries.some((name) => name.toLowerCase().endsWith(".json"))) {
        return true;
      }
    }
  }

  return false;
};

const findMatchingSubjectDirs = async (subject) => {
  const normalizedSubject = normalizeDirName(subject);
  const aliasMap = {
    "christian religious studies": "Christian Religious Studies (CRS)",
    "christian religious studies (crs)": "Christian Religious Studies (CRS)",
    "islamic religious studies": "Islamic Religious Studies (IRS)",
    "islamic religious studies (irs)": "Islamic Religious Studies (IRS)",
    "english": "Literature in English",
    "literature": "Literature in English",
    "literature in english": "Literature in English",
  };

  const results = [];
  const rootEntries = await fs.readdir(questionsDir, { withFileTypes: true }).catch(() => []);

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    const candidateRoot = path.join(questionsDir, entry.name);
    const candidateRootName = normalizeDirName(entry.name);

    if (candidateRootName === normalizedSubject) {
      results.push(candidateRoot);
    }

    const subjectEntries = await fs.readdir(candidateRoot, { withFileTypes: true }).catch(() => []);
    for (const subjectEntry of subjectEntries) {
      if (!subjectEntry.isDirectory()) continue;
      const candidateSubjectName = normalizeDirName(subjectEntry.name);
      if (candidateSubjectName === normalizedSubject) {
        results.push(path.join(candidateRoot, subjectEntry.name));
      } else if (aliasMap[normalizedSubject] && normalizeDirName(subjectEntry.name) === normalizeDirName(aliasMap[normalizedSubject])) {
        results.push(path.join(candidateRoot, subjectEntry.name));
      }
    }
  }

  return [...new Set(results)];
};

const findQuestionDirectory = async (subject, examType, requestedFiles = []) => {
  const normalizedSubject = subject.trim();
  const normalizedType = normalizeExamType(examType);
  const candidates = [];
  const normalizedRequestedFiles = Array.isArray(requestedFiles)
    ? requestedFiles.map(normalizeFileName).filter(Boolean)
    : [];

  const directCandidate = path.join(questionsDir, normalizedSubject);
  candidates.push(directCandidate);

  const matchedDirs = await findMatchingSubjectDirs(normalizedSubject);
  candidates.push(...matchedDirs);

  const category = getSubjectCategory(subject);
  if (category) {
    candidates.push(path.join(questionsDir, category, normalizedSubject));
  }

  debugLog("Searching question directory", { normalizedSubject, normalizedType, requestedFiles: normalizedRequestedFiles, candidates });

  const fallbackCandidates = [];
  for (const subjectDir of candidates) {
    const typeDir = path.join(subjectDir, normalizedType);
    const typeDirExists = await pathExists(typeDir);
    const dirFiles = typeDirExists ? await fs.readdir(typeDir).catch(() => []) : [];
    const jsonFiles = dirFiles.filter((name) => name.toLowerCase().endsWith(".json"));
    const hasFiles = jsonFiles.length > 0;
    debugLog("Candidate path", { typeDir, typeDirExists, hasFiles, jsonFiles });

    if (typeDirExists && hasFiles) {
      const exactMatch = normalizedRequestedFiles.some((requested) =>
        jsonFiles.some((entry) => normalizeFileName(entry) === requested)
      );
      if (exactMatch) {
        debugLog("Resolved question directory by matching requested files", typeDir);
        return typeDir;
      }
      fallbackCandidates.push(typeDir);
    }

    if (normalizedType === "practical") {
      const altDir = path.join(subjectDir, "paratical");
      const altExists = await pathExists(altDir);
      const altDirFiles = altExists ? await fs.readdir(altDir).catch(() => []) : [];
      const altJsonFiles = altDirFiles.filter((name) => name.toLowerCase().endsWith(".json"));
      const altHasFiles = altJsonFiles.length > 0;
      debugLog("Candidate practical alias path", { altDir, altExists, altHasFiles, altJsonFiles });
      if (altExists && altHasFiles) {
        const exactAltMatch = normalizedRequestedFiles.some((requested) =>
          altJsonFiles.some((entry) => normalizeFileName(entry) === requested)
        );
        if (exactAltMatch) {
          debugLog("Resolved practical alias directory by matching requested files", altDir);
          return altDir;
        }
        fallbackCandidates.push(altDir);
      }
    }
  }

  if (fallbackCandidates.length) {
    debugLog("Resolved question directory by available files fallback", fallbackCandidates[0]);
    return fallbackCandidates[0];
  }

  const fallbackPath = path.join(questionsDir, normalizedSubject, normalizedType);
  debugLog("Falling back to directory", fallbackPath);
  return fallbackPath;
};

const listAvailableSubjects = async () => {
  const config = await readJson(configPath);
  return Object.entries(config).map(([key, value]) => ({ subject: key, ...value }));
};

const isQuestionObject = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;

  const hasQuestionText =
    typeof data.question === "string" ||
    typeof data.text === "string" ||
    typeof data.prompt === "string" ||
    typeof data.topic === "string";

  const hasAnswerData =
    typeof data.correctAnswer !== "undefined" ||
    typeof data.answer !== "undefined" ||
    typeof data.sampleAnswer !== "undefined" ||
    typeof data.sample_answer !== "undefined" ||
    typeof data.sample_answer_summary !== "undefined" ||
    typeof data.solution !== "undefined" ||
    Array.isArray(data.options);

  const hasEssayMeta =
    typeof data.essay_type === "string" ||
    typeof data.type === "string" ||
    typeof data.questionType === "string" ||
    typeof data.marking_scheme === "object" ||
    typeof data.ai_marking_guide === "object";

  return (
    hasQuestionText && (hasAnswerData || hasEssayMeta || typeof data.question === "string")
  );
};

const enrichQuestionFromGroup = (question, group, defaultType = "theory") => {
  if (!question || typeof question !== "object") return question;
  const passage = group.summary?.passage || group.passage || question.passage || question.summary?.passage;
  const instruction = question.instruction || (defaultType === "summary" ? group.summary?.instruction : group.instruction) || group.section_instruction || "";
  const sectionTitle = question.section_title || question.section || question.sectionName ||
    (defaultType === "summary"
      ? group.summary?.section_title || group.summary?.section || group.summary?.sectionName || "Summary"
      : group.section_title || group.section || group.sectionName) ||
    group.section_title || group.section || group.sectionName || "";
  const questionType = question.questionType || question.type || group.summary?.questionType || group.summary?.type || group.questionType || group.type || defaultType;
  const type = question.type || question.questionType || group.summary?.type || group.summary?.questionType || group.type || group.questionType || defaultType;

  return {
    ...question,
    passage,
    instruction,
    section_title: sectionTitle,
    sectionName: sectionTitle,
    type,
    questionType,
  };
};

const flattenQuestionCollection = (data) => {
  if (Array.isArray(data)) {
    return data.flatMap((value) => flattenQuestionCollection(value));
  }

  if (data && typeof data === "object") {
    const hasQuestions = Array.isArray(data.questions);
    const hasSummaryQuestions = data.summary && Array.isArray(data.summary.questions);
    if (hasQuestions || hasSummaryQuestions) {
      const questions = [];
      if (hasQuestions) {
        questions.push(
          ...data.questions.map((question) => enrichQuestionFromGroup(question, data, "comprehension"))
        );
      }
      if (hasSummaryQuestions) {
        questions.push(
          ...data.summary.questions.map((question) => enrichQuestionFromGroup(question, data, "summary"))
        );
      }
      if (questions.length) {
        return questions;
      }
    }

    if (isQuestionObject(data)) {
      return [data];
    }

    return Object.values(data).flatMap((value) => flattenQuestionCollection(value));
  }

  return [];
};

const readJsonFilesFromDirectory = async (dirPath) => {
  let questions = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch((e) => {
    verboseLog(`Unable to read directory ${dirPath}:`, e && e.message);
    return [];
  });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      questions = questions.concat(await readJsonFilesFromDirectory(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      try {
        const data = await readJson(entryPath);
        questions = questions.concat(flattenQuestionCollection(data));
      } catch (error) {
        verboseLog(`Skipping invalid JSON file ${entryPath}:`, error && error.message, error && error.stack);
      }
    }
  }
  return questions;
};

const loadQuestionsFromJsonBank = async (bankPath = "") => {
  const normalizedBankPath = String(bankPath || "").trim();
  if (!normalizedBankPath) {
    debugLog("No bankPath provided for direct JSON bank load");
    return [];
  }

  const fullPath = path.join(questionsDir, normalizedBankPath);
  if (!fullPath.startsWith(questionsDir)) {
    debugLog("Invalid bankPath prevented directory traversal:", bankPath);
    return [];
  }

  try {
    const stats = await fs.stat(fullPath).catch(() => null);
    if (!stats) {
      debugLog(`JSON bank path not found: ${normalizedBankPath}`);
      return [];
    }

    if (stats.isDirectory()) {
      return await readJsonFilesFromDirectory(fullPath);
    }

    const raw = await fs.readFile(fullPath, "utf8");
    const data = JSON.parse(sanitizeJsonContent(raw));
    return flattenQuestionCollection(data);
  } catch (error) {
    console.warn(`Unable to load JSON bank ${normalizedBankPath}: ${error.message}`);
    return [];
  }
};

const loadQuestionsFromFiles = async (subject, examType, files = []) => {
  const basePath = await findQuestionDirectory(subject, examType, files);
  debugLog("Loading questions from files", { subject, examType, files, basePath });
  verboseLog(`loadQuestionsFromFiles: subject=${subject}, examType=${examType}, files=${JSON.stringify(files)}, resolvedBasePath=${basePath}`);
  const questions = [];

  for (const fileName of files) {
    let filePath = path.join(basePath, fileName);
    let fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      const exactFile = await findFileRecursively(basePath, fileName);
      if (exactFile) {
        debugLog("Found question file recursively for", fileName, "->", exactFile);
        verboseLog(`Resolved recursive file for ${fileName} -> ${exactFile}`);
        filePath = exactFile;
        fileExists = true;
      } else {
        const directoryCandidate = await findFileRecursively(basePath, `${path.basename(fileName, path.extname(fileName))}/questions.json`);
        if (directoryCandidate) {
          debugLog("Found question set by folder matching", fileName, "->", directoryCandidate);
          verboseLog(`Resolved directory candidate for ${fileName} -> ${directoryCandidate}`);
          filePath = directoryCandidate;
          fileExists = true;
        } else {
          const fallbackPath = path.join(basePath, "questions.json");
          const fallbackExists = await fs
            .access(fallbackPath)
            .then(() => true)
            .catch(() => false);
          if (fallbackExists) {
            debugLog("Falling back to questions.json for file", fileName, "->", fallbackPath);
            verboseLog(`Falling back to questions.json for ${fileName} -> ${fallbackPath}`);
            filePath = fallbackPath;
            fileExists = true;
          }
        }
      }
    }

    if (!fileExists) {
      debugLog("Skipping missing question file", fileName, "in", basePath);
      continue;
    }

    let fileQuestions;
    try {
      fileQuestions = await readJson(filePath);
    } catch (err) {
      verboseLog(`Skipping invalid question file ${filePath}:`, err && err.message, err && err.stack);
      continue;
    }

    const normalizedQuestions = flattenQuestionCollection(fileQuestions, fileName);
    if (normalizedQuestions.length) {
      questions.push(...normalizedQuestions);
    }
  }

  debugLog("Finished loading questions", { total: questions.length, subject, examType, files });
  return questions;
};

const checkQuestionFilesExist = async (subject, examType, files = []) => {
  const fileList = Array.isArray(files) && files.length ? files : ["questions.json"];
  const basePath = await findQuestionDirectory(subject, examType, fileList);
  const results = [];

  for (const fileName of fileList) {
    let filePath = path.join(basePath, fileName);
    let exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    let fallbackPath = null;
    let fallbackExists = false;
    if (!exists) {
      const recursiveFound = await findFileRecursively(basePath, fileName);
      if (recursiveFound) {
        filePath = recursiveFound;
        exists = true;
      } else {
        const directoryCandidate = await findFileRecursively(basePath, `${path.basename(fileName, path.extname(fileName))}/questions.json`);
        if (directoryCandidate) {
          filePath = directoryCandidate;
          exists = true;
        }
      }
    }

    if (!exists && fileName !== "questions.json") {
      fallbackPath = path.join(basePath, "questions.json");
      fallbackExists = await fs
        .access(fallbackPath)
        .then(() => true)
        .catch(() => false);
      exists = fallbackExists;
    }

    results.push({
      fileName,
      filePath,
      exists,
      fallbackPath: fallbackPath || null,
      fallbackExists,
    });
  }

  return {
    basePath,
    files: results,
    anyExists: results.some((item) => item.exists),
  };
};

const pickRandom = (items, count) => {
  if (!Array.isArray(items)) return [];
  const shuffled = shuffleArray(items);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const buildObjectiveSections = async (subject, objectiveConfig) => {
  if (!objectiveConfig?.parts?.length) return [];

  const sections = [];
  for (const part of objectiveConfig.parts) {
    const files = resolveSectionFiles(part, `section${part.key}.json`);
    const allQuestions = await loadQuestionsFromFiles(subject, "objective", files);
    const selected = pickRandom(allQuestions, part.count || allQuestions.length);
    const questions = selected.map((question, index) => {
      const rawOptions = question.options || {};
      const optionList = Array.isArray(rawOptions)
        ? rawOptions
        : rawOptions && typeof rawOptions === "object"
        ? Object.values(rawOptions)
        : [];

      const answerKey = question.correctAnswer || question.answer;
      let resolvedCorrectAnswer = answerKey;
      if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
        if (typeof answerKey === "string" && rawOptions[answerKey] !== undefined) {
          resolvedCorrectAnswer = rawOptions[answerKey];
        }
      }

      return {
        questionId: question.id || `${subject}-objective-${part.key}-${index}`,
        text: question.text || question.question || "",
        options: shuffleArray(optionList),
        correctAnswer: resolvedCorrectAnswer,
        explanation: question.explanation || "",
        part: part.key,
        difficulty: question.difficulty || objectiveConfig.difficulty || "medium",
        questionType: "objective",
        type: "objective",
      };
    });

    sections.push({
      part: part.key,
      count: questions.length,
      questions,
    });
  }

  return sections;
};

const buildTheorySections = async (subject, theoryConfig) => {
  if (!theoryConfig?.types?.length) return [];

  const sections = [];
  for (const section of theoryConfig.types) {
    const files = resolveSectionFiles(section, `${section.key}.json`);
    const allQuestions = await loadQuestionsFromFiles(subject, "theory", files);
    const selected = pickRandom(allQuestions, section.count || allQuestions.length);
    const questions = selected.map((question, index) => ({
      questionId: question.id || `${subject}-theory-${section.key}-${index}`,
      text: question.text || question.question || "",
      prompt: question.prompt || question.text || question.question || "",
      type: "theory",
      questionType: "theory",
      subType: section.key,
      difficulty: question.difficulty || theoryConfig.difficulty || "medium",
      guidance: question.guidance || "",
    }));

    sections.push({
      section: section.key,
      title: section.name || section.key,
      count: questions.length,
      questions,
    });
  }

  return sections;
};

const buildOralSections = async (subject, oralConfig) => {
  if (!oralConfig?.sections?.length) return [];

  const sections = [];
  for (const section of oralConfig.sections) {
    const files = resolveSectionFiles(section, `${section.key}.json`);
    const allQuestions = await loadQuestionsFromFiles(subject, "oral", files);
    const selected = pickRandom(allQuestions, section.count || allQuestions.length);
    const questions = selected.map((question, index) => ({
      questionId: question.id || `${subject}-oral-${section.key}-${index}`,
      text: question.text || question.prompt || "",
      prompt: question.prompt || question.text || "",
      sampleAnswer: question.sampleAnswer || question.answer || "",
      type: "oral",
      questionType: "oral",
      subType: section.key,
      difficulty: question.difficulty || oralConfig.difficulty || "medium",
      guidance: question.guidance || "",
    }));

    sections.push({
      section: section.key,
      title: section.name || section.key,
      count: questions.length,
      questions,
    });
  }

  return sections;
};

const buildPracticalSections = async (subject, practicalConfig) => {
  if (!practicalConfig?.sections?.length) return [];

  const sections = [];
  for (const section of practicalConfig.sections) {
    const files = resolveSectionFiles(section, `${section.key}.json`);
    const allQuestions = await loadQuestionsFromFiles(subject, "practical", files);
    const selected = pickRandom(allQuestions, section.count || allQuestions.length);
    const questions = selected.map((question, index) => ({
      questionId: question.id || `${subject}-practical-${section.key}-${index}`,
      text: question.text || question.prompt || "",
      prompt: question.prompt || question.text || "",
      sampleAnswer: question.sampleAnswer || question.answer || "",
      type: "practical",
      questionType: "practical",
      subType: section.key,
      difficulty: question.difficulty || practicalConfig.difficulty || "medium",
      guidance: question.guidance || "",
    }));

    sections.push({
      section: section.key,
      title: section.name || section.key,
      count: questions.length,
      questions,
    });
  }

  return sections;
};

const generateExam = async (subject) => {
  let subjectConfig = await getSubjectConfig(subject);
  if (!subjectConfig) {
    subjectConfig = await inferSubjectConfig(subject);
  }
  if (!subjectConfig) {
    throw new Error(`No configuration found for subject: ${subject}`);
  }

  const objectiveSections = await buildObjectiveSections(subject, subjectConfig.objective || {});
  const theorySections = await buildTheorySections(subject, subjectConfig.theory || {});
  const oralSections = await buildOralSections(subject, subjectConfig.oral || {});
  const practicalSections = await buildPracticalSections(subject, subjectConfig.practical || {});

  if (subjectConfig.timeLimit === undefined || subjectConfig.timeLimit === null) {
    throw new Error(`Subject configuration for "${subject}" is missing a required timeLimit value.`);
  }

  const exam = {
    subject,
    displayName: subjectConfig.displayName || subject,
    examTypes: subjectConfig.examTypes || [],
    objective: objectiveSections,
    theory: theorySections,
    oral: oralSections,
    practical: practicalSections,
    timeLimit: subjectConfig.timeLimit,
  };

  return exam;
};

module.exports = {
  listAvailableSubjects,
  getSubjectConfig,
  inferSubjectConfig,
  generateExam,
  normalizeSubjectKey,
  findQuestionDirectory,
  loadQuestionsFromFiles,
  loadQuestionsFromJsonBank,
  checkQuestionFilesExist,
  normalizeFileList,
  getSectionFileCandidates,
  resolveSectionFiles,
};

