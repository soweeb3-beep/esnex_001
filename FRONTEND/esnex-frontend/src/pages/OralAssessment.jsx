import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import OralAudioPlayer from '../components/OralAudioPlayer';
import API from '../api/axios';

const TOTAL_QUESTIONS = 60;
const DURATION_SECONDS = 40 * 60; // 40 minutes

function formatTimeLeft(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function OralAssessment() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [saveStatus, setSaveStatus] = useState('Not saved');
  const timerRef = useRef(null);

  const location = useLocation();

  useEffect(() => {
    // determine oralType from navigation state (wassce/private)
    const oralType = location?.state?.oralType || 'wassce';
    const qPath = oralType === 'private' ? `/questions/english/oral/private/questions.json` : `/questions/english/oral/wassce/questions.json`;
    API.get(qPath).then(r => setQuestions(r.data || [])).catch(() => setQuestions(Array.from({length: TOTAL_QUESTIONS}, (_,i)=>({id:i+1, text:`Question ${i+1}`}))));

    // if an attemptId was provided in navigation state, resume it; otherwise create one
    const providedAttempt = location?.state?.attemptId;
    if (providedAttempt) {
      setAttemptId(providedAttempt);
      if (location.state.timeLeft || typeof location.state.timeLeft === 'number') setTimeLeft(location.state.timeLeft);
      return;
    }

    const startAttempt = async () => {
      try {
        const res = await API.post(`/assessments/${assessmentId}/oral/start`, { oralType });
        setAttemptId(res.data.attemptId || res.data.id || (`local-${Date.now()}`));
        if (res.data.timeLeft || typeof res.data.timeLeft === 'number') setTimeLeft(res.data.timeLeft);
      } catch (err) {
        // fallback to local attempt id
        setAttemptId(`local-${Date.now()}`);
      }
    };
    startAttempt();
  }, [assessmentId, location]);

  useEffect(() => {
    // timer tick
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    // persist timeLeft occasionally
    const iv = setInterval(() => {
      if (!attemptId) return;
      API.patch(`/assessments/${attemptId}/timeleft`, { timeLeft }).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, [attemptId, timeLeft]);

  const handleSelect = async (opt) => {
    const q = questions[current] || { id: current+1 };
    const newAnswers = { ...answers, [current]: opt };
    setAnswers(newAnswers);
    setSaveStatus('Saving...');

    if (!attemptId) {
      setSaveStatus('Saved (local)');
      return;
    }

    try {
      await API.post(`/assessments/${attemptId}/answer`, {
        questionIndex: current,
        questionId: q.id,
        answer: opt,
      });
      setSaveStatus(`✓ Saved`);
    } catch (err) {
      setSaveStatus('Save failed');
    }
  };

  const goTo = (idx) => setCurrent(Math.max(0, Math.min(TOTAL_QUESTIONS - 1, idx)));

  const handleAutoSubmit = async () => {
    setSaveStatus('Auto-submitting...');
    if (!attemptId) {
      setSaveStatus('Submitted (local)');
      return;
    }
    try {
      await API.post(`/assessments/${attemptId}/submit`, { answers, timeLeft: 0 });
      setSaveStatus('Submitted');
      navigate(`/attempt/${attemptId}`);
    } catch (err) {
      setSaveStatus('Submit failed');
    }
  };

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  const currentQuestion = questions[current] || { id: current + 1, text: `Question ${current + 1}`, options: ['A','B','C','D'] };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.6fr_0.9fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-400">Question {current + 1} of {TOTAL_QUESTIONS}</div>
              <div className="text-sm text-slate-400">Part: Oral (WASSCE)</div>
            </div>

            <div className="space-y-4">
              <OralAudioPlayer audioSrc={`/audio/english/oral/wassce/audio.mp3`} autoPlay={true} />

              <div className="mt-2">
                <h3 className="text-lg font-semibold">{currentQuestion.text}</h3>
              </div>

              <div className="mt-4 space-y-3">
                {(currentQuestion.options || ['A','B','C','D']).map((opt, i) => (
                  <label key={i} className={`block p-3 rounded-lg border ${answers[current] === opt ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800/50'}`}>
                    <input type="radio" name={`q-${current}`} checked={answers[current] === opt} onChange={() => handleSelect(opt)} className="mr-3" />
                    <span className="text-slate-200">{typeof opt === 'string' && opt.length <= 2 ? `${opt}. Option ${opt}` : opt}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <button onClick={() => goTo(current - 1)} className="rounded bg-slate-700 px-4 py-2">Previous</button>
                <button onClick={() => goTo(current + 1)} className="rounded bg-sky-600 px-4 py-2">Next</button>
                <div className="ml-auto text-sm text-slate-400">Save: {saveStatus}</div>
              </div>
            </div>
          </div>
        </div>

        <aside className="sticky top-6 self-start">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 w-72">
            <div className="text-sm text-slate-400">Time Left</div>
            <div className="text-2xl font-mono font-semibold text-white my-3">{formatTimeLeft(timeLeft)}</div>

            <div className="text-sm text-slate-400">Answered</div>
            <div className="text-lg font-semibold text-white my-2">{answeredCount}/{TOTAL_QUESTIONS}</div>

            <div className="text-sm text-slate-400">Progress</div>
            <div className="w-full h-3 bg-slate-700 rounded overflow-hidden mt-2 mb-3">
              <div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} />
            </div>

            <div className="text-sm text-slate-400 mb-2">Navigator</div>
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, idx) => {
                const cls = idx === current ? 'bg-sky-500 text-slate-900' : (answers[idx] ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-300');
                return (
                  <button key={idx} onClick={() => goTo(idx)} className={`rounded h-8 text-xs ${cls}`}>{idx + 1}</button>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-slate-400">Autosave: {saveStatus}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
