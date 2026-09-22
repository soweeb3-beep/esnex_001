import React, { useRef, useEffect, useState } from 'react';

function formatTime(sec = 0) {
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function OralAudioPlayer({ audioSrc, autoPlay = true, onBlocked, onEnded }) {
  const audioRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      setDuration(audio.duration || 0);
    };

    const handleTime = () => {
      // update state but remember last allowed time to prevent seeking
      setCurrent(audio.currentTime);
      lastTimeRef.current = audio.currentTime;
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleSeek = () => {
      // If user tried to seek, revert to lastTimeRef
      if (Math.abs(audio.currentTime - lastTimeRef.current) > 0.5) {
        audio.currentTime = lastTimeRef.current;
      }
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleSeek);
    audio.addEventListener('ended', onEnded || (() => {}));

    // try autoplay
    if (autoPlay) {
      const p = audio.play();
      if (p && p.catch) {
        p.catch(() => {
          setBlocked(true);
          onBlocked && onBlocked();
        });
      }
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleSeek);
      audio.removeEventListener('ended', onEnded || (() => {}));
    };
  }, [audioSrc, autoPlay, onBlocked, onEnded]);

  const handleForceStart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  return (
    <div className="rounded-lg p-4 bg-slate-800 border border-slate-700">
      <audio ref={audioRef} src={audioSrc || undefined} preload="auto" />

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-300">Audio Playback</div>
        <div className="text-xs text-slate-400">{formatTime(current)} / {formatTime(duration)}</div>
      </div>

      <div className="w-full h-3 bg-slate-700 rounded overflow-hidden mb-2">
        <div className="h-full bg-amber-400" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (playing) audio.pause(); else audio.play().catch(() => setBlocked(true));
          }}
          className="rounded px-3 py-1 bg-slate-700 text-sm text-slate-100"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <div className="text-sm text-slate-300">Seeking is locked during WASSCE audio</div>
      </div>

      {blocked && (
        <div className="mt-3 text-sm text-amber-200">
          Browser blocked autoplay. Click to start audio.
          <div className="mt-2">
            <button onClick={handleForceStart} className="rounded bg-amber-500 px-3 py-1 font-semibold">Start audio</button>
          </div>
        </div>
      )}
    </div>
  );
}
