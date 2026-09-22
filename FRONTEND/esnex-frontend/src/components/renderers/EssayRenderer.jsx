import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function EssayRenderer({ questions = [], answers = {}, onAnswerChange }) {
  const { isDark } = useTheme();
  const cardClass = isDark ? 'bg-slate-900 text-slate-100 border border-slate-700' : 'bg-white text-slate-950 border border-slate-200';
  const textareaClass = isDark ? 'w-full border border-slate-700 rounded p-3 min-h-[240px] bg-slate-950 text-slate-100' : 'w-full border border-slate-300 rounded p-3 min-h-[240px] bg-white text-slate-950';

  return (
    <div className="space-y-6">
      {questions.map((q, idx) => {
        const qid = q.questionId || q.id || `q_${idx}`;
        return (
          <div key={qid} className={`p-6 shadow rounded ${cardClass}`}>
            <h3 className="font-bold mb-2">{idx + 1}. {q.text || q.question || q.prompt}</h3>
            <textarea
              data-question-id={qid}
              className={textareaClass}
              value={answers[qid] || ''}
              onChange={(e) => onAnswerChange(qid, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
