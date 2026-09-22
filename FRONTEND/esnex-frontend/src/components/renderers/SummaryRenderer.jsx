import React, { useRef, useEffect } from 'react';
import API from '../../api/axios';
import { useTheme } from '../../context/ThemeContext';

export default function SummaryRenderer({ groups = [], answers = {}, onAnswerChange, attemptId, partName }) {
  const { isDark } = useTheme();
  const timers = useRef({});
  const cardClass = isDark ? 'bg-slate-900 text-slate-100 border border-slate-700' : 'bg-white text-slate-950 border border-slate-200';
  const sectionTitleClass = isDark ? 'mb-2 text-sm text-slate-300 font-semibold' : 'mb-2 text-sm text-gray-600 font-semibold';
  const instructionClass = isDark ? 'mb-4 text-slate-400' : 'mb-4 text-gray-700';
  const passageCardClass = isDark ? 'mb-4 border-l-4 border-green-400 bg-slate-800/70 p-4 rounded' : 'mb-4 border-l-4 border-green-600 bg-green-50 p-4 rounded';
  const passageTextClass = isDark ? 'text-lg leading-relaxed text-slate-100' : 'text-lg leading-relaxed text-gray-800';
  const textareaClass = isDark ? 'w-full border border-slate-700 rounded p-3 min-h-[200px] bg-slate-950 text-slate-100' : 'w-full border border-slate-300 rounded p-3 min-h-[200px] bg-white text-slate-950';

  const autoSave = async ({ groupIndex, questionId, value }) => {
    try {
      await API.post(`/assessments/${attemptId}/answer`, {
        answer: { studentAnswer: value, questionId },
        questionIndex: groupIndex,
        partName,
      });
    } catch (err) {
      console.error('Auto-save failed', err?.response?.data || err.message || err);
    }
  };

  const scheduleAutoSave = (groupIndex, questionId, value) => {
    if (timers.current[questionId]) clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(() => {
      autoSave({ groupIndex, questionId, value });
    }, 800);
  };

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi} className={`p-6 shadow rounded ${cardClass}`}>
          {(group.section_title || group.sectionName || group.title) && (
            <div className={sectionTitleClass}>
              {group.section_title || group.sectionName || group.title}
            </div>
          )}
          {group.instruction && <div className={instructionClass}>{group.instruction}</div>}

          <div className={passageCardClass}>
            {Array.isArray(group.passage) ? (
              group.passage.map((p, idx) => (
                <p key={idx} className={passageTextClass}>{p.text}</p>
              ))
            ) : (
              <p className={passageTextClass}>{group.passage || group.text}</p>
            )}
          </div>

          <div className="space-y-4">
            {(
              Array.isArray(group.questions) && group.questions.length > 0
                ? group.questions
                : Array.isArray(group.summary?.questions) && group.summary.questions.length > 0
                  ? group.summary.questions
                  : [group]
            ).map((q, qi) => {
              const qid = q.questionId || q.id || `g${gi}_q${qi}`;
              return (
                <div key={qid}>
                  <div className="mb-2 font-semibold">{`${qi + 1}. ${q.question || q.text || q.prompt}`}</div>
                  <textarea
                    data-question-id={qid}
                    className="w-full border rounded p-3 min-h-[200px] text-gray-800"
                    value={answers[qid] || ''}
                    onChange={(e) => {
                      onAnswerChange(qid, e.target.value);
                      scheduleAutoSave(gi, qid, e.target.value);
                    }}
                    onBlur={(e) => autoSave({ groupIndex: gi, questionId: qid, value: e.target.value })}
                    placeholder="Write your summary here"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
