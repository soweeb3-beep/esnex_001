const fs = require('fs');
const path = require('path');
const questionsDir = path.join(__dirname, 'questions');
const countJsonArray = (file) => {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    return 0;
  }
};
const listDir = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const walk = (dir, prefix = '') => {
  const results = [];
  for (const entry of listDir(dir)) {
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) results.push(...walk(full, rel));
    else if (entry.toLowerCase().endsWith('.json')) results.push({ rel, full });
  }
  return results;
};
const subjects = listDir(questionsDir).filter((n) => fs.statSync(path.join(questionsDir, n)).isDirectory());
console.log('Subjects found:', subjects.sort().join(', '));
for (const subject of subjects.sort()) {
  const subjectDir = path.join(questionsDir, subject);
  const files = walk(subjectDir);
  console.log(`\n=== ${subject} ===`);
  for (const file of files.sort((a,b)=>a.rel.localeCompare(b.rel))) {
    console.log(file.rel, countJsonArray(file.full));
  }
}
