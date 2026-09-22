import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OralAudioPlayer from '../components/OralAudioPlayer';
import API from '../api/axios';

export default function OralWassce() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl">
        <h2 className="text-2xl font-semibold mb-2">WASSCE Oral Preview</h2>
        <p className="text-sm text-slate-400 mb-4">This flow will play the official WASSCE audio and present 60 questions over 40 minutes. Audio seeking will be locked.</p>

        <div className="space-y-4 mt-6">
          <OralAudioPlayer
            audioSrc={`/audio/english/oral/wassce/audio.mp3`}
            autoPlay={true}
            onBlocked={() => console.warn('Autoplay blocked')}
            onEnded={() => console.log('Audio ended')}
          />

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4"
            >
              Back
            </button>
            <button
              onClick={async () => {
                // create or resume an oral attempt, then navigate into the oral run page
                try {
                  const res = await API.post(`/assessments/${assessmentId}/oral/start`, { oralType: 'wassce' });
                  const attemptId = res.data?.attemptId || res.data?.id;
                  navigate(`/assessment/${assessmentId}/oral/run`, { state: { attemptId, oralType: 'wassce' } });
                } catch (err) {
                  // fallback: navigate without attemptId
                  navigate(`/assessment/${assessmentId}/oral/run`, { state: { attemptId: null, oralType: 'wassce' } });
                }
              }}
              className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4"
            >
              Enter Oral Test Interface
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
