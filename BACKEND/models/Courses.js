const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ["YouTube", "Vimeo", "Cloudinary", "MP4", "External", "None"],
      default: "External",
    },
    thumbnail: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    attachments: [
      {
        title: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    duration: {
      type: String,
      default: "00:00",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const sectionQuizSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
    quizType: { type: String, enum: ["quiz", "mock-test", "monthly-exam"], default: "quiz" },
    duration: { type: Number }, // in minutes
    totalMarks: { type: Number },
    passingScore: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const sectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    resources: [
      {
        title: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    qa: [
      {
        question: { type: String, default: "" },
        answer: { type: String, default: "" },
      },
    ],
    objectives: {
      type: [String],
      default: [],
    },
    announcements: [
      {
        title: { type: String, default: "" },
        message: { type: String, default: "" },
        date: { type: Date, default: Date.now },
      },
    ],
    lessons: [lessonSchema],
    quizzes: [sectionQuizSchema],
  },
  { _id: true }
);

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    totalDuration: {
      type: String,
      default: "0h 0m",
    },
    category: {
      type: String,
      default: "IT",
    },
    subject: {
      type: String,
      default: "General Subjects",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    rating: {
      type: Number,
      default: 4.7,
    },
    instructor: {
      name: {
        type: String,
        required: true,
      },
      avatar: {
        type: String,
        default: "",
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    price: {
      type: Number,
      default: 0,
    },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    sections: [sectionSchema],
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    certificateEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
courseSchema.index({ category: 1 });
courseSchema.index({ level: 1 });
courseSchema.index({ price: 1 });

module.exports = mongoose.model("Course", courseSchema);