import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/axios";

export default function ResultReview() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAttempt = async () => {
      try {
        const res = await API.get(`/quizzes/attempt/${id}`);
        setAttempt(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAttempt();
  }, [id]);

  const safeAnswer = (answer) => {
    if (answer === undefined || answer === null || answer === "") return "No answer provided";
    return Array.isArray(answer) ? answer.join(", ") : String(answer);
  };

  const getCorrectAnswerText = (q) => {
    if (q.correctAnswer) return q.correctAnswer;
    if (q.answer) return q.answer;
    if (q.correct) return q.correct;
    if (q.correctFormat) return q.correctFormat;
    if (q.sampleAnswer) return q.sampleAnswer;
    if (q.solution) return q.solution;
    if (q.answerKey) return q.answerKey;
    if (Array.isArray(q.options) && q.options.length) return q.options.join(" / ");
    if (q.type === "theory" || q.type === "oral" || q.type === "text" || q.questionType === "text") return q.sampleAnswer || "Reviewed by examiner";
    return "Not available";
  };

  const isCorrectAnswer = (userAnswer, q) => {
    const userText = safeAnswer(userAnswer).toLowerCase().trim();
    const correctText = safeAnswer(getCorrectAnswerText(q)).toLowerCase().trim();
    return userText !== "no answer provided" && userText === correctText;
  };

  const getGrade = (percentage) => {
    if (percentage >= 75) return { grade: "A1", label: "Excellent" };
    if (percentage >= 70) return { grade: "B2", label: "Very Good" };
    if (percentage >= 65) return { grade: "B3", label: "Good" };
    if (percentage >= 60) return { grade: "C4", label: "Credit" };
    if (percentage >= 55) return { grade: "C5", label: "Credit" };
    if (percentage >= 50) return { grade: "C6", label: "Credit" };
    if (percentage >= 45) return { grade: "D7", label: "Pass" };
    if (percentage >= 40) return { grade: "E8", label: "Pass" };
    return { grade: "F9", label: "Fail" };
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">Loading result review...</div>;
  }

  if (!attempt) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-rose-400">Result not found</div>;
  }

  const quiz = attempt.quiz;
  const answers = attempt.answers;
  const answerList = Array.isArray(answers) ? answers : Object.values(answers || {});
  const totalQuestions = quiz?.questions?.length || 0;
  const answeredCount = answerList.filter((answer) => answer !== undefined && answer !== null && answer !== "").length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const correctCount = quiz.questions.reduce((count, q, index) => (isCorrectAnswer(answers[index], q) ? count + 1 : count), 0);
  const wrongCount = Math.max(0, totalQuestions - correctCount - unansweredCount);
  const percentage = attempt.percentage ?? (attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0);
  const gradeInfo = getGrade(percentage);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-card">
          <h1 className="text-3xl font-semibold text-white">Exam Review</h1>
          <p className="mt-3 text-slate-400">Detailed review of your quiz attempt and answer feedback.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Quiz</p>
              <p className="mt-2 text-lg font-semibold text-white">{quiz.title}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Score</p>
              <p className="mt-2 text-lg font-semibold text-white">{attempt.score} / {attempt.total}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Percentage</p>
              <p className="mt-2 text-lg font-semibold text-white">{percentage}%</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Grade</p>
              <p className={`mt-2 text-lg font-semibold ${gradeInfo.grade === "F9" ? "text-rose-400" : "text-emerald-400"}`}>{gradeInfo.grade}</p>
              <p className="text-sm text-slate-400">{gradeInfo.label}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Answered</p>
              <p className="mt-2 text-lg font-semibold text-emerald-400">{answeredCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Correct</p>
              <p className="mt-2 text-lg font-semibold text-emerald-400">{correctCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Wrong</p>
              <p className="mt-2 text-lg font-semibold text-rose-400">{wrongCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-4">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Unanswered</p>
              <p className="mt-2 text-lg font-semibold text-slate-400">{unansweredCount}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {quiz.questions.map((q, i) => {
            const userAnswer = answers[i];
            const userAnswerText = safeAnswer(userAnswer);
            const correctAnswer = getCorrectAnswerText(q);
            const isCorrect = isCorrectAnswer(userAnswer, q);
            const questionMarks = 1;
            const earnedMarks = isCorrect ? questionMarks : 0;

            return (
              <div key={i} className={`rounded-3xl border-l-4 ${isCorrect ? "border-emerald-400 bg-slate-900/90" : "border-rose-400 bg-slate-900/90"} border border-white/10 p-6 shadow-card`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Q{i + 1}. {q.question || q.text || "Question text not available"}</h2>
                    <p className="mt-2 text-slate-400 text-sm">Type: {(q.type || "unknown").toString().toUpperCase()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isCorrect ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>
                    {isCorrect ? "Correct" : "Incorrect"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl bg-slate-950 p-4 border border-slate-800 text-slate-300">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Your answer</p>
                    <p className="mt-2 text-slate-100">{userAnswerText}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950 p-4 border border-slate-800 text-slate-300">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Correct answer</p>
                    <p className="mt-2 text-slate-100">{correctAnswer}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950 p-4 border border-slate-800 text-slate-300">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Marks</p>
                    <p className="mt-2 text-slate-100">{earnedMarks} / {questionMarks}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
