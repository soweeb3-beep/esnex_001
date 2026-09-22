const { getModel } = require("../config/adapter");

const getQuestion = () => getModel("Question");

/* =========================
   CREATE QUESTION (ADMIN)
========================= */
exports.createQuestion = async (req, res) => {
  try {
    const Question = getQuestion();
    const { text, options, correctAnswer, explanation, subject, topic, difficulty } = req.body;

    if (!text || !options || !correctAnswer || !subject) {
      return res.status(400).json({ message: "Text, options, correctAnswer, and subject are required" });
    }

    if (!options.includes(correctAnswer)) {
      return res.status(400).json({ message: "Correct answer must be one of the options" });
    }

    const question = await Question.create({
      text,
      options,
      correctAnswer,
      explanation,
      subject,
      topic,
      difficulty,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Question created successfully",
      question,
    });
  } catch (err) {
    console.error("Create question error:", err);
    res.status(500).json({ message: "Server error creating question" });
  }
};

/* =========================
   GET ALL QUESTIONS (ADMIN)
========================= */
exports.getAllQuestions = async (req, res) => {
  try {
    const Question = getQuestion();
    const { subject, topic, difficulty } = req.query;

    const query = {};
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;

    const questions = await Question.find(query).populate("createdBy", "name");

    res.status(200).json({
      message: "Questions retrieved successfully",
      questions,
    });
  } catch (err) {
    console.error("Get questions error:", err);
    res.status(500).json({ message: "Server error retrieving questions" });
  }
};

/* =========================
   UPDATE QUESTION (ADMIN)
========================= */
exports.updateQuestion = async (req, res) => {
  try {
    const Question = getQuestion();
    const { text, options, correctAnswer, explanation, subject, topic, difficulty } = req.body;

    const question = await Question.findByIdAndUpdate(
      req.params.id,
      {
        text,
        options,
        correctAnswer,
        explanation,
        subject,
        topic,
        difficulty,
      },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({
      message: "Question updated successfully",
      question,
    });
  } catch (err) {
    console.error("Update question error:", err);
    res.status(500).json({ message: "Server error updating question" });
  }
};

/* =========================
   DELETE QUESTION (ADMIN)
========================= */
exports.deleteQuestion = async (req, res) => {
  try {
    const Question = getQuestion();

    const question = await Question.findByIdAndDelete(req.params.id);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({
      message: "Question deleted successfully",
    });
  } catch (err) {
    console.error("Delete question error:", err);
    res.status(500).json({ message: "Server error deleting question" });
  }
};