const path = require('path');

/**
 * Build a normalized question file path for a given subject/part/section/subsection.
 * Returns a posix-style path (forward slashes) suitable for using with HTTP/static serve or fs.
 * Examples:
 *  - getQuestionPath('english','objective') => 'questions/english/objective/questions.json'
 *  - getQuestionPath('english','theory','essay','letter') => 'questions/english/theory/essay/letter/questions.json'
 */
function toSlug(s) {
  if (!s) return null;
  return String(s).trim().toLowerCase().replace(/\s+/g, '-');
}

function getQuestionPath(subject, part, section = null, subsection = null) {
  const segments = ['questions'];
  const subj = toSlug(subject);
  const prt = toSlug(part);
  if (!subj || !prt) throw new Error('subject and part are required');
  segments.push(subj, prt);
  if (section) segments.push(toSlug(section));
  if (subsection) segments.push(toSlug(subsection));
  segments.push('questions.json');

  // Use posix join to ensure forward slashes even on Windows
  return segments.join('/');
}

module.exports = { getQuestionPath };
