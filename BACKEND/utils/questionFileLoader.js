const fs = require("fs");
const path = require("path");
const { shuffleArray } = require("./random");

const QUESTIONS_DIR = path.join(__dirname, "..", "questions");

/**
 * Load questions from JSON file
 * @param {string} filePath - Relative path to questions file (e.g., "english/objective/sectionA.json")
 * @returns {Promise<Array>} Array of questions
 */
async function loadQuestionsFromFile(filePath) {
  try {
    const fullPath = path.join(QUESTIONS_DIR, filePath);

    // Security check: prevent directory traversal
    if (!fullPath.startsWith(QUESTIONS_DIR)) {
      throw new Error("Invalid file path");
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.warn(`Question file not found: ${fullPath}`);
      return [];
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const questions = JSON.parse(fileContent);

    if (!Array.isArray(questions)) {
      console.warn(`Invalid questions format in ${filePath}`);
      return [];
    }

    return questions;
  } catch (error) {
    console.error(
      `Error loading questions from ${filePath}:`,
      error.message
    );
    return [];
  }
}

/**
 * Get random questions from a file
 * @param {string} filePath - Path to questions file
 * @param {number} count - Number of questions to select
 * @returns {Promise<Array>} Random selection of questions
 */
async function getRandomQuestions(filePath, count) {
  const allQuestions = await loadQuestionsFromFile(filePath);

  if (allQuestions.length === 0) {
    return [];
  }

  // If count is greater than available, return all
  if (count >= allQuestions.length) {
    return allQuestions;
  }

  // Shuffle and select using Fisher–Yates
  const shuffled = shuffleArray(allQuestions);
  return shuffled.slice(0, count);
}

/**
 * Load questions for an assessment part section
 * @param {Object} section - Section configuration
 * @returns {Promise<Array>} Questions for the section
 */
async function loadSectionQuestions(section) {
  try {
    let questions = [];

    const loadQuestionsFromDirectory = async (directory) => {
      if (!fs.existsSync(directory)) {
        return [];
      }
      const entries = fs.readdirSync(directory);
      let results = [];
      for (const entry of entries) {
        const fullPath = path.join(directory, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(await loadQuestionsFromDirectory(fullPath));
        } else if (entry.endsWith(".json")) {
          const relativePath = path.relative(QUESTIONS_DIR, fullPath).replace(/\\/g, "/");
          results = results.concat(await loadQuestionsFromFile(relativePath));
        }
      }
      return results;
    };

    if (section.files && Array.isArray(section.files) && section.bankPath) {
      for (const fileName of section.files) {
        const filePath = path.join(section.bankPath, fileName);
        const loaded = await loadQuestionsFromFile(filePath);
        questions = questions.concat(loaded);
      }
    }

    if (questions.length === 0 && section.bankPath) {
      const directoryPath = path.join(QUESTIONS_DIR, section.bankPath);
      questions = await loadQuestionsFromDirectory(directoryPath);
    }

    if (questions.length === 0 && section.fileReference) {
      questions = await getRandomQuestions(section.fileReference, section.questionCount);
    }

    if (questions.length === 0) {
      return [];
    }

    // Normalize answer property so controllers can use correctAnswer uniformly
    questions = questions.map((q) => ({
      ...q,
      correctAnswer: q.correctAnswer ?? q.answer,
    }));

    // If count is smaller than available, shuffle and select
    if (section.questionCount && questions.length > section.questionCount) {
      questions = shuffleArray(questions).slice(0, section.questionCount);
    }

    const enriched = questions.map((q) => {
      const correctAnswer = q.correctAnswer ?? q.answer;
      const marks = q.marks ?? q.totalMarks ?? Math.max(1, Math.floor((section.totalMarks || 1) / (section.questionCount || 1)));
      return {
        ...q,
        correctAnswer,
        marks,
      };
    });

    return enriched;
  } catch (error) {
    console.error(
      `Error loading section questions for ${section.name}:`,
      error.message
    );
    return [];
  }
}

/**
 * Load all questions for an assessment part
 * @param {Object} part - Part configuration
 * @returns {Promise<Object>} Questions organized by section
 */
async function loadPartQuestions(part) {
  const partQuestions = {};

  for (const section of part.sections) {
    partQuestions[section.name] = await loadSectionQuestions(section);
  }

  return partQuestions;
}

/**
 * Check if question file exists
 * @param {string} filePath - Relative path to questions file
 * @returns {boolean}
 */
function questionFileExists(filePath) {
  try {
    const fullPath = path.join(QUESTIONS_DIR, filePath);

    // Security check
    if (!fullPath.startsWith(QUESTIONS_DIR)) {
      return false;
    }

    return fs.existsSync(fullPath);
  } catch (error) {
    return false;
  }
}

/**
 * Create sample question file
 * @param {string} filePath - Relative path for the file
 * @param {Array} questions - Question data
 * @returns {Promise<boolean>}
 */
async function createQuestionFile(filePath, questions) {
  try {
    const fullPath = path.join(QUESTIONS_DIR, filePath);

    // Security check
    if (!fullPath.startsWith(QUESTIONS_DIR)) {
      throw new Error("Invalid file path");
    }

    // Create directory if not exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, JSON.stringify(questions, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(
      `Error creating question file ${filePath}:`,
      error.message
    );
    return false;
  }
}

/**
 * Get questions directory structure
 * @returns {Promise<Object>} Directory structure
 */
async function getQuestionsDirectoryStructure() {
  try {
    if (!fs.existsSync(QUESTIONS_DIR)) {
      return {};
    }

    const structure = {};
    const readDir = (dir, relativePath = "") => {
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          structure[relativePath ? `${relativePath}/${file}` : file] = {};
          readDir(fullPath, relativePath ? `${relativePath}/${file}` : file);
        } else if (file.endsWith(".json")) {
          const key = relativePath ? `${relativePath}/${file}` : file;
          const questions = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
          structure[key] = { count: questions.length };
        }
      });
    };

    readDir(QUESTIONS_DIR);
    return structure;
  } catch (error) {
    console.error("Error reading questions directory:", error.message);
    return {};
  }
}

module.exports = {
  loadQuestionsFromFile,
  getRandomQuestions,
  loadSectionQuestions,
  loadPartQuestions,
  questionFileExists,
  createQuestionFile,
  getQuestionsDirectoryStructure,
  QUESTIONS_DIR,
};
