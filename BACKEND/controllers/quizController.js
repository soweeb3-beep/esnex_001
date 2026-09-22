const { getModel } = require("../config/adapter");

const getQuiz = () => getModel("Quiz");
const getAttempt = () => getModel("Attempt");
const getEnrollment = () => getModel("Enrollment");

/* =========================
   CREATE QUIZ (ADMIN)
========================= */
exports.createQuiz = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const allowedParts = Array.isArray(req.body.allowedParts)
      ? req.body.allowedParts
          .map((part) => (part || "").toString().toUpperCase())
          .filter((part) => ["A", "B", "C", "D", "E", "F"].includes(part))
      : ["A", "B"];

    const quizData = {
      ...req.body,
      allowedParts: allowedParts.length ? allowedParts : ["A", "B"],
      subject: req.body.subject || req.body.title || "",
      description: req.body.description || "",
    };

    const quiz = await Quiz.create(quizData);

    res.status(201).json({
      message: "Quiz created successfully",
      quiz,
    });
  } catch (err) {
    console.error("Create quiz error:", err);
    res.status(500).json({ message: "Server error creating quiz" });
  }
};

/* =========================
   UPDATE QUIZ (ADMIN)
========================= */
exports.updateQuiz = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const allowedParts = Array.isArray(req.body.allowedParts)
      ? req.body.allowedParts
          .map((part) => (part || "").toString().toUpperCase())
          .filter((part) => ["A", "B", "C", "D", "E", "F"].includes(part))
      : quiz.allowedParts || ["A", "B"];

    const updateData = {
      ...req.body,
      allowedParts: allowedParts.length ? allowedParts : ["A", "B"],
      subject: req.body.subject || req.body.title || quiz.subject || "",
      description: req.body.description || quiz.description || "",
    };

    const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.quizId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      message: "Quiz updated successfully",
      quiz: updatedQuiz,
    });
  } catch (err) {
    console.error("Update quiz error:", err);
    res.status(500).json({ message: "Server error updating quiz" });
  }
};

/* =========================
   GET ALL QUIZZES (FILTERED BY ENROLLMENT)
========================= */
exports.getAllQuizzes = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const Enrollment = getEnrollment();

    // Get user's enrolled courses
    const enrollments = await Enrollment.find({
      student: req.user.id,
      status: "active"
    }).select('course');

    const enrolledCourseIds = enrollments.map(enrollment => enrollment.course);

    // Get quizzes only for enrolled courses
    const quizzes = await Quiz.find({
      courseId: { $in: enrolledCourseIds },
      status: "published",
      visibility: true
    }).populate('courseId', 'title');

    res.status(200).json({
      message: "Quizzes retrieved successfully",
      quizzes: quizzes.map((quiz) => ({
        _id: quiz._id,
        title: quiz.title,
        courseTitle: quiz.courseId?.title || '',
        duration: quiz.duration,
        totalMarks: quiz.totalMarks,
        description: quiz.description || "",
        instructions: quiz.instructions || "",
        questionsCount: quiz.questions?.length || 0,
      })),
    });
  } catch (err) {
    console.error("Get quizzes error:", err);
    res.status(500).json({ message: "Server error retrieving quizzes" });
  }
};

/* =========================
   GET SINGLE QUIZ
========================= */
exports.getQuizById = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.status(200).json({
      message: "Quiz retrieved successfully",
      quiz,
    });
  } catch (err) {
    console.error("Get quiz error:", err);
    res.status(500).json({ message: "Server error fetching quiz" });
  }
};

/* =========================
   START QUIZ
========================= */
exports.startQuiz = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const Attempt = getAttempt();
    const Enrollment = getEnrollment();

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const courseId = quiz.course?._id || quiz.course;
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
    });

    const now = new Date();
    const hasFullAccess = enrollment?.accessType === "full";
    const hasAssessmentAccess = enrollment?.accessType === "assessment" && enrollment.validUntil && new Date(enrollment.validUntil) > now;

    if (!hasFullAccess && !hasAssessmentAccess) {
      return res.status(403).json({
        message: "You must enroll in the full course or have active D10 monthly assessment access to start this quiz",
      });
    }

    const selectedPart = (req.body.selectedPart || "A").toString().toUpperCase();
    const allowedParts = quiz.allowedParts?.map((part) => part.toString().toUpperCase()) || ["A", "B"];
    const validatedPart = allowedParts.includes(selectedPart) ? selectedPart : "A";

    const attempt = await Attempt.create({
      student: req.user.id,
      quiz: quiz._id,
      selectedPart: validatedPart,
      startedAt: new Date(),
      status: "in-progress",
    });

    res.json({
      message: "Quiz started",
      attemptId: attempt._id,
      quiz,
    });
  } catch (err) {
    console.error("Start quiz error:", err);
    res.status(500).json({ message: "Server error starting quiz" });
  }
};

/* =========================
   SUBMIT QUIZ
========================= */
exports.submitQuiz = async (req, res) => {
  try {
    const Attempt = getAttempt();
    const Quiz = getQuiz();
    const { answers = [] } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers must be an array" });
    }

    const attempt = await Attempt.findById(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: this attempt does not belong to you" });
    }

    if (attempt.status !== "in-progress") {
      return res.status(400).json({ message: "Attempt already submitted or timed out" });
    }

    const quiz = typeof attempt.quiz === "object" ? attempt.quiz : await Quiz.findById(attempt.quiz);

    if (!quiz || !quiz.questions?.length) {
      return res.status(400).json({ message: "Invalid quiz data" });
    }

    const selectedPart = attempt.selectedPart ? attempt.selectedPart.toString().toUpperCase() : null;
    const relevantQuestions = quiz.questions
      .map((q, i) => ({ q, index: i }))
      .filter((item) => {
        if (!selectedPart) return true;
        return (item.q.part || "A").toString().toUpperCase() === selectedPart;
      });

    let score = 0;
    const total = relevantQuestions.length;

    relevantQuestions.forEach(({ q, index }) => {
      const ans = answers[index];

      if (!q) return;

      if (q.type === "mcq") {
        if (ans && ans === q.correctAnswer) {
          score++;
        }
      } else if (q.type === "theory") {
        const userAns = (ans || "").toString().trim();

        if (q.useAI) {
          const format = (q.markingFormat || "").toLowerCase();
          const answerText = userAns.toLowerCase();
          const requiredWords = format
            .split(/[,.;:\s]+/)
            .filter((word) => word.length > 3);

          const matches = requiredWords.filter((word) => answerText.includes(word));
          const scoreThreshold = Math.max(1, Math.ceil(requiredWords.length * 0.35));

          if (userAns.length >= 20 && matches.length >= scoreThreshold) {
            score++;
          }
        } else {
          const correct = (q.sampleAnswer || "").toLowerCase();

          if (correct && userAns.includes(correct)) {
            score++;
          }
        }
      } else if (q.type === "math") {
        if (
          ans &&
          q.correctFormat &&
          ans.toString().trim() === q.correctFormat.toString().trim()
        ) {
          score++;
        }
      }
    });

    const percentage = total > 0 ? (score / total) * 100 : 0;
    const submissionUpdate = {
      answers,
      score,
      total,
      submittedAt: new Date(),
      status: "submitted",
    };

    if (selectedPart === "A") submissionUpdate.objectiveCompleted = true;
    if (selectedPart === "B") submissionUpdate.theoryCompleted = true;
    if (selectedPart === "C") submissionUpdate.oralCompleted = true;

    await Attempt.findByIdAndUpdate(req.params.attemptId, submissionUpdate);

    res.json({
      message: "Quiz submitted successfully",
      score,
      total,
      percentage: Number(percentage.toFixed(2)),
      status: percentage >= 50 ? "PASS" : "FAIL",
    });
  } catch (err) {
    console.error("Submit quiz error:", err);
    res.status(500).json({ message: "Server error submitting quiz" });
  }
};

/* =========================
   GET MY RESULTS (STUDENT)
========================= */
exports.getMyResults = async (req, res) => {
  try {
    const Attempt = getAttempt();
    const Quiz = getQuiz();

    let results = await Attempt.find({ student: req.user.id });
    if (!Array.isArray(results)) {
      results = [results];
    }

    results = await Promise.all(
      results.map(async (result) => {
        const item = result.toObject ? result.toObject() : result;
        if (item.quiz && typeof item.quiz === "string") {
          item.quiz = await Quiz.findById(item.quiz);
        }
        return item;
      })
    );

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(results);
  } catch (err) {
    console.error("Results error:", err);
    res.status(500).json({ message: "Server error fetching results" });
  }
};

/* =========================
   GET SINGLE ATTEMPT (WAEC REVIEW PAGE)
========================= */
exports.getAttemptDetails = async (req, res) => {
  try {
    const Attempt = getAttempt();
    const Quiz = getQuiz();

    const attempt = await Attempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const safeAttempt = attempt.toObject ? attempt.toObject() : attempt;
    if (req.user.role !== "admin" && safeAttempt.student?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: you may only view your own attempt" });
    }

    if (safeAttempt.quiz && typeof safeAttempt.quiz === "string") {
      safeAttempt.quiz = await Quiz.findById(safeAttempt.quiz);
    }

    res.json(safeAttempt);
  } catch (err) {
    console.error("Attempt error:", err);
    res.status(500).json({ message: "Server error fetching attempt" });
  }
};

/* =========================
   ANALYTICS (ADMIN DASHBOARD)
========================= */
exports.getAnalytics = async (req, res) => {
  try {
    const Attempt = getAttempt();

    const totalAttempts = await Attempt.countDocuments();
    const submitted = await Attempt.countDocuments({ status: "submitted" });

    const avgResult = await Attempt.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$score" },
        },
      },
    ]);

    const passResult = await Attempt.aggregate([
      {
        $group: {
          _id: null,
          passRate: {
            $avg: {
              $cond: [{ $gte: ["$score", 50] }, 1, 0],
            },
          },
        },
      },
    ]);

    const avgScore = avgResult[0]?.avgScore || 0;
    const passRate = passResult[0]?.passRate || 0;

    res.json({
      totalAttempts,
      submitted,
      avgScore: Number(avgScore.toFixed(2)),
      passRate: Number((passRate * 100).toFixed(2)),
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Server error analytics" });
  }
};

/* =========================
   CREATE COURSE SECTION QUIZ (ADMIN)
========================= */
exports.createCourseSectionQuiz = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const { courseId, sectionId, ...quizData } = req.body;

    // Validate required fields
    if (!courseId || !sectionId) {
      return res.status(400).json({ message: "Course ID and Section ID are required" });
    }

    const quiz = await Quiz.create({
      ...quizData,
      courseId,
      courseSectionId: sectionId, // Store section ID as string
      quizType: "section",
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Section quiz created successfully",
      quiz,
    });
  } catch (err) {
    console.error("Create section quiz error:", err);
    res.status(500).json({ message: "Server error creating section quiz" });
  }
};

/* =========================
   GET COURSE SECTION QUIZZES
========================= */
exports.getCourseSectionQuizzes = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const { courseId, sectionId } = req.params;

    let query = { courseId, quizType: "section" };
    if (sectionId) {
      query.courseSectionId = sectionId;
    }

    const quizzes = await Quiz.find(query).populate('courseId', 'title');

    res.status(200).json({
      message: "Section quizzes retrieved successfully",
      quizzes,
    });
  } catch (err) {
    console.error("Get section quizzes error:", err);
    res.status(500).json({ message: "Server error retrieving section quizzes" });
  }
};

/* =========================
   START COURSE SECTION QUIZ
========================= */
exports.startCourseSectionQuiz = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const Attempt = getAttempt();
    const Enrollment = getEnrollment();

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if user is enrolled in the course
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: quiz.courseId,
      status: "active"
    });

    if (!enrollment) {
      return res.status(403).json({ message: "You must be enrolled in this course to take the quiz" });
    }

    const now = new Date();
    const hasFullAccess = enrollment.accessType === "full";
    const hasAssessmentAccess = enrollment.accessType === "assessment" && enrollment.validUntil && new Date(enrollment.validUntil) > now;

    if (!hasFullAccess && !hasAssessmentAccess) {
      return res.status(403).json({
        message: "You need full course access or active assessment access to take this quiz",
      });
    }

    // Check if section lessons are completed (this would need to be implemented based on progress tracking)
    // For now, we'll allow the quiz to start if enrolled

    const selectedPart = (req.body.selectedPart || "A").toString().toUpperCase();
    const allowedParts = quiz.allowedParts?.map((part) => part.toString().toUpperCase()) || ["A", "B"];
    const validatedPart = allowedParts.includes(selectedPart) ? selectedPart : "A";

    const attempt = await Attempt.create({
      student: req.user.id,
      quiz: quiz._id,
      selectedPart: validatedPart,
      startedAt: new Date(),
      status: "in-progress",
    });

    res.json({
      message: "Section quiz started",
      attemptId: attempt._id,
      quiz,
    });
  } catch (err) {
    console.error("Start section quiz error:", err);
    res.status(500).json({ message: "Server error starting section quiz" });
  }
};

/* =========================
   IMPORT QUIZ QUESTIONS (ADMIN)
========================= */
exports.importQuizQuestions = async (req, res) => {
  try {
    const Quiz = getQuiz();
    const { quizId, questions } = req.body;

    if (!quizId || !Array.isArray(questions)) {
      return res.status(400).json({ message: "Quiz ID and questions array are required" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Update quiz with imported questions
    quiz.questions = questions;
    await quiz.save();

    res.status(200).json({
      message: "Questions imported successfully",
      quiz,
    });
  } catch (err) {
    console.error("Import questions error:", err);
    res.status(500).json({ message: "Server error importing questions" });
  }
};