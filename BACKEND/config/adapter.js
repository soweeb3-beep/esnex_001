/**
 * Database adapter - switches between MongoDB and mock database
 */

const connectDB = require("./db");
const mockDb = require("./mockDb");

// Get the appropriate model based on MongoDB connection status
const getModel = (modelName) => {
  const isConnected = typeof connectDB.isMongoConnected === "function" ? connectDB.isMongoConnected() : false;
  const isMongooseConnected = require("mongoose").connection.readyState > 0;
  const useDatabase = isConnected || isMongooseConnected;

  if (useDatabase) {
    // If the model is already registered in mongoose, return it directly.
    const mongoose = require("mongoose");
    if (mongoose.modelNames().includes(modelName)) {
      return mongoose.model(modelName);
    }

    // Map model names to file names
    const modelFiles = {
      User: 'user',
      Course: 'Courses',
      Enrollment: 'Enrollment',
      Quiz: 'Quiz',
      Attempt: 'Attempt',
      Question: 'Question',
      GlobalAssessment: 'Assessment',
      CourseSectionAssessment: 'Assessment',
      AssessmentAttempt: 'Assessment',
      Assessment: 'Assessment',
      AssessmentEnrollment: 'Assessment',
      Payment: 'Payment',
      Message: 'Message',
    };
    const fileName = modelFiles[modelName] || modelName;
    const modelModule = require(`../models/${fileName}`);
    if (modelModule[modelName]) {
      return modelModule[modelName];
    }
    return modelModule;
  } else {
    // Use mock models
    switch (modelName) {
      case "user":
      case "User":
        return mockDb.UserMock;
      case "Courses":
      case "Course":
        return mockDb.CourseMock;
      case "Enrollment":
        return mockDb.EnrollmentMock;
      case "Quiz":
        return mockDb.QuizMock;
      case "Attempt":
      case "attempt":
        return mockDb.AttemptMock;
      case "HomepageSettings":
        return mockDb.HomepageMock;
      case "Question":
        return mockDb.QuestionMock;
      case "Assessment":
      case "GlobalAssessment":
      case "CourseSectionAssessment":
        return mockDb.AssessmentMock;
      case "StandardAssessment":
        return mockDb.StandardAssessmentMock;
      case "AssessmentAttempt":
        return mockDb.AssessmentAttemptMock;
      case "AssessmentEnrollment":
        return mockDb.AssessmentEnrollmentMock;
      case "Certificate":
        return mockDb.CertificateMock;
      case "Role":
        return mockDb.RoleMock;
      case "Payment":
        return mockDb.PaymentMock;
      case "Message":
        return mockDb.MessageMock;
    default:
      throw new Error(`No mock model for ${modelName}`);
    }
  }
};

module.exports = { getModel, isMongoConnected: () => connectDB.isMongoConnected?.() };
