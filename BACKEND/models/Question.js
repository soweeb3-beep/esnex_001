const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  // Question content
  text: { type: String, required: true },
  type: { type: String, enum: ["mcq", "theory", "math", "objective"], default: "mcq" },
  
  // MCQ specific
  options: [{ type: String }],
  correctAnswer: mongoose.Schema.Types.Mixed,
  
  // Theory specific
  sampleAnswer: { type: String },
  useAI: { type: Boolean, default: false },
  markingFormat: { type: String },
  
  // Math specific
  correctFormat: { type: String },
  
  // Question metadata
  explanation: { type: String },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  
  // Linking to assessment structure
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
  partName: { type: String }, // "Part A", "Part B", etc.
  sectionName: { type: String }, // "Section A", "Section B", etc.
  
  // Linking to quiz
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  visibility: { type: Boolean, default: true },
}, { timestamps: true });

questionSchema.index({ assessmentId: 1, partName: 1, sectionName: 1 });
questionSchema.index({ quizId: 1 });

module.exports = mongoose.model("Question", questionSchema);