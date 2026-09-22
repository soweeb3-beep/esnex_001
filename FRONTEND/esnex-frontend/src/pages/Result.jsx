import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

export default function Result() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const res = await API.get("/quizzes/results");
        setResults(res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load results");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Results</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Your latest quiz performance</h1>
          <p className="max-w-2xl text-slate-400">
            Review your exam scores, completion status, and drill into attempts for detailed feedback.
          </p>
        </div>

        {loading && <p className="text-slate-400">Loading results...</p>}
        {error && <p className="text-rose-400">{error}</p>}

        {!loading && results.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-card">
            <p className="text-slate-400">You have not completed any quizzes yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {results.map((result) => (
            <div key={result._id} className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{result.quiz?.title || "Untitled Quiz"}</h2>
                  <p className="text-slate-400">Score: {result.score} / {result.total}</p>
                  <p className="text-sm text-slate-500">{new Date(result.submittedAt).toLocaleString()}</p>
                </div>
                <Link
                  to={`/attempt/${result._id}`}
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Review Attempt
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
