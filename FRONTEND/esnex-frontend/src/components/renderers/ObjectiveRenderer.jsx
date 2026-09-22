import React from 'react';

import { useTheme } from '../../context/ThemeContext';

export default function ObjectiveRenderer({ questions = [], answers = {}, onAnswerChange }) {
  const { isDark } = useTheme();
  const cardClass = isDark ? 'bg-slate-900 text-slate-100 border border-slate-700' : 'bg-white text-slate-950 border border-slate-200';
  const textareaClass = isDark ? 'w-full border border-slate-700 rounded p-2 mt-2 bg-slate-950 text-slate-100' : 'w-full border border-slate-300 rounded p-2 mt-2 bg-white text-slate-950';
  const labelClass = isDark ? 'block text-slate-200' : 'block text-slate-900';

  const getQuestionOptions = (q) => {
    if (!q?.options) return [];
    if (Array.isArray(q.options)) return q.options;
    if (typeof q.options === 'object') return Object.values(q.options).filter((opt) => opt !== undefined && opt !== null);
    return [];
  };

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const qid = q.questionId || q.id || `q_${idx}`;
        const options = getQuestionOptions(q);
        return (
          <div key={qid} className={`p-4 shadow rounded ${cardClass}`}>
            <h3 className="font-bold mb-2">{idx + 1}. {q.text || q.question || q.prompt}</h3>
            <div className="space-y-2">
              {options.map((opt, oidx) => (
                <label key={oidx} className={labelClass}>
                  <input
                    type="radio"
                    name={`q-${qid}`}
                    checked={answers[qid] === opt}
                    onChange={() => onAnswerChange(qid, opt)}
                  />
                  <span className="ml-2">{opt}</span>
                </label>
              ))}
              {options.length === 0 && (
                <textarea
                  className={textareaClass}
                  value={answers[qid] || ''}
                  onChange={(e) => onAnswerChange(qid, e.target.value)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
