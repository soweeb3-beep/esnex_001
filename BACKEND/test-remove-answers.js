const { removeQuestionAnswers } = require("./services/questionGenerator.service");

const testQuestion = {
  id: "eng_theory_essay_article_001",
  questionId: "eng_theory_essay_article_001",
  prompt: "Write an article about the impact of technology on modern learning.",
  text: "Write an article about the impact of technology on modern learning.",
  guidance: "250-350 words",
  correctAnswer: undefined,
  answer: undefined,
  options: undefined,
  explanation: "Some explanation",
  solution: "Some solution"
};

console.log("Input question:", JSON.stringify(testQuestion, null, 2));
const result = removeQuestionAnswers([testQuestion]);
console.log("\nAfter removeQuestionAnswers:", JSON.stringify(result[0], null, 2));
console.log("\nFields in result[0]:", Object.keys(result[0]));
