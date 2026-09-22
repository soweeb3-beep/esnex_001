import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function OralSelection() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl">
        <h2 className="text-2xl font-semibold mb-4">Select Oral Assessment Type</h2>
        <p className="text-sm text-slate-400 mb-6">Choose the candidate type to start the oral assessment.</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl p-6 bg-slate-800 border border-slate-700">
            <h3 className="font-semibold text-lg">WASSCE Candidate</h3>
            <ul className="mt-3 text-sm text-slate-300 list-disc list-inside space-y-1">
              <li>Audio-based oral test</li>
              <li>Audio auto-starts</li>
              <li>40-minute timer</li>
              <li>60 questions (locked seeking)</li>
              <li>Answers recorded while listening</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigate(`/assessment/${assessmentId}/oral/wassce`)}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4"
              >
                Select WASSCE
              </button>
            </div>
          </div>

          <div className="rounded-xl p-6 bg-slate-800 border border-slate-700">
            <h3 className="font-semibold text-lg">Private Candidate</h3>
            <ul className="mt-3 text-sm text-slate-300 list-disc list-inside space-y-1">
              <li>No audio</li>
              <li>Questions displayed directly</li>
              <li>Same answering interface</li>
              <li>Uses oral question bank without audio</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigate(`/assessment/${assessmentId}/oral/private`)}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4"
              >
                Select Private
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-400">
          <p>When you click an option, the oral flow will start and your answers will be auto-saved periodically.</p>
        </div>
      </div>
    </div>
  );
}
