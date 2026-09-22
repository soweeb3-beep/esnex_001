const fs = require('fs');
const path = require('path');
const folder = path.join(__dirname, '..', 'questions', 'english', 'objective');
const files = fs.readdirSync(folder).filter(f => f.endsWith('.json'));
const idMap = new Map();
const perFileCounts = {};
for (const file of files) {
  const p = path.join(folder, file);
  const raw = fs.readFileSync(p, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { console.error('parse error', file, e); continue; }
  // flatten: if object with keys like section_1, take their arrays
  let items = [];
  if (Array.isArray(parsed)) items = parsed;
  else if (typeof parsed === 'object') {
    for (const v of Object.values(parsed)) {
      if (Array.isArray(v)) items = items.concat(v);
    }
  }
  perFileCounts[file] = items.length;
  for (const q of items) {
    const id = q.questionId || q.id || q.question || JSON.stringify(q);
    if (!idMap.has(id)) idMap.set(id, []);
    idMap.get(id).push(file);
  }
}
const duplicates = [];
for (const [id, occ] of idMap.entries()) if (occ.length > 1) duplicates.push({id, files: occ});
console.log('files scanned:', files.length);
console.log('per-file counts:', perFileCounts);
console.log('unique question ids:', idMap.size);
console.log('duplicate ids count:', duplicates.length);
if (duplicates.length) console.log('duplicates sample (first 50):', JSON.stringify(duplicates.slice(0,50), null, 2));
