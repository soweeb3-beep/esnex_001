const fs = require('fs');
const text = fs.readFileSync('src/pages/UnifiedAssessment.jsx', 'utf8');
const lines = text.split(/\r?\n/);
const snippet = lines.slice(1038, 1155).map((line, idx) => `${1039 + idx}: ${line}`);
console.log(snippet.join('\n'));

let state = 'normal';
let stack = [];
for (let i = 0; i < snippet.length; i++) {
  const line = snippet[i].slice(snippet[i].indexOf(': ') + 2);
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const next = line[j + 1] || '';
    if (state === 'normal') {
      if (ch === '"') { state = 'double'; continue; }
      if (ch === "'") { state = 'single'; continue; }
      if (ch === '`') { state = 'template'; continue; }
      if (ch === '/' && next === '/') { state = 'line'; break; }
      if (ch === '/' && next === '*') { state = 'block'; j++; continue; }
      if ('({['.includes(ch)) stack.push(ch);
      else if (')}]'.includes(ch)) {
        const top = stack.pop();
        const map = { ')': '(', ']': '[', '}': '{' };
        if (map[ch] !== top) {
          console.log('Mismatch at line', 1039 + i, 'char', j, 'closing', ch, 'expected', map[ch], 'got', top);
          process.exit(1);
        }
      }
    } else if (state === 'double') {
      if (ch === '\\') { j++; continue; }
      if (ch === '"') state = 'normal';
    } else if (state === 'single') {
      if (ch === '\\') { j++; continue; }
      if (ch === "'") state = 'normal';
    } else if (state === 'template') {
      if (ch === '\\') { j++; continue; }
      if (ch === '`') state = 'normal';
      if (ch === '$' && next === '{') { stack.push('{'); j++; }
    } else if (state === 'line') {
      break;
    } else if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'normal'; j++; }
    }
  }
}
console.log('state', state, 'stack top 20', stack.slice(-20));
