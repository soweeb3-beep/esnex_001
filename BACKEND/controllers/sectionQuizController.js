const SectionQuiz = require("../models/SectionQuiz");
const AssessmentAttempt = require("../models/AssessmentAttempt");

// ===== ADMIN ENDPOINTS =====

/**
 * Create a section quiz
 */
exports.createSectionQuiz = async (req, res) => {
  try {
    const { title, courseId, sectionId, questions, ...rest } = req.body;

    if (!title || !courseId || !sectionId || !questions || questions.length === 0) {
      return res.status(400).json({
        error: "title, courseId, sectionId, and questions are required",
      });
    }

    const quiz = new SectionQuiz({
      title,
      courseId,
      sectionId,
      questions,
      createdBy: req.user._id,
      ...rest,
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: "Section quiz created successfully",
      quiz,
    });
  } catch (error) {
    console.error("Error creating section quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all section quizzes (admin)
 */
exports.getAllSectionQuizzes = async (req, res) => {
  try {
    const { courseId, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (courseId) filter.courseId = courseId;

    const skip = (page - 1) * limit;

    const quizzes = await SectionQuiz.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("courseId", "name code")
      .populate("sectionId", "title")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const total = await SectionQuiz.countDocuments(filter);

    res.json({
      success: true,
      quizzes,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching section quizzes:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get quiz by ID (admin)
 */
exports.getSectionQuizById = async (req, res) => {
  try {
    const quiz = await SectionQuiz.findById(req.params.id)
      .populate("courseId", "name code")
      .populate("sectionId", "title")
      .populate("createdBy", "name email");

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json({
      success: true,
      quiz,
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update section quiz
 */
exports.updateSectionQuiz = async (req, res) => {
  try {
    const quiz = await SectionQuiz.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json({
      success: true,
      message: "Quiz updated successfully",
      quiz,
    });
  } catch (error) {
    console.error("Error updating quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete section quiz
 */
exports.deleteSectionQuiz = async (req, res) => {
  try {
    const quiz = await SectionQuiz.findByIdAndDelete(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Delete related attempts
    await AssessmentAttempt.deleteMany({
      assessmentId: req.params.id,
      assessmentType: "section",
    });

    res.json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===== STUDENT ENDPOINTS =====

/**
 * Get quiz for a specific course section
 */
exports.getSectionQuizForStudent = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    const quiz = await SectionQuiz.findOne({
      courseId,
      sectionId,
      isActive: true,
    });

    if (!quiz) {
      return res.status(404).json({ error: "No quiz found for this section" });
    }

    // Get student's past attempts
    const studentAttempts = await AssessmentAttempt.find({
      assessmentId: quiz._id,
      studentId: req.user._id,
      assessmentType: "section",
    }).select("obtainedMarks totalMarks percentage passed submittedAt");

    // Return quiz without correct answers
    const quizData = {
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      totalMarks: quiz.totalMarks,
      passingMarks: quiz.passingMarks,
      duration: quiz.duration,
      settings: quiz.settings,
      questions: quiz.questions.map((q) => ({
        id: q._id,
        text: q.text,
        type: q.type,
        options: q.options,
        marks: q.marks,
        difficulty: q.difficulty,
      })),
      attemptHistory: studentAttempts,
      canAttempt:
        quiz.settings.allowMultipleAttempts ||
        studentAttempts.length < quiz.settings.maxAttempts,
    };

    res.json({
      success: true,
      quiz: quizData,
    });
  } catch (error) {
    console.error("Error fetching section quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Start section quiz attempt
 */
exports.startSectionQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.body;

    const quiz = await SectionQuiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Check if student can attempt
    const previousAttempts = await AssessmentAttempt.countDocuments({
      assessmentId: quizId,
      studentId: req.user._id,
      assessmentType: "section",
      status: { $ne: "in-progress" },
    });

    if (
      !quiz.settings.allowMultipleAttempts &&
      previousAttempts >= quiz.settings.maxAttempts
    ) {
      return res.status(403).json({
        error: `Maximum attempts (${quiz.settings.maxAttempts}) reached`,
      });
    }

    // Create attempt
    const { shuffleArray } = require("../utils/random");
    let questions = [...quiz.questions];

    // Shuffle if enabled
    if (quiz.settings.randomizeQuestions) {
      questions = shuffleArray(questions);
    }

    // Shuffle options if enabled
    if (quiz.settings.randomizeOptions) {
      questions.forEach((q) => {
        if (q.options && q.options.length > 0) {
          q.options = shuffleArray(q.options);
        }
      });
    }

    const attempt = new AssessmentAttempt({
      assessmentType: "section",
      assessmentId: quizId,
      assessmentTypeRef: "SectionQuiz",
      studentId: req.user._id,
      courseId: quiz.courseId,
      totalMarks: quiz.totalMarks,
      duration: quiz.duration || 0,
      status: "in-progress",
      sessionToken: generateSessionToken(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      attemptNumber: previousAttempts + 1,
      questions: questions.map((q) => {
        const { correctAnswer, ...rest } = q.toObject ? q.toObject() : q;
        return { ...rest, correctAnswer };
      }),
    });

    await attempt.save();

    // Return questions without correct answers
    const questionsForStudent = attempt.questions.map((q) => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });

    res.json({
      success: true,
      message: "Quiz attempt started",
      attempt: {
        id: attempt._id,
        quizId,
        sessionToken: attempt.sessionToken,
        totalMarks: quiz.totalMarks,
        duration: quiz.duration,
        questions: questionsForStudent,
      },
    });
  } catch (error) {
    console.error("Error starting quiz attempt:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Submit answer to section quiz
 */
exports.submitSectionQuizAnswer = async (req, res) => {
  try {
    const { attemptId, questionId, studentAnswer } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    // Find question
    const question = attempt.questions.find(
      (q) => q._id.toString() === questionId
    );
    if (!question) {
      return res.status(400).json({ error: "Question not found" });
    }

    // Check answer
    const isCorrect =
      Array.isArray(question.correctAnswer)
        ? question.correctAnswer.includes(studentAnswer)
        : String(question.correctAnswer) === String(studentAnswer);

    const marks = isCorrect ? question.marks : 0;

    // Add/update answer
    const existingAnswer = attempt.answers.find(
      (a) => a.questionId.toString() === questionId
    );

    if (existingAnswer) {
      existingAnswer.studentAnswer = studentAnswer;
      existingAnswer.isCorrect = isCorrect;
      existingAnswer.marks = marks;
      existingAnswer.answeredAt = new Date();
    } else {
      attempt.answers.push({
        questionId,
        questionText: question.text,
        questionType: question.type,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        totalMarks: question.marks,
        isCorrect,
        marks,
        answeredAt: new Date(),
      });
    }

    attempt.lastAutoSave = new Date();
    attempt.autoSaveCount++;
    await attempt.save();

    res.json({
      success: true,
      message: "Answer recorded",
      isCorrect,
      marksObtained: marks,
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Submit section quiz
 */
exports.submitSectionQuiz = async (req, res) => {
  try {
    const { attemptId } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const quiz = await SectionQuiz.findById(attempt.assessmentId);

    // Mark attempt as submitted
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    // Calculate marks
    attempt.obtainedMarks = attempt.answers.reduce(
      (sum, a) => sum + a.marks,
      0
    );
    attempt.percentage = (attempt.obtainedMarks / attempt.totalMarks) * 100;
    attempt.passed = attempt.obtainedMarks >= quiz.passingMarks;

    // Auto-mark (all objective)
    attempt.status = "marked";
    attempt.markedAt = new Date();

    await attempt.save();

    res.json({
      success: true,
      message: "Quiz submitted successfully",
      results: {
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage.toFixed(2),
        passingMarks: quiz.passingMarks,
        passed: attempt.passed,
      },
    });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get section quiz results
 */
exports.getSectionQuizResults = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    if (attempt.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const quiz = await SectionQuiz.findById(attempt.assessmentId);

    const answers = attempt.answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.questionText,
      studentAnswer: a.studentAnswer,
      correctAnswer: a.correctAnswer,
      marks: a.marks,
      totalMarks: a.totalMarks,
      isCorrect: a.isCorrect,
    }));

    res.json({
      success: true,
      results: {
        quizTitle: quiz.title,
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage.toFixed(2),
        passingMarks: quiz.passingMarks,
        passed: attempt.passed,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt,
        answers: quiz.settings.showAnswers ? answers : [],
      },
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student's quiz attempts
 */
exports.getStudentSectionQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;

    const attempts = await AssessmentAttempt.find({
      assessmentId: quizId,
      studentId: req.user._id,
      assessmentType: "section",
    })
      .sort({ createdAt: -1 })
      .select(
        "obtainedMarks totalMarks percentage passed submittedAt attemptNumber createdAt"
      );

    res.json({
      success: true,
      attempts,
    });
  } catch (error) {
    console.error("Error fetching attempts:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===== HELPER FUNCTIONS =====

function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

module.exports = exports;
