const AssessmentAttempt = require("../models/AssessmentAttempt");
const {
  loadPartQuestions,
  questionFileExists,
} = require("../utils/questionFileLoader");
const { loadQuestionsFromFiles, getSectionFileCandidates } = require('../utils/examLoader');
const aiMarkingService = require('../services/aiMarkingService');
const { getModel } = require("../config/adapter");
const { buildGlobalAssessmentTemplate } = require('../utils/assessmentBuilder');

const getAssessmentEnrollmentModel = () => getModel("AssessmentEnrollment");
const getNormalizedUserId = (reqUser) => String(reqUser?.id || reqUser?._id || "");

const normalizeRubric = (rubricSource) => {
  if (!rubricSource) return null;
  if (typeof rubricSource === 'object' && !Array.isArray(rubricSource) && Object.keys(rubricSource).length > 0) {
    return rubricSource;
  }
  if (typeof rubricSource === 'string') {
    try {
      const parsed = JSON.parse(rubricSource);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
};

const deriveAnswerRubric = (ans, qMeta) => {
  return normalizeRubric(
    ans?.rubric ||
      ans?.markingRubric ||
      qMeta?.rubric ||
      qMeta?.markingRubric ||
      qMeta?.marking_scheme ||
      qMeta?.ai_marking_guide ||
      qMeta?.markingCriteria ||
      qMeta?.marking_criteria ||
      qMeta?.question?.marking_scheme ||
      qMeta?.question?.ai_marking_guide ||
      qMeta?.question?.markingCriteria ||
      qMeta?.question?.marking_criteria ||
      null
  );
};

const getQuestionTypeKey = (qMeta) => {
  return String(
    qMeta?.questionType ||
    qMeta?.type ||
    qMeta?.subType ||
    qMeta?.sectionName ||
    qMeta?.section_title ||
    qMeta?.question?.questionType ||
    qMeta?.question?.type ||
    ''
  )
    .trim()
    .toLowerCase();
};

const isEssayQuestion = (qMeta) => {
  const key = getQuestionTypeKey(qMeta);
  return key.includes('essay') || key.includes('article') || key.includes('letter') || key.includes('story') || key.includes('debate');
};

const isComprehensionQuestion = (qMeta) => {
  const key = getQuestionTypeKey(qMeta);
  return key.includes('comprehension');
};

const isSummaryQuestion = (qMeta) => {
  const key = getQuestionTypeKey(qMeta);
  return key.includes('summary');
};

const getExpectedTotalMarksForQuestion = (qMeta, questions = []) => {
  if (!qMeta || typeof qMeta !== 'object') return 1;
  const explicitMarks = Number(qMeta.totalMarks ?? qMeta.total_marks ?? qMeta.marks);

  if (isEssayQuestion(qMeta)) {
    return 50;
  }

  if (isSummaryQuestion(qMeta)) {
    const summaryQuestions = (questions || []).filter(isSummaryQuestion).length || 1;
    return Math.round((20 / summaryQuestions) * 100) / 100;
  }

  if (isComprehensionQuestion(qMeta)) {
    const comprehensionQuestions = (questions || []).filter(isComprehensionQuestion).length || 1;
    return Math.round((30 / comprehensionQuestions) * 100) / 100;
  }

  if (Number.isFinite(explicitMarks) && explicitMarks > 0) {
    return explicitMarks;
  }

  if (isEssayQuestion(qMeta)) {
    return 50;
  }

  if (isSummaryQuestion(qMeta)) {
    const summaryQuestions = (questions || []).filter(isSummaryQuestion).length || 1;
    return Math.round((20 / summaryQuestions) * 100) / 100;
  }

  if (isComprehensionQuestion(qMeta)) {
    const comprehensionQuestions = (questions || []).filter(isComprehensionQuestion).length || 1;
    return Math.round((30 / comprehensionQuestions) * 100) / 100;
  }

  const rubric = normalizeRubric(
    qMeta?.rubric || qMeta?.markingRubric || qMeta?.marking_scheme || qMeta?.ai_marking_guide || qMeta?.markingCriteria || qMeta?.marking_criteria || qMeta?.question?.marking_scheme || qMeta?.question?.markingCriteria || qMeta?.question?.marking_criteria
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

// ===== ADMIN ENDPOINTS =====

/**
 * Create a new standard assessment
 */
exports.createAssessment = async (req, res) => {
  try {
    const { name, subject, description, parts, totalMarks, passmark, ...rest } =
      req.body;

    // Validate required fields
    if (!name || !subject || !parts || parts.length === 0) {
      return res.status(400).json({
        error:
          "name, subject, and at least one part are required",
      });
    }

    // Validate that question files exist
    for (const part of parts) {
      for (const section of part.sections) {
        if (!questionFileExists(section.fileReference)) {
          return res.status(400).json({
            error: `Question file not found: ${section.fileReference}`,
          });
        }
      }
    }

    const assessment = new StandardAssessment({
      name,
      subject,
      description,
      parts,
      totalMarks,
      passmark,
      createdBy: req.user._id,
      ...rest,
    });

    await assessment.save();

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      assessment,
    });
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all assessments
 */
exports.getAllAssessments = async (req, res) => {
  try {
    const { subject, status, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (subject) filter.subject = subject;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const assessments = await StandardAssessment.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("linkedCourses", "name code")
      .sort({ createdAt: -1 });

    const total = await StandardAssessment.countDocuments(filter);

    res.json({
      success: true,
      assessments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single assessment by ID
 */
exports.getAssessmentById = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findById(req.params.id).populate(
      "linkedCourses",
      "name code"
    );

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json({
      success: true,
      assessment,
    });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

// Build an assessment template for a subject (admin-only)
exports.getAssessmentTemplate = async (req, res) => {
  try {
    const { subject, name, description, duration, totalMarks, passingScore } = req.body || {};
    if (!subject) return res.status(400).json({ message: 'Subject is required' });
    const { assessmentPayload, warnings } = await buildGlobalAssessmentTemplate({
      subject,
      name,
      description,
      duration,
      totalMarks,
      passingScore,
    });
    res.json({ template: assessmentPayload, warnings });
  } catch (error) {
    console.error('Get assessment template error:', error && error.stack ? error.stack : error);
    res.status(500).json({ message: error.message || 'Unable to build assessment template' });
  }
};

/**
 * Update assessment
 */
exports.updateAssessment = async (req, res) => {
  try {
    const { parts, ...rest } = req.body;

    // Validate question files if parts are being updated
    if (parts) {
      for (const part of parts) {
        for (const section of part.sections) {
          if (!questionFileExists(section.fileReference)) {
            return res.status(400).json({
              error: `Question file not found: ${section.fileReference}`,
            });
          }
        }
      }
    }

    const assessment = await StandardAssessment.findByIdAndUpdate(
      req.params.id,
      {
        ...rest,
        ...(parts && { parts }),
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json({
      success: true,
      message: "Assessment updated successfully",
      assessment,
    });
  } catch (error) {
    console.error("Error updating assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete assessment
 */
exports.deleteAssessment = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findByIdAndDelete(req.params.id);

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Publish assessment (make it visible to students)
 */
exports.publishAssessment = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findByIdAndUpdate(
      req.params.id,
      {
        status: "published",
        visibility: true,
        updatedBy: req.user._id,
      },
      { new: true }
    );

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json({
      success: true,
      message: "Assessment published successfully",
      assessment,
    });
  } catch (error) {
    console.error("Error publishing assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Archive assessment (hide from students)
 */
exports.archiveAssessment = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findByIdAndUpdate(
      req.params.id,
      {
        status: "archived",
        visibility: false,
        updatedBy: req.user._id,
      },
      { new: true }
    );

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json({
      success: true,
      message: "Assessment archived successfully",
      assessment,
    });
  } catch (error) {
    console.error("Error archiving assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get assessment statistics
 */
exports.getAssessmentStats = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const enrollments = await StandardAssessmentEnrollment.find({
      assessmentId: req.params.id,
    });

    const attempts = await AssessmentAttempt.find({
      assessmentId: req.params.id,
      assessmentType: "standard",
    });

    const completedAttempts = attempts.filter((a) => a.status === "marked");

    let avgScore = 0;
    let passCount = 0;

    if (completedAttempts.length > 0) {
      avgScore =
        completedAttempts.reduce((sum, a) => sum + a.obtainedMarks, 0) /
        completedAttempts.length;
      passCount = completedAttempts.filter((a) => a.passed).length;
    }

    res.json({
      success: true,
      stats: {
        totalEnrollments: enrollments.length,
        activeEnrollments: enrollments.filter((e) => e.status === "active").length,
        totalAttempts: attempts.length,
        completedAttempts: completedAttempts.length,
        averageScore: avgScore.toFixed(2),
        passRate:
          completedAttempts.length > 0
            ? ((passCount / completedAttempts.length) * 100).toFixed(2)
            : 0,
        enrollments: enrollments.length,
      },
    });
  } catch (error) {
    console.error("Error fetching assessment stats:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===== STUDENT ENDPOINTS =====

/**
 * Get all published assessments
 */
exports.getPublishedAssessments = async (req, res) => {
  try {
    const { subject, page = 1, limit = 10 } = req.query;
    const filter = {
      status: "published",
      visibility: true,
    };

    if (subject) filter.subject = subject;

    const skip = (page - 1) * limit;

    const assessments = await StandardAssessment.find(filter)
      .skip(skip)
      .limit(limit)
      .select("-parts") // Don't return full part details
      .sort({ createdAt: -1 });

    const total = await StandardAssessment.countDocuments(filter);

    res.json({
      success: true,
      assessments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching published assessments:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get assessment details for student
 */
exports.getAssessmentDetails = async (req, res) => {
  try {
    const assessment = await StandardAssessment.findById(req.params.id);

    if (!assessment || assessment.status !== "published") {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Get enrollment status if student
    let enrollment = null;
    if (req.user) {
      const userId = getNormalizedUserId(req.user);
      const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
      enrollment = userId
        ? await AssessmentEnrollmentModel.findOne({
            assessmentId: req.params.id,
            studentId: userId,
          })
        : null;
    }

    // Return assessment details without correct answers or complete questions
    const details = {
      id: assessment._id,
      name: assessment.name,
      description: assessment.description,
      subject: assessment.subject,
      examBoard: assessment.examBoard,
      price: assessment.price,
      currency: assessment.currency,
      totalMarks: assessment.totalMarks,
      passmark: assessment.passmark,
      certificateAvailable: assessment.certificateAvailable,
      parts: assessment.parts.map((p) => ({
        partName: p.partName,
        partType: p.partType,
        duration: p.duration,
        totalMarks: p.totalMarks,
        sections: p.sections.map((s) => ({
          name: s.name,
          questionCount: s.questionCount,
          marksPerQuestion: s.marksPerQuestion,
        })),
      })),
      enrollment: enrollment ? {
        status: enrollment.status,
        accessGranted: enrollment.accessGranted,
        canAttempt: enrollment.canAttempt(),
        attempts: enrollment.attempts,
        bestScore: enrollment.bestScore,
      } : null,
    };

    res.json({
      success: true,
      assessment: details,
    });
  } catch (error) {
    console.error("Error fetching assessment details:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student's enrolled assessments
 */
exports.getEnrolledAssessments = async (req, res) => {
  try {
    const userId = getNormalizedUserId(req.user);
    const AssessmentEnrollmentModel = getAssessmentEnrollmentModel();
    const AssessmentModel = getModel("Assessment");
    const enrollments = await AssessmentEnrollmentModel.find({
      studentId: userId,
    });

    const assessments = [];
    for (const enrollment of enrollments) {
      const assessmentId = enrollment.assessmentId;
      let assessment = null;
      if (assessmentId) {
        assessment = await AssessmentModel.findById(assessmentId);
      }

      const assessmentData = assessment && typeof assessment.toObject === "function"
        ? assessment.toObject()
        : assessment;

      assessments.push({
        ...(assessmentData || {}),
        _id: assessmentData?._id || assessmentId,
        enrollment: {
          status: enrollment.status,
          accessGranted: enrollment.accessGranted,
          bestScore: enrollment.bestScore,
          attempts: enrollment.attempts,
        },
      });
    }

    res.json({
      success: true,
      assessments,
    });
  } catch (error) {
    console.error("Error fetching enrolled assessments:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Start an assessment attempt
 */
exports.startAssessment = async (req, res) => {
  try {
    const { assessmentId, selectedPart } = req.body;
    const userId = req.user?.id || req.user?._id;

    // Get assessment using adapter (falls back to mock DB)
    const StandardAssessment = getModel("StandardAssessment");
    const assessment = await StandardAssessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Check enrollment and access using the adapter so mock mode works with string IDs
    const EnrollmentModel = getModel("AssessmentEnrollment");
    let enrollment = await EnrollmentModel.findOne({
      assessmentId,
      studentId: String(userId),
    });

    let isMockEnrollment = false;
    let mockEnrollmentModel = null;
    let mockEnrollmentRecord = null;

    if (enrollment && typeof enrollment.canAttempt !== "function") {
      const rawRecord = enrollment;
      enrollment = {
        ...rawRecord,
        attempts: rawRecord.attempts || { total: 2, used: 0, remaining: 2 },
        canAttempt() {
          if (!rawRecord.accessGranted) {
            return { allowed: false, reason: "Access not granted" };
          }
          const remaining = rawRecord.attempts?.remaining ?? 0;
          if (remaining <= 0) {
            return { allowed: false, reason: "No attempts remaining" };
          }
          return { allowed: true };
        },
        recordAttempt(retakeDelay = 0) {
          const attempts = this.attempts || { total: 2, used: 0, remaining: 2 };
          attempts.used += 1;
          attempts.remaining = attempts.total - attempts.used;
          attempts.lastAttemptDate = new Date().toISOString();
          if (retakeDelay > 0) {
            attempts.nextRetakeEligibleDate = new Date(Date.now() + retakeDelay * 86400000).toISOString();
          }
          this.attempts = attempts;
          return this;
        },
      };
    }

    if (!enrollment) {
      try {
        mockEnrollmentModel = EnrollmentModel;
        mockEnrollmentRecord = await mockEnrollmentModel.findOne({ assessmentId, studentId: String(userId) });
        if (mockEnrollmentRecord) {
          isMockEnrollment = true;
          enrollment = {
            ...mockEnrollmentRecord,
            attempts: mockEnrollmentRecord.attempts || { total: 2, used: 0, remaining: 2 },
            canAttempt() {
              if (!mockEnrollmentRecord.accessGranted) {
                return { allowed: false, reason: "Access not granted" };
              }
              const remaining = mockEnrollmentRecord.attempts?.remaining ?? 0;
              if (remaining <= 0) {
                return { allowed: false, reason: "No attempts remaining" };
              }
              return { allowed: true };
            },
            recordAttempt(retakeDelay = 0) {
              const attempts = this.attempts || { total: 2, used: 0, remaining: 2 };
              attempts.used += 1;
              attempts.remaining = attempts.total - attempts.used;
              attempts.lastAttemptDate = new Date().toISOString();
              if (retakeDelay > 0) {
                attempts.nextRetakeEligibleDate = new Date(Date.now() + retakeDelay * 86400000).toISOString();
              }
              this.attempts = attempts;
              return this;
            },
          };
        }
      } catch (err) {
        console.warn("Mock enrollment lookup failed:", err.message || err);
      }
    }

    if (!enrollment) {
      return res.status(403).json({ error: "Not enrolled in this assessment" });
    }

    const canAttempt = enrollment.canAttempt();
    if (!canAttempt.allowed) {
      return res.status(403).json({ error: canAttempt.reason });
    }

    // Validate selected part
    const part = assessment.parts.find((p) => p.partName === selectedPart);
    if (!part) {
      return res.status(400).json({ error: "Invalid part selected" });
    }

    // Create attempt using the adapter so mock mode can persist via JSON files
    const AttemptModel = getModel("AssessmentAttempt");
    const attemptPayload = {
      assessmentType: "standard",
      assessmentId,
      assessmentTypeRef: "StandardAssessment",
      studentId: String(userId),
      totalMarks: part.totalMarks,
      duration: part.duration,
      selectedPart,
      status: "in-progress",
      sessionToken: generateSessionToken(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    let attempt;
    if (typeof AttemptModel.create === "function") {
      attempt = await AttemptModel.create(attemptPayload);
    } else {
      attempt = new AttemptModel(attemptPayload);
      await attempt.save();
    }

    // Load questions for the part
    const partQuestions = await loadPartQuestions(part);
    console.log('[startAssessment] partQuestions keys:', Object.keys(partQuestions), 'partQuestions lengths:', Object.entries(partQuestions).map(([k,v])=>[k, Array.isArray(v)?v.length:null]));

    // Create flattened question list without answers
    const questionsList = [];
    for (const [sectionName, questions] of Object.entries(partQuestions)) {
      questions.forEach((q, index) => {
        questionsList.push({
          sectionName,
          questionIndex: index,
          questionId: q.id,
          questionText: q.text,
          type: q.type,
          options: q.options,
          marks: q.marks,
          correctAnswer: q.correctAnswer, // We'll use this for validation, but won't expose to client initially
        });
      });
    }

    attempt.questions = questionsList;
    if (typeof attempt.save === "function") {
      await attempt.save();
    }

    // Update enrollment attempts
    enrollment.recordAttempt(assessment.retakeRules.retakeDelay);

    if (isMockEnrollment && mockEnrollmentModel && mockEnrollmentRecord) {
      try {
        const update = {
          attempts: enrollment.attempts,
          lastAttemptDate: enrollment.attempts.lastAttemptDate || new Date().toISOString(),
          nextRetakeEligibleDate: enrollment.nextRetakeEligibleDate || null,
        };
        if (typeof mockEnrollmentModel.findByIdAndUpdate === "function") {
          await mockEnrollmentModel.findByIdAndUpdate(mockEnrollmentRecord._id || mockEnrollmentRecord._id, update);
        } else if (typeof mockEnrollmentModel.findOneAndUpdate === "function") {
          await mockEnrollmentModel.findOneAndUpdate({ _id: mockEnrollmentRecord._id }, update, { new: true });
        }
      } catch (err) {
        console.warn("Failed to persist mock enrollment update:", err.message || err);
      }
    } else {
      await enrollment.save();
    }

    // Return attempt with questions (excluding correct answers)
    const questionsForStudent = questionsList.map((q) => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });

    res.json({
      success: true,
      message: "Assessment started",
      attempt: {
        id: attempt._id,
        sessionToken: attempt.sessionToken,
        selectedPart,
        duration: part.duration,
        totalMarks: part.totalMarks,
        questions: questionsForStudent,
      },
    });
  } catch (error) {
    console.error("Error starting assessment:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Submit an answer
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId, questionId, studentAnswer } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    // Find the question in attempt
    const question = attempt.questions.find((q) => q.questionId === questionId);
    if (!question) {
      return res.status(400).json({ error: "Question not found" });
    }

    // Check answer
    const isCorrect =
      String(question.correctAnswer) === String(studentAnswer);
    const marks = isCorrect ? question.marks : 0;

    // Add/update answer in answers array
    const existingAnswer = attempt.answers.find(
      (a) => a.questionId === questionId
    );

    if (existingAnswer) {
      existingAnswer.studentAnswer = studentAnswer;
      existingAnswer.isCorrect = isCorrect;
      existingAnswer.marks = marks;
      existingAnswer.answeredAt = new Date();
    } else {
      attempt.answers.push({
        questionId,
        questionText: question.questionText,
        questionType: question.type,
        partName: attempt.selectedPart,
        sectionName: question.sectionName,
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
      marks: isCorrect ? question.marks : 0,
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Submit part completion
 */
exports.submitPart = async (req, res) => {
  try {
    const { attemptId } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(attemptId)) return res.status(400).json({ error: 'Invalid attemptId' });
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    // Run AI marking for theory/text answers in this part if not already marked
    try {
      const answersToMark = attempt.answers.filter(a => a.partName === attempt.selectedPart && !a.aiMarked && (!a.correctAnswer || a.questionType === 'essay' || a.questionType === 'comprehension' || a.questionType === 'summary'));
      console.log(`submitPart: found ${answersToMark.length} answersToMark for attempt ${attempt._id}`);
      if (answersToMark.length > 0) {
        for (const ans of answersToMark) {
          console.log(`Marking answer ${ans.questionId} - current marks=${ans.marks} aiMarked=${ans.aiMarked}`);
          const qMeta = attempt.questions && attempt.questions.find(q => q.questionId === ans.questionId);
          const questionText = ans.questionText || (qMeta && (qMeta.questionText || qMeta.prompt || qMeta.text || (typeof qMeta.question === 'string' ? qMeta.question : '') || qMeta.question?.prompt || qMeta.question?.text)) || '';
          const rubric = deriveAnswerRubric(ans, qMeta);
          const markingCriteria = qMeta && (qMeta.markingCriteria || qMeta.marking_criteria || qMeta.question?.markingCriteria || qMeta.question?.marking_criteria) || null;
          const minimumWordCount = qMeta && (qMeta.minimumWords || qMeta.minimum_words || qMeta.question?.minimumWords || qMeta.question?.minimum_words) || null;
          const computedTotalMarks = Number(
            ans.totalMarks ??
              qMeta?.totalMarks ??
              qMeta?.total_marks ??
              qMeta?.marks ??
              (rubric ? Object.values(rubric).reduce((sum, value) => sum + Number(value || 0), 0) : 5)
          ) || 5;
          const expectedTotalMarks = getExpectedTotalMarksForQuestion(qMeta, attempt.questions);
          const totalMarks = expectedTotalMarks || computedTotalMarks;
          const expectedPoints = Number(
            qMeta?.totalMarks ?? qMeta?.total_marks ?? ans.totalMarks ?? totalMarks
          ) || totalMarks;
          const modelAnswer = (qMeta && (qMeta.modelAnswer || qMeta.model_answer || qMeta.question?.modelAnswer || qMeta.question?.model_answer)) || null;
          if (!ans.totalMarks || ans.totalMarks !== totalMarks) ans.totalMarks = totalMarks;

          try {
            let report = null;
            if (isEssayQuestion(qMeta)) {
              const essayType = qMeta.question?.essay_type || qMeta.essayType || qMeta.type || qMeta.questionType || 'essay';
              const evaluation = await aiMarkingService.evaluateEnglishEssay({
                essayType,
                essayText: questionText,
                studentAnswer: ans.studentAnswer || '',
                modelAnswer,
                rubric: rubric || {
                  WordCount: 5,
                  Content: 10,
                  Organization: 10,
                  Expression: 10,
                  MechanicalAccuracy: 15,
                },
                minimumWordCount: minimumWordCount || 450,
              });
              report = evaluation.report;
              // attach raw provider response when available
              if (evaluation.rawResponse) report.rawResponse = evaluation.rawResponse;
            } else if (isComprehensionQuestion(qMeta) || isSummaryQuestion(qMeta)) {
              const evaluation = await aiMarkingService.evaluateComprehensionOrSummary({
                passageText: qMeta.passage || qMeta.passageText || qMeta.question?.passage || qMeta.question?.passageText || '',
                questionText,
                studentAnswer: ans.studentAnswer || '',
                modelAnswer,
                questionType: isSummaryQuestion(qMeta) ? 'summary' : 'comprehension',
                acceptedAnswers: qMeta.acceptedAnswers || qMeta.accepted_answers || qMeta.question?.acceptedAnswers || qMeta.question?.accepted_answers || [],
              });
              report = evaluation.report;
              if (evaluation.rawResponse) report.rawResponse = evaluation.rawResponse;
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
              if (evaluation.rawResponse) report.rawResponse = evaluation.rawResponse;
            }

            // Persist AI report and apply score
            ans.aiReport = report;
            ans.aiFeedback = report.feedback || '';
            ans.aiMarked = true;
            // Ensure numeric marks and clamp to totalMarks
            let numericScore = typeof report.score === 'number' ? report.score : Number(report.score);
            if (!Number.isFinite(numericScore)) numericScore = 0;
            // If report appears to be fractional proportion (0-1), scale to totalMarks
            if (numericScore > 0 && numericScore <= 1 && ans.totalMarks) {
              numericScore = Math.round(numericScore * Number(ans.totalMarks));
            }
            // Clamp
            if (ans.totalMarks) numericScore = Math.max(0, Math.min(Number(ans.totalMarks), numericScore));
            ans.marks = numericScore;
            console.log(`AI marking provider for ${ans.questionId}: ${report.provider || 'unknown'} score=${ans.marks} fallback=${report.provider === 'local'}`);
          } catch (err) {
            console.error('AI marking failed for answer', ans.questionId, err.message || err);
            // Leave answer unchanged; mark for review
            ans.aiMarked = false;
            ans.aiFeedback = `AI marking failed: ${err.message}`;
          }
        }

        // Save attempt after AI updates so pre-save recalculates totals
        await attempt.save();
        console.log(`submitPart: saved attempt ${attempt._id} after AI marking. obtainedMarks=${attempt.obtainedMarks}`);
        // Log per-answer debug summary
        attempt.answers.forEach(a => {
          console.log(`Answer ${a.questionId}: marks=${a.marks} totalMarks=${a.totalMarks} aiMarked=${a.aiMarked} provider=${a.aiReport?.provider}`);
        });
      }
    } catch (aiErr) {
      console.error('Error during AI marking:', aiErr);
    }
    // Save part attempt
    const partAttempt = {
      partName: attempt.selectedPart,
      totalMarks: attempt.totalMarks,
      obtainedMarks: attempt.obtainedMarks,
      percentage: attempt.percentage,
      status: "submitted",
      submittedAt: new Date(),
    };

    if (!attempt.partAttempts) {
      attempt.partAttempts = [];
    }

    const existingPart = attempt.partAttempts.find(
      (p) => p.partName === attempt.selectedPart
    );
    if (existingPart) {
      Object.assign(existingPart, partAttempt);
    } else {
      attempt.partAttempts.push(partAttempt);
    }

    attempt.status = "submitted";
    attempt.submittedAt = new Date();
    attempt.aiReport = buildAttemptAiReport(attempt);
    await attempt.save();

    const responsePayload = {
      success: true,
      message: "Part submitted successfully",
      marks: attempt.obtainedMarks,
      percentage: attempt.percentage.toFixed(2),
    };

    // Include debug answer details when not in production to help diagnose marking
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.debugAnswers = attempt.answers.map(a => ({
        questionId: a.questionId,
        marks: a.marks,
        totalMarks: a.totalMarks,
        aiMarked: a.aiMarked,
        aiProvider: a.aiReport && a.aiReport.provider ? a.aiReport.provider : null,
        aiScoreRaw: a.aiReport && (a.aiReport.score || a.aiReport.totalScore) ? (a.aiReport.score || a.aiReport.totalScore) : null,
      }));
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("Error submitting part:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get attempt results
 */
exports.getAttemptResults = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    if (attempt.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const assessment = await StandardAssessment.findById(attempt.assessmentId);

    res.json({
      success: true,
      results: {
        attemptId: attempt._id,
        totalMarks: attempt.totalMarks,
        obtainedMarks: attempt.obtainedMarks,
        percentage: attempt.percentage.toFixed(2),
        grade: attempt.grade,
        passed: attempt.passed,
        passmark: assessment.passmark,
        duration: attempt.duration,
        timeTaken: Math.round(attempt.timeTaken / 60), // in minutes
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        aiReport: attempt.aiReport || null,
        answers: attempt.answers.map((a) => ({
          questionText: a.questionText,
          studentAnswer: a.studentAnswer,
          correctAnswer: a.correctAnswer,
          marks: a.marks,
          totalMarks: a.totalMarks,
          isCorrect: a.isCorrect,
          aiFeedback: a.aiFeedback || null,
          aiReport: a.aiReport || null,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student's past attempts
 */
exports.getStudentAttempts = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const attempts = await AssessmentAttempt.find({
      assessmentId,
      studentId: req.user._id,
      assessmentType: "standard",
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .select(
        "obtainedMarks totalMarks percentage passed grade submittedAt createdAt"
      );

    const total = await AssessmentAttempt.countDocuments({
      assessmentId,
      studentId: req.user._id,
      assessmentType: "standard",
    });

    res.json({
      success: true,
      attempts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
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

// Local copy of normalizeQuestionItems used by loaders
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

// Re-export oral start flow from the legacy assessment controller to ensure parity
try {
  // require lazily to avoid potential circular require at startup
  const legacyAssessmentController = require('./assessmentController');
  if (legacyAssessmentController) {
    if (typeof legacyAssessmentController.startOralAssessment === 'function') {
      exports.startOralAssessment = legacyAssessmentController.startOralAssessment;
    }
    // Admin question CRUD + import tools
    if (typeof legacyAssessmentController.createQuestion === 'function') exports.createQuestion = legacyAssessmentController.createQuestion;
    if (typeof legacyAssessmentController.getQuestions === 'function') exports.getQuestions = legacyAssessmentController.getQuestions;
    if (typeof legacyAssessmentController.updateQuestion === 'function') exports.updateQuestion = legacyAssessmentController.updateQuestion;
    if (typeof legacyAssessmentController.deleteQuestion === 'function') exports.deleteQuestion = legacyAssessmentController.deleteQuestion;
    if (typeof legacyAssessmentController.importQuestionsFromBank === 'function') exports.importQuestionsFromBank = legacyAssessmentController.importQuestionsFromBank;
    // Question-path loaders
    if (typeof legacyAssessmentController.getQuestionsByPath === 'function') exports.getQuestionsByPath = legacyAssessmentController.getQuestionsByPath;
    if (typeof legacyAssessmentController.loadQuestionsFromNewPath === 'function') exports.loadQuestionsFromNewPath = legacyAssessmentController.loadQuestionsFromNewPath;
  }
} catch (e) {
  // ignore if legacy controller cannot be required in some environments
  console.error('standardAssessmentController: unable to re-export startOralAssessment:', e && e.message);
}

// Admin question CRUD + import tools (implemented here to ensure correct model use)
exports.createQuestion = async (req, res) => {
  try {
    const { assessmentId, partName, sectionName, questionData } = req.body;
    if (!assessmentId || !partName || !sectionName || !questionData) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const QuestionModel = getModel('Question');
    const question = await QuestionModel.create({
      ...questionData,
      assessmentId,
      partName,
      sectionName,
      questionId: questionData.questionId || `${assessmentId}_${partName}_${sectionName}_${Date.now()}_${Math.random()}`,
    });
    res.status(201).json({ question });
  } catch (error) {
    console.error('Question creation error', error);
    res.status(500).json({ message: 'Unable to create question' });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const { assessmentId, partName, sectionName } = req.query;
    const filter = {};
    if (assessmentId) filter.assessmentId = assessmentId;
    if (partName) filter.partName = partName;
    if (sectionName) filter.sectionName = sectionName;
    const QuestionModel = getModel('Question');
    const questions = await QuestionModel.find(filter);
    res.json({ questions });
  } catch (error) {
    console.error('Questions fetch error', error);
    res.status(500).json({ message: 'Unable to fetch questions' });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const QuestionModel = getModel('Question');
    const question = await QuestionModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ question });
  } catch (error) {
    console.error('Question update error', error);
    res.status(500).json({ message: 'Unable to update question' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const QuestionModel = getModel('Question');
    await QuestionModel.findByIdAndDelete(id);
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Question deletion error', error);
    res.status(500).json({ message: 'Unable to delete question' });
  }
};

exports.importQuestionsFromBank = async (req, res) => {
  try {
    // Delegate to legacy importer which uses the shared loaders
    const legacy = require('./assessmentController');
    if (typeof legacy.importQuestionsFromBank === 'function') {
      return legacy.importQuestionsFromBank(req, res);
    }
    return res.status(500).json({ message: 'Importer not available' });
  } catch (error) {
    console.error('Question import error', error);
    res.status(500).json({ message: 'Unable to import questions' });
  }
};

// Loader copied from legacy controller: load questions from new path structure
exports.loadQuestionsFromNewPath = async (subject, partType, questionCount, sectionOrFiles = []) => {
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
      fileList = [...new Set([...(fileList || []), ...candidateFiles, "questions.json"])].filter((file) => Boolean(file));
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

    const { shuffleArray } = require("../utils/random");
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

module.exports = exports;
