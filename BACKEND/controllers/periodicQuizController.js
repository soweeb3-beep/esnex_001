const PeriodicQuiz = require("../models/PeriodicQuiz");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const Enrollment = require("../models/Enrollment");

// ===== ADMIN ENDPOINTS =====

/**
 * Create a periodic quiz
 */
exports.createPeriodicQuiz = async (req, res) => {
  try {
    const { title, quizType, courseId, questions, schedule, totalMarks, ...rest } =
      req.body;

    if (!title || !quizType || !courseId || !questions || !schedule) {
      return res.status(400).json({
        error:
          "title, quizType, courseId, questions, and schedule are required",
      });
    }

    const quiz = new PeriodicQuiz({
      title,
      quizType,
      courseId,
      questions,
      schedule,
      totalMarks,
      createdBy: req.user._id,
      ...rest,
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: "Periodic quiz created successfully",
      quiz,
    });
  } catch (error) {
    console.error("Error creating periodic quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all periodic quizzes (admin)
 */
exports.getAllPeriodicQuizzes = async (req, res) => {
  try {
    const { courseId, quizType, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (courseId) filter.courseId = courseId;
    if (quizType) filter.quizType = quizType;

    const skip = (page - 1) * limit;

    const quizzes = await PeriodicQuiz.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("courseId", "name code")
      .populate("createdBy", "name email")
      .sort({ "schedule.startDate": -1 });

    const total = await PeriodicQuiz.countDocuments(filter);

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
    console.error("Error fetching periodic quizzes:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get quiz by ID (admin)
 */
exports.getPeriodicQuizById = async (req, res) => {
  try {
    const quiz = await PeriodicQuiz.findById(req.params.id)
      .populate("courseId", "name code")
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
 * Update periodic quiz
 */
exports.updatePeriodicQuiz = async (req, res) => {
  try {
    const quiz = await PeriodicQuiz.findByIdAndUpdate(
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
 * Delete periodic quiz
 */
exports.deletePeriodicQuiz = async (req, res) => {
  try {
    const quiz = await PeriodicQuiz.findByIdAndDelete(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Delete related attempts
    await AssessmentAttempt.deleteMany({
      assessmentId: req.params.id,
      assessmentType: "periodic",
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

/**
 * Get periodic quizzes for a course (admin)
 */
exports.getCoursePeriodicQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const quizzes = await PeriodicQuiz.find({ courseId })
      .skip(skip)
      .limit(limit)
      .sort({ "schedule.startDate": -1 });

    const total = await PeriodicQuiz.countDocuments({ courseId });

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
    console.error("Error fetching course quizzes:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===== STUDENT ENDPOINTS =====

/**
 * Get periodic quizzes for a course (student)
 */
exports.getStudentCourseQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if student is enrolled
    const enrollment = await Enrollment.findOne({
      courseId,
      studentId: req.user._id,
    });

    if (!enrollment) {
      return res.status(403).json({
        error: "You are not enrolled in this course",
      });
    }

    const now = new Date();

    const quizzes = await PeriodicQuiz.find({
      courseId,
      isActive: true,
      onlyEnrolledStudents: true,
    })
      .select(
        "title description quizType schedule totalMarks passingMarks duration settings"
      )
      .sort({ "schedule.startDate": -1 });

    // Add status and attempt info
    const quizzesWithStatus = await Promise.all(
      quizzes.map(async (quiz) => {
        const { startDate, endDate } = quiz.schedule;

        let status = "upcoming";
        if (now >= startDate && now <= endDate) status = "active";
        else if (now > endDate) status = "closed";

        // Get student attempts
        const attempts = await AssessmentAttempt.find({
          assessmentId: quiz._id,
          studentId: req.user._id,
          assessmentType: "periodic",
        }).select("obtainedMarks totalMarks percentage passed submittedAt");

        return {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          quizType: quiz.quizType,
          totalMarks: quiz.totalMarks,
          passingMarks: quiz.passingMarks,
          duration: quiz.duration,
          status,
          startDate,
          endDate,
          attempts: attempts,
          canAttempt:
            status === "active" &&
            (quiz.settings.allowMultipleAttempts ||
              attempts.length < quiz.settings.maxAttempts),
        };
      })
    );

    res.json({
      success: true,
      quizzes: quizzesWithStatus,
    });
  } catch (error) {
    console.error("Error fetching student quizzes:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get quiz details (student)
 */
exports.getPeriodicQuizDetails = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;

    // Check enrollment
    const enrollment = await Enrollment.findOne({
      courseId,
      studentId: req.user._id,
    });

    if (!enrollment) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    const quiz = await PeriodicQuiz.findById(quizId);

    if (!quiz || quiz.courseId.toString() !== courseId) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const now = new Date();
    const { startDate, endDate } = quiz.schedule;

    let status = "upcoming";
    if (now >= startDate && now <= endDate) status = "active";
    else if (now > endDate) status = "closed";

    // Get attempts
    const attempts = await AssessmentAttempt.find({
      assessmentId: quizId,
      studentId: req.user._id,
      assessmentType: "periodic",
    }).select("obtainedMarks totalMarks percentage passed submittedAt attemptNumber");

    const quizDetails = {
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      quizType: quiz.quizType,
      totalMarks: quiz.totalMarks,
      passingMarks: quiz.passingMarks,
      duration: quiz.duration,
      status,
      startDate,
      endDate,
      settings: quiz.settings,
      questionCount: quiz.questions.length,
      attempts,
      canAttempt:
        status === "active" &&
        (quiz.settings.allowMultipleAttempts ||
          attempts.length < quiz.settings.maxAttempts),
    };

    res.json({
      success: true,
      quiz: quizDetails,
    });
  } catch (error) {
    console.error("Error fetching quiz details:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Start periodic quiz attempt
 */
exports.startPeriodicQuizAttempt = async (req, res) => {
  try {
    const { courseId, quizId } = req.body;

    // Check enrollment
    const enrollment = await Enrollment.findOne({
      courseId,
      studentId: req.user._id,
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You are not enrolled in this course" });
    }

    const quiz = await PeriodicQuiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const now = new Date();
    const { startDate, endDate } = quiz.schedule;

    // Check if quiz is open
    if (now < startDate || now > endDate) {
      return res.status(403).json({
        error: "Quiz is not available at this time",
      });
    }

    // Check attempts
    const previousAttempts = await AssessmentAttempt.countDocuments({
      assessmentId: quizId,
      studentId: req.user._id,
      assessmentType: "periodic",
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
    const questions = [...quiz.questions];

    const { shuffleArray } = require("../utils/random");
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
      assessmentType: "periodic",
      assessmentId: quizId,
      assessmentTypeRef: "PeriodicQuiz",
      studentId: req.user._id,
      courseId,
      totalMarks: quiz.totalMarks,
      duration: quiz.duration,
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

    // Return questions without answers
    const questionsForStudent = attempt.questions.map((q) => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });

    res.json({
      success: true,
      message: "Quiz attempt started",
      attempt: {
        id: attempt._id,
        sessionToken: attempt.sessionToken,
        duration: quiz.duration,
        totalMarks: quiz.totalMarks,
        questions: questionsForStudent,
      },
    });
  } catch (error) {
    console.error("Error starting quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Submit answer to periodic quiz
 */
exports.submitPeriodicQuizAnswer = async (req, res) => {
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
 * Submit periodic quiz
 */
exports.submitPeriodicQuiz = async (req, res) => {
  try {
    const { attemptId } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const quiz = await PeriodicQuiz.findById(attempt.assessmentId);

    // Mark as submitted
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    // Calculate marks
    attempt.obtainedMarks = attempt.answers.reduce(
      (sum, a) => sum + a.marks,
      0
    );
    attempt.percentage = (attempt.obtainedMarks / attempt.totalMarks) * 100;
    attempt.passed = attempt.obtainedMarks >= quiz.passingMarks;

    // Auto-mark
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
 * Get periodic quiz results
 */
exports.getPeriodicQuizResults = async (req, res) => {
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

    const quiz = await PeriodicQuiz.findById(attempt.assessmentId);

    const answers = attempt.answers.map((a) => ({
      questionText: a.questionText,
      studentAnswer: a.studentAnswer,
      correctAnswer: a.correctAnswer,
      marks: a.marks,
      isCorrect: a.isCorrect,
    }));

    res.json({
      success: true,
      results: {
        quizTitle: quiz.title,
        quizType: quiz.quizType,
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
 * Get student's periodic quiz attempts
 */
exports.getStudentPeriodicQuizAttempts = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;

    const attempts = await AssessmentAttempt.find({
      assessmentId: quizId,
      studentId: req.user._id,
      assessmentType: "periodic",
      courseId,
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
