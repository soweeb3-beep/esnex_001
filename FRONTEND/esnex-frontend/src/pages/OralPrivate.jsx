import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../api/axios';

export default function OralPrivate() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl">
        <h2 className="text-2xl font-semibold mb-2">Private Oral Preview</h2>
        <p className="text-sm text-slate-400 mb-4">This flow shows questions directly without audio. Timer and autosave will apply as for WASSCE.</p>

        <div className="space-y-4 mt-6">
          <div className="rounded-lg p-4 bg-slate-800 border border-slate-700">
            <p className="text-sm text-slate-300">Duration: <strong>40 minutes</strong></p>
            <p className="text-sm text-slate-300">Questions: <strong>60</strong></p>
            <p className="text-sm text-slate-300">Audio: <strong>None</strong></p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4"
            >
              Back
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await API.post(`/assessments/${assessmentId}/oral/start`, { oralType: 'private' });
                  const attemptId = res.data?.attemptId || res.data?.id;
                  navigate(`/assessment/${assessmentId}/oral/run`, { state: { attemptId, oralType: 'private' } });
                } catch (err) {
                  navigate(`/assessment/${assessmentId}/oral/run`, { state: { attemptId: null, oralType: 'private' } });
                }
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4"
            >
              Start Private Oral
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
