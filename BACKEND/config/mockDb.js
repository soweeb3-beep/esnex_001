/**
 * Mock Database - File-based storage for development
 * Stores data in JSON files when MongoDB is unavailable
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "../data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const COURSES_FILE = path.join(DATA_DIR, "courses.json");
const ENROLLMENTS_FILE = path.join(DATA_DIR, "enrollments.json");
const ASSESSMENT_ENROLLMENTS_FILE = path.join(DATA_DIR, "assessment-enrollments.json");
const QUIZZES_FILE = path.join(DATA_DIR, "quizzes.json");
const ATTEMPTS_FILE = path.join(DATA_DIR, "attempts.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const HOMEPAGE_FILE = path.join(DATA_DIR, "homepage.json");
const ASSESSMENTS_FILE = path.join(DATA_DIR, "assessments.json");
const STANDARD_ASSESSMENTS_FILE = path.join(DATA_DIR, "standard-assessments.json");
const CERTIFICATES_FILE = path.join(DATA_DIR, "certificates.json");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

// Initialize files if they don't exist
const initializeFiles = () => {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(COURSES_FILE)) {
    fs.writeFileSync(COURSES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ENROLLMENTS_FILE)) {
    fs.writeFileSync(ENROLLMENTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(QUIZZES_FILE)) {
    fs.writeFileSync(QUIZZES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ATTEMPTS_FILE)) {
    fs.writeFileSync(ATTEMPTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(QUESTIONS_FILE)) {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(HOMEPAGE_FILE)) {
    fs.writeFileSync(HOMEPAGE_FILE, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(ASSESSMENTS_FILE)) {
    fs.writeFileSync(ASSESSMENTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ASSESSMENT_ENROLLMENTS_FILE)) {
    fs.writeFileSync(ASSESSMENT_ENROLLMENTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(CERTIFICATES_FILE)) {
    fs.writeFileSync(CERTIFICATES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ROLES_FILE)) {
    fs.writeFileSync(ROLES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
  }
};

initializeFiles();

const readJSON = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const createMockQuery = (result) => {
  const query = {
    _result: result,
    sort(sortObj) {
      if (Array.isArray(this._result) && sortObj && typeof sortObj === "object") {
        const entries = Object.entries(sortObj);
        this._result = [...this._result].sort((a, b) => {
          for (const [key, order] of entries) {
            const aVal = a?.[key];
            const bVal = b?.[key];
            if (aVal === bVal) continue;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (aVal > bVal) return order === -1 ? -1 : 1;
            if (aVal < bVal) return order === -1 ? 1 : -1;
          }
          return 0;
        });
      }
      return this;
    },
    limit(count) {
      if (Array.isArray(this._result)) {
        this._result = this._result.slice(0, count);
      }
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return this;
    },
    select() {
      return this;
    },
    exec() {
      return Promise.resolve(this._result);
    },
    then(resolve, reject) {
      return Promise.resolve(this._result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(this._result).catch(reject);
    },
  };
  return query;
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const wrapDoc = (doc, filePath) => {
  if (!doc) return null;
  return {
    ...doc,
    async save() {
      const items = readJSON(filePath);
      const index = items.findIndex((item) => item._id === doc._id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...this, updatedAt: new Date().toISOString() };
      writeJSON(filePath, items);
      return wrapDoc(items[index], filePath);
    },
  };
};

// User operations
const UserMock = {
  async findOne(query) {
    const users = readJSON(USERS_FILE);
    const user = users.find((u) => {
      if (query.email) return u.email === query.email;
      if (query._id) return u._id === query._id;
      if (query.role) return u.role === query.role;
      return false;
    });
    return wrapDoc(user || null, USERS_FILE);
  },

  async find(query = {}) {
    let users = readJSON(USERS_FILE);

    if (query.role) {
      if (typeof query.role === "object" && query.role.$ne !== undefined) {
        users = users.filter((u) => u.role !== query.role.$ne);
      } else {
        users = users.filter((u) => u.role === query.role);
      }
    }

    if (query.email) {
      users = users.filter((u) => u.email === query.email);
    }

    return users;
  },

  async findById(id) {
    const users = readJSON(USERS_FILE);
    return wrapDoc(users.find((u) => u._id === id) || null, USERS_FILE);
  },

  async create(data) {
    const users = readJSON(USERS_FILE);
    const newUser = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    return wrapDoc(newUser, USERS_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const users = readJSON(USERS_FILE);
    const index = users.findIndex((u) => u._id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(USERS_FILE, users);
    return wrapDoc(users[index], USERS_FILE);
  },
};

// Course operations
const CourseMock = {
  find() {
    return createMockQuery(readJSON(COURSES_FILE));
  },

  async aggregate(pipeline = []) {
    let courses = readJSON(COURSES_FILE);
    for (const stage of pipeline) {
      if (stage.$unwind && typeof stage.$unwind === "string") {
        const pathKey = stage.$unwind.replace(/^\$+/, "");
        courses = courses.flatMap((course) => {
          const items = Array.isArray(course[pathKey]) ? course[pathKey] : [];
          return items.map((value) => ({ ...course, [pathKey]: value }));
        });
      }
      if (stage.$match) {
        const filters = stage.$match;
        courses = courses.filter((course) => {
          return Object.entries(filters).every(([key, value]) => {
            if (typeof value === "object" && value.$in) {
              return value.$in.includes(course[key]);
            }
            return course[key] === value;
          });
        });
      }
      if (stage.$group) {
        const grouped = {};
        const { _id, enrolledCourses } = stage.$group;
        const keyName = _id && _id.replace(/^\$+/, "") || "_id";
        courses.forEach((course) => {
          const groupKey = course[keyName];
          if (!grouped[groupKey]) grouped[groupKey] = 0;
          if (enrolledCourses && enrolledCourses.$sum === 1) {
            grouped[groupKey] += 1;
          }
        });
        courses = Object.entries(grouped).map(([key, value]) => ({ _id: key, enrolledCourses: value }));
      }
    }
    return courses;
  },

  findById(id) {
    const courses = readJSON(COURSES_FILE);
    return createMockQuery(wrapDoc(courses.find((c) => c._id === id) || null, COURSES_FILE));
  },

  async create(data) {
    const courses = readJSON(COURSES_FILE);
    const newCourse = {
      _id: generateId(),
      ...data,
      students: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    courses.push(newCourse);
    writeJSON(COURSES_FILE, courses);
    return wrapDoc(newCourse, COURSES_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const courses = readJSON(COURSES_FILE);
    const index = courses.findIndex((c) => c._id === id);
    if (index === -1) return null;
    courses[index] = { ...courses[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(COURSES_FILE, courses);
    return wrapDoc(courses[index], COURSES_FILE);
  },

  async findByIdAndDelete(id) {
    const courses = readJSON(COURSES_FILE);
    const index = courses.findIndex((c) => c._id === id);
    if (index === -1) return null;
    const deleted = courses[index];
    courses.splice(index, 1);
    writeJSON(COURSES_FILE, courses);
    return deleted;
  },
};

// Enrollment operations
const EnrollmentMock = {
  find(query = {}) {
    let enrollments = readJSON(ENROLLMENTS_FILE);
    if (query && typeof query === "object" && !Array.isArray(query)) {
      enrollments = enrollments.filter((e) => matchQuery(e, query));
    }
    return createMockQuery(enrollments);
  },
  async create(data) {
    const enrollments = readJSON(ENROLLMENTS_FILE);
    const newEnrollment = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    enrollments.push(newEnrollment);
    writeJSON(ENROLLMENTS_FILE, enrollments);
    return wrapDoc(newEnrollment, ENROLLMENTS_FILE);
  },

  findOne(query = {}) {
    const result = this.find(query);
    const rows = Array.isArray(result._result) ? result._result : result;
    const enrollment = Array.isArray(rows) ? rows[0] : rows || null;
    return createMockQuery(wrapDoc(enrollment, ENROLLMENTS_FILE));
  },

  async findByIdAndUpdate(id, update) {
    const enrollments = readJSON(ENROLLMENTS_FILE);
    const index = enrollments.findIndex((e) => e._id === id);
    if (index === -1) return null;
    enrollments[index] = { ...enrollments[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(ENROLLMENTS_FILE, enrollments);
    return wrapDoc(enrollments[index], ENROLLMENTS_FILE);
  },
};

// Message operations
const MessageMock = {
  find(query = {}) {
    let messages = readJSON(MESSAGES_FILE);
    if (query.recipient) {
      messages = messages.filter((m) => m.recipient === query.recipient);
    }
    if (query.isRead !== undefined) {
      messages = messages.filter((m) => m.isRead === query.isRead);
    }
    if (query.category) {
      messages = messages.filter((m) => m.category === query.category);
    }
    if (query.type) {
      messages = messages.filter((m) => m.type === query.type);
    }
    return createMockQuery(messages);
  },

  async countDocuments(query = {}) {
    const messages = await this.find(query);
    return Array.isArray(messages._result) ? messages._result.length : 0;
  },

  findOne(query = {}) {
    const messages = this.find(query);
    const result = Array.isArray(messages._result) ? messages._result[0] : messages._result;
    return createMockQuery(wrapDoc(result || null, MESSAGES_FILE));
  },

  findById(id) {
    const messages = readJSON(MESSAGES_FILE);
    return createMockQuery(wrapDoc(messages.find((m) => m._id === id) || null, MESSAGES_FILE));
  },

  async create(data) {
    const messages = readJSON(MESSAGES_FILE);
    const newMessage = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    messages.push(newMessage);
    writeJSON(MESSAGES_FILE, messages);
    return wrapDoc(newMessage, MESSAGES_FILE);
  },

  async aggregate(pipeline = []) {
    let messages = readJSON(MESSAGES_FILE);
    for (const stage of pipeline) {
      if (stage.$match) {
        const filters = stage.$match;
        messages = messages.filter((message) => {
          return Object.entries(filters).every(([key, value]) => {
            if (typeof value === "object" && value.$in) {
              return value.$in.includes(message[key]);
            }
            return message[key] === value;
          });
        });
      }
      if (stage.$group) {
        const grouped = {};
        const group = stage.$group;
        const idKey = group._id && group._id.replace(/^\$+/, "") || "_id";

        for (const message of messages) {
          const key = message[idKey];
          if (!grouped[key]) grouped[key] = { _id: key };

          for (const [field, expr] of Object.entries(group)) {
            if (field === "_id") continue;
            if (expr.$sum === 1) {
              grouped[key][field] = (grouped[key][field] || 0) + 1;
            }
          }
        }
        messages = Object.values(grouped);
      }
    }
    return messages;
  },
};

// Quiz operations
const QuizMock = {
  find() {
    return createMockQuery(readJSON(QUIZZES_FILE));
  },
  async create(data) {
    const quizzes = readJSON(QUIZZES_FILE);
    const newQuiz = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    quizzes.push(newQuiz);
    writeJSON(QUIZZES_FILE, quizzes);
    return wrapDoc(newQuiz, QUIZZES_FILE);
  },

  async findById(id) {
    const quizzes = readJSON(QUIZZES_FILE);
    return wrapDoc(quizzes.find((q) => q._id === id) || null, QUIZZES_FILE);
  },
};

// Question operations
const QuestionMock = {
  find(query = {}) {
    let questions = readJSON(QUESTIONS_FILE);

    if (query.assessmentId) {
      questions = questions.filter((q) => String(q.assessmentId) === String(query.assessmentId));
    }
    if (query.partName) {
      questions = questions.filter((q) => q.partName === query.partName);
    }
    if (query.sectionName) {
      questions = questions.filter((q) => q.sectionName === query.sectionName);
    }

    return createMockQuery(questions);
  },

  findOne(query = {}) {
    const questions = this.find(query);
    return createMockQuery(wrapDoc((Array.isArray(questions._result) ? questions._result : questions)[0] || null, QUESTIONS_FILE));
  },

  findById(id) {
    const questions = readJSON(QUESTIONS_FILE);
    return createMockQuery(wrapDoc(questions.find((q) => q._id === id) || null, QUESTIONS_FILE));
  },

  async create(data) {
    const questions = readJSON(QUESTIONS_FILE);
    const newQuestion = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    questions.push(newQuestion);
    writeJSON(QUESTIONS_FILE, questions);
    return wrapDoc(newQuestion, QUESTIONS_FILE);
  },

  async insertMany(docs) {
    const questions = readJSON(QUESTIONS_FILE);
    const newQuestions = docs.map((doc) => ({
      _id: generateId(),
      ...doc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    questions.push(...newQuestions);
    writeJSON(QUESTIONS_FILE, questions);
    return newQuestions.map((question) => wrapDoc(question, QUESTIONS_FILE));
  },
  async findByIdAndUpdate(id, update) {
    const questions = readJSON(QUESTIONS_FILE);
    const index = questions.findIndex((q) => q._id === id);
    if (index === -1) return null;
    questions[index] = { ...questions[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(QUESTIONS_FILE, questions);
    return wrapDoc(questions[index], QUESTIONS_FILE);
  },

  async findByIdAndDelete(id) {
    const questions = readJSON(QUESTIONS_FILE);
    const index = questions.findIndex((q) => q._id === id);
    if (index === -1) return null;
    const deleted = questions.splice(index, 1)[0];
    writeJSON(QUESTIONS_FILE, questions);
    return wrapDoc(deleted, QUESTIONS_FILE);
  },
};

// Homepage operations
const HomepageMock = {
  async findOne(query = {}) {
    const homepage = readJSON(HOMEPAGE_FILE);
    if (!homepage || Object.keys(homepage).length === 0) return null;
    return wrapDoc(homepage, HOMEPAGE_FILE);
  },

  async create(data) {
    const homepageData = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeJSON(HOMEPAGE_FILE, homepageData);
    return wrapDoc(homepageData, HOMEPAGE_FILE);
  },

  async findOneAndUpdate(query = {}, update = {}, options = {}) {
    let homepage = readJSON(HOMEPAGE_FILE);
    if (!homepage || Object.keys(homepage).length === 0) {
      if (options.upsert) {
        homepage = {
          _id: generateId(),
          ...update,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        return null;
      }
    } else {
      homepage = { ...homepage, ...update, updatedAt: new Date().toISOString() };
    }
    writeJSON(HOMEPAGE_FILE, homepage);
    return wrapDoc(homepage, HOMEPAGE_FILE);
  },
};

// Attempt operations
const AttemptMock = {
  find(query = {}) {
    let attempts = readJSON(ATTEMPTS_FILE);

    if (query.student) {
      attempts = attempts.filter((a) => a.student === query.student);
    }
    if (query.status) {
      attempts = attempts.filter((a) => a.status === query.status);
    }
    if (query.quiz) {
      attempts = attempts.filter((a) => a.quiz === query.quiz);
    }

    return createMockQuery(attempts);
  },

  findOne(query = {}) {
    const result = this.find(query);
    return createMockQuery(wrapDoc(Array.isArray(result._result) ? result._result[0] : result || null, ATTEMPTS_FILE));
  },

  findById(id) {
    const attempts = readJSON(ATTEMPTS_FILE);
    return createMockQuery(wrapDoc(attempts.find((a) => a._id === id) || null, ATTEMPTS_FILE));
  },

  async create(data) {
    const attempts = readJSON(ATTEMPTS_FILE);
    const newAttempt = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    attempts.push(newAttempt);
    writeJSON(ATTEMPTS_FILE, attempts);
    return wrapDoc(newAttempt, ATTEMPTS_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const attempts = readJSON(ATTEMPTS_FILE);
    const index = attempts.findIndex((a) => a._id === id);
    if (index === -1) return null;
    attempts[index] = {
      ...attempts[index],
      ...update,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(ATTEMPTS_FILE, attempts);
    return wrapDoc(attempts[index], ATTEMPTS_FILE);
  },

  async countDocuments(query = {}) {
    const attempts = await this.find(query);
    return attempts.length;
  },

  async aggregate(pipeline = []) {
    let attempts = readJSON(ATTEMPTS_FILE);

    for (const stage of pipeline) {
      if (stage.$match) {
        const filters = stage.$match;
        attempts = attempts.filter((attempt) => {
          return Object.entries(filters).every(([key, value]) => {
            if (typeof value === "object" && value.$in) {
              return value.$in.includes(attempt[key]);
            }
            return attempt[key] === value;
          });
        });
      }

      if (stage.$group) {
        const result = [{}];
        const group = stage.$group;

        if (group.avgScore) {
          const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
          result[0].avgScore = attempts.length ? totalScore / attempts.length : 0;
        }

        if (group.passRate) {
          const passCount = attempts.reduce(
            (sum, attempt) => sum + (attempt.score >= 50 ? 1 : 0),
            0
          );
          result[0].passRate = attempts.length ? passCount / attempts.length : 0;
        }

        return result;
      }
    }

    return attempts;
  },
};

// Assessment operations
const matchQuery = (item, query) => {
  if (!query || typeof query !== "object" || Array.isArray(query)) return true;

  for (const [key, value] of Object.entries(query)) {
    if (key === "$or" && Array.isArray(value)) {
      if (!value.some((clause) => matchQuery(item, clause))) {
        return false;
      }
      continue;
    }

    const targetValue = item[key];
    if (value && typeof value === "object" && value.$regex instanceof RegExp) {
      if (!value.$regex.test(String(targetValue || ""))) {
        return false;
      }
      continue;
    }

    if (value && typeof value === "object" && value.$ne !== undefined) {
      if (targetValue === value.$ne) {
        return false;
      }
      continue;
    }

    if (targetValue !== value) {
      return false;
    }
  }

  return true;
};

const readAssessmentDocuments = () => {
  const primaryAssessments = readJSON(ASSESSMENTS_FILE);
  const standardAssessments = readJSON(STANDARD_ASSESSMENTS_FILE);
  const merged = [...primaryAssessments];

  standardAssessments.forEach((assessment) => {
    const exists = merged.some((item) => String(item._id) === String(assessment._id));
    if (!exists) {
      merged.push(assessment);
    }
  });

  return merged;
};

const AssessmentMock = {
  find(query = {}) {
    let assessments = readAssessmentDocuments();

    assessments = assessments.filter((a) => matchQuery(a, query));

    return createMockQuery(assessments);
  },

  findOne(query = {}) {
    const assessments = readAssessmentDocuments().filter((a) => matchQuery(a, query));
    return createMockQuery(wrapDoc(assessments[0] || null, ASSESSMENTS_FILE));
  },

  findById(id) {
    const assessments = readAssessmentDocuments();
    return createMockQuery(wrapDoc(assessments.find((a) => String(a._id) === String(id)) || null, ASSESSMENTS_FILE));
  },

  async create(data) {
    const assessments = readJSON(ASSESSMENTS_FILE);
    const newAssessment = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assessments.push(newAssessment);
    writeJSON(ASSESSMENTS_FILE, assessments);
    return wrapDoc(newAssessment, ASSESSMENTS_FILE);
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const assessments = readJSON(ASSESSMENTS_FILE);
    const index = assessments.findIndex((a) => a._id === id);
    if (index === -1) {
      if (options.new) return null;
      return null;
    }
    assessments[index] = {
      ...assessments[index],
      ...update,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(ASSESSMENTS_FILE, assessments);
    return wrapDoc(assessments[index], ASSESSMENTS_FILE);
  },

  async findByIdAndDelete(id) {
    const assessments = readJSON(ASSESSMENTS_FILE);
    const index = assessments.findIndex((a) => a._id === id);
    if (index === -1) return null;
    const deleted = assessments[index];
    assessments.splice(index, 1);
    writeJSON(ASSESSMENTS_FILE, assessments);
    return deleted;
  },
};

// Assessment Attempt operations
const AssessmentAttemptMock = {
  find(query = {}) {
    let attempts = readJSON(ATTEMPTS_FILE);

    if (query.assessmentId) {
      attempts = attempts.filter((a) => a.assessmentId === query.assessmentId);
    }
    if (query.studentId) {
      attempts = attempts.filter((a) => a.studentId === query.studentId);
    }
    if (query.status) {
      attempts = attempts.filter((a) => a.status === query.status);
    }

    return createMockQuery(attempts);
  },

  findOne(query = {}) {
    const result = this.find(query);
    return createMockQuery(wrapDoc(Array.isArray(result._result) ? result._result[0] : result || null, ATTEMPTS_FILE));
  },

  findById(id) {
    const attempts = readJSON(ATTEMPTS_FILE);
    return createMockQuery(wrapDoc(attempts.find((a) => a._id === id) || null, ATTEMPTS_FILE));
  },

  async create(data) {
    const attempts = readJSON(ATTEMPTS_FILE);
    const newAttempt = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    attempts.push(newAttempt);
    writeJSON(ATTEMPTS_FILE, attempts);
    return wrapDoc(newAttempt, ATTEMPTS_FILE);
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const attempts = readJSON(ATTEMPTS_FILE);
    const index = attempts.findIndex((a) => a._id === id);
    if (index === -1) return null;
    attempts[index] = {
      ...attempts[index],
      ...update,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(ATTEMPTS_FILE, attempts);
    return wrapDoc(attempts[index], ATTEMPTS_FILE);
  },

  async findByIdAndDelete(id) {
    const attempts = readJSON(ATTEMPTS_FILE);
    const index = attempts.findIndex((a) => a._id === id);
    if (index === -1) return null;
    const deleted = attempts.splice(index, 1)[0];
    writeJSON(ATTEMPTS_FILE, attempts);
    return wrapDoc(deleted, ATTEMPTS_FILE);
  },

  async deleteMany(query = {}) {
    let attempts = readJSON(ATTEMPTS_FILE);
    const initialLength = attempts.length;

    if (query.assessmentId) {
      attempts = attempts.filter((a) => a.assessmentId !== query.assessmentId);
    }
    if (query.studentId) {
      attempts = attempts.filter((a) => a.studentId !== query.studentId);
    }

    writeJSON(ATTEMPTS_FILE, attempts);
    return { deletedCount: initialLength - attempts.length };
  },
};

// Assessment Enrollment operations
const AssessmentEnrollmentMock = {
  find(query = {}) {
    let enrollments = readJSON(ASSESSMENT_ENROLLMENTS_FILE);

    if (query && typeof query === "object" && !Array.isArray(query)) {
      enrollments = enrollments.filter((e) => matchQuery(e, query));
    }

    return createMockQuery(enrollments);
  },

  findOne(query = {}) {
    const result = this.find(query);
    const rows = Array.isArray(result._result) ? result._result : result;
    const first = Array.isArray(rows) ? rows[0] : rows;
    return createMockQuery(wrapDoc(first || null, ASSESSMENT_ENROLLMENTS_FILE));
  },

  async create(data) {
    const enrollments = readJSON(ASSESSMENT_ENROLLMENTS_FILE);
    const newEnrollment = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    enrollments.push(newEnrollment);
    writeJSON(ASSESSMENT_ENROLLMENTS_FILE, enrollments);
    return wrapDoc(newEnrollment, ASSESSMENT_ENROLLMENTS_FILE);
  },

  async findByIdAndUpdate(id, update, options = {}) {
    const enrollments = readJSON(ASSESSMENT_ENROLLMENTS_FILE);
    const index = enrollments.findIndex((e) => e._id === id);
    if (index === -1) return null;
    enrollments[index] = {
      ...enrollments[index],
      ...update,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(ASSESSMENT_ENROLLMENTS_FILE, enrollments);
    return wrapDoc(enrollments[index], ASSESSMENT_ENROLLMENTS_FILE);
  },

  async deleteMany(query = {}) {
    let enrollments = readJSON(ASSESSMENT_ENROLLMENTS_FILE);
    const initialLength = enrollments.length;

    if (query.assessmentId) {
      enrollments = enrollments.filter((e) => e.assessmentId !== query.assessmentId);
    }
    if (query.studentId) {
      enrollments = enrollments.filter((e) => e.studentId !== query.studentId);
    }

    writeJSON(ASSESSMENT_ENROLLMENTS_FILE, enrollments);
    return { deletedCount: initialLength - enrollments.length };
  },

  async findOneAndUpdate(query = {}, update = {}, options = {}) {
    const enrollments = await this.find(query);
    const enrollment = enrollments[0];
    if (!enrollment) return null;
    return this.findByIdAndUpdate(enrollment._id, update, options);
  },
};

const wrapRoleDoc = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    async save() {
      const roles = readJSON(ROLES_FILE);
      const index = roles.findIndex((role) => role._id === doc._id);
      if (index === -1) return null;
      roles[index] = { ...roles[index], ...doc, updatedAt: new Date().toISOString() };
      writeJSON(ROLES_FILE, roles);
      return roles[index];
    },
  };
};

const RoleMock = {
  async findOne(query = {}) {
    const roles = readJSON(ROLES_FILE);
    const found = roles.find((role) => {
      if (query.$or && Array.isArray(query.$or)) {
        return query.$or.some((clause) => {
          if (clause.name) return role.name === clause.name;
          if (clause.key) return role.key === clause.key;
          return false;
        });
      }
      if (query.key) return role.key === query.key;
      if (query.name) return role.name === query.name;
      if (query._id) return role._id === query._id;
      return false;
    }) || null;
    return wrapRoleDoc(found);
  },

  async find(query = {}) {
    const roles = readJSON(ROLES_FILE);
    return roles.filter((role) => {
      if (query.$or && Array.isArray(query.$or)) {
        return query.$or.some((clause) => {
          if (clause.name) return role.name === clause.name;
          if (clause.key) return role.key === clause.key;
          return false;
        });
      }
      if (query.key) return role.key === query.key;
      if (query.name) return role.name === query.name;
      return true;
    });
  },

  async findById(id) {
    const roles = readJSON(ROLES_FILE);
    const found = roles.find((role) => role._id === id) || null;
    return wrapRoleDoc(found);
  },

  async create(data) {
    const roles = readJSON(ROLES_FILE);
    const newRole = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    roles.push(newRole);
    writeJSON(ROLES_FILE, roles);
    return wrapRoleDoc(newRole);
  },

  async findByIdAndUpdate(id, update) {
    const roles = readJSON(ROLES_FILE);
    const index = roles.findIndex((role) => role._id === id);
    if (index === -1) return null;
    roles[index] = { ...roles[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(ROLES_FILE, roles);
    return wrapRoleDoc(roles[index]);
  },

  async findByIdAndDelete(id) {
    const roles = readJSON(ROLES_FILE);
    const index = roles.findIndex((role) => role._id === id);
    if (index === -1) return null;
    const deleted = roles.splice(index, 1)[0];
    writeJSON(ROLES_FILE, roles);
    return wrapRoleDoc(deleted);
  },
};

// Payment operations
const PAYMENTS_FILE = path.join(__dirname, "../data", "payments.json");

const PaymentMock = {
  find(query = {}) {
    let payments = readJSON(PAYMENTS_FILE);

    if (query && typeof query === "object" && !Array.isArray(query)) {
      payments = payments.filter((p) => matchQuery(p, query));
    }

    return createMockQuery(payments);
  },

  findOne(query = {}) {
    const result = this.find(query);
    const candidate = Array.isArray(result._result) ? result._result[0] : result._result || result || null;
    const wrapped = candidate ? wrapDoc(candidate, PAYMENTS_FILE) : null;
    return createMockQuery(wrapped);
  },

  findById(id) {
    const payments = readJSON(PAYMENTS_FILE);
    return createMockQuery(wrapDoc(payments.find((p) => p._id === id) || null, PAYMENTS_FILE));
  },

  async create(data) {
    const payments = readJSON(PAYMENTS_FILE);
    const newPayment = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    payments.push(newPayment);
    writeJSON(PAYMENTS_FILE, payments);
    return wrapDoc(newPayment, PAYMENTS_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const payments = readJSON(PAYMENTS_FILE);
    const index = payments.findIndex((p) => p._id === id);
    if (index === -1) return null;
    payments[index] = { ...payments[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(PAYMENTS_FILE, payments);
    return wrapDoc(payments[index], PAYMENTS_FILE);
  },
};

const CertificateMock = {
  async countDocuments(query = {}) {
    const certificates = readJSON(CERTIFICATES_FILE);
    return certificates.filter((certificate) => matchQuery(certificate, query)).length;
  },

  find(query = {}) {
    let certificates = readJSON(CERTIFICATES_FILE);
    certificates = certificates.filter((certificate) => matchQuery(certificate, query));
    return createMockQuery(certificates);
  },

  findOne(query = {}) {
    const certificates = this.find(query);
    const result = Array.isArray(certificates._result) ? certificates._result[0] : certificates;
    return createMockQuery(wrapDoc(result || null, CERTIFICATES_FILE));
  },

  findById(id) {
    const certificates = readJSON(CERTIFICATES_FILE);
    return createMockQuery(wrapDoc(certificates.find((certificate) => certificate._id === id) || null, CERTIFICATES_FILE));
  },

  async create(data) {
    const certificates = readJSON(CERTIFICATES_FILE);
    const newCertificate = {
      _id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    certificates.push(newCertificate);
    writeJSON(CERTIFICATES_FILE, certificates);
    return wrapDoc(newCertificate, CERTIFICATES_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const certificates = readJSON(CERTIFICATES_FILE);
    const index = certificates.findIndex((certificate) => certificate._id === id);
    if (index === -1) return null;
    certificates[index] = { ...certificates[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(CERTIFICATES_FILE, certificates);
    return wrapDoc(certificates[index], CERTIFICATES_FILE);
  },
};

const StandardAssessmentMock = {
  async findById(id) {
    const assessments = readJSON(STANDARD_ASSESSMENTS_FILE);
    console.log("[StandardAssessmentMock.findById] Looking for id:", id);
    console.log("[StandardAssessmentMock.findById] File:", STANDARD_ASSESSMENTS_FILE);
    console.log("[StandardAssessmentMock.findById] Found assessments:", assessments.length);
    if (assessments.length > 0) {
      console.log("[StandardAssessmentMock.findById] First assessment ID:", assessments[0]._id);
    }
    const found = assessments.find((a) => a._id === id);
    console.log("[StandardAssessmentMock.findById] Result:", found ? "Found" : "Not found");
    return found ? wrapDoc(found, STANDARD_ASSESSMENTS_FILE) : null;
  },

  async findOne(query = {}) {
    const assessments = readJSON(STANDARD_ASSESSMENTS_FILE);
    let found = assessments[0]; // Default to first assessment
    
    if (query._id) {
      found = assessments.find((a) => a._id === query._id);
    } else if (query.subject) {
      found = assessments.find((a) => a.subject === query.subject);
    }
    
    return found ? wrapDoc(found, STANDARD_ASSESSMENTS_FILE) : null;
  },

  async find(query = {}) {
    const assessments = readJSON(STANDARD_ASSESSMENTS_FILE);
    return assessments.map((a) => wrapDoc(a, STANDARD_ASSESSMENTS_FILE));
  },

  async create(data) {
    const assessments = readJSON(STANDARD_ASSESSMENTS_FILE);
    const newAssessment = {
      _id: data._id || Math.random().toString(36).substr(2, 9),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assessments.push(newAssessment);
    writeJSON(STANDARD_ASSESSMENTS_FILE, assessments);
    return wrapDoc(newAssessment, STANDARD_ASSESSMENTS_FILE);
  },

  async findByIdAndUpdate(id, update) {
    const assessments = readJSON(STANDARD_ASSESSMENTS_FILE);
    const index = assessments.findIndex((a) => a._id === id);
    if (index === -1) return null;
    assessments[index] = { ...assessments[index], ...update, updatedAt: new Date().toISOString() };
    writeJSON(STANDARD_ASSESSMENTS_FILE, assessments);
    return wrapDoc(assessments[index], STANDARD_ASSESSMENTS_FILE);
  },
};

module.exports = {
  UserMock,
  CourseMock,
  EnrollmentMock,
  QuizMock,
  QuestionMock,
  AttemptMock,
  HomepageMock,
  AssessmentMock,
  StandardAssessmentMock,
  AssessmentAttemptMock,
  AssessmentEnrollmentMock,
  CertificateMock,
  PaymentMock,
  RoleMock,
  MessageMock,
  isConnected: false,
};
