function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const minLen = Math.min(a.length, b.length);
  // assume same dims
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] || 0) * (b[i] || 0);
    na += (a[i] || 0) * (a[i] || 0);
    nb += (b[i] || 0) * (b[i] || 0);
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalizeTextTokens(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function tokenOverlapSimilarity(a = '', b = '') {
  const A = new Set(normalizeTextTokens(a));
  const B = new Set(normalizeTextTokens(b));
  if (A.size === 0 && B.size === 0) return 0;
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

function bestStringSimilarity(studentAnswer, acceptedAnswers = []) {
  let best = 0;
  for (const a of acceptedAnswers) {
    const sim = tokenOverlapSimilarity(studentAnswer, a);
    if (sim > best) best = sim;
  }
  return best;
}

module.exports = { cosineSimilarity, tokenOverlapSimilarity, bestStringSimilarity };
