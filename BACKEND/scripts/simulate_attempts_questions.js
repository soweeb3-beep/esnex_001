const path = require('path');
const { loadSectionQuestions } = require('../utils/assessmentEngine');

async function run() {
  const subject = process.argv[2] || 'maths';
  const partType = process.argv[3] || 'objective';
  const questionCount = Number(process.argv[4] || 10);
  const attempts = Number(process.argv[5] || 5);

  const section = {
    key: 'questions',
    name: 'Questions',
    files: [],
    questionCount,
    bankPath: '',
  };

  console.log(`Simulating ${attempts} attempts for subject=${subject}, partType=${partType}, questionCount=${questionCount}\n`);

  for (let i = 0; i < attempts; i++) {
    try {
      const questions = await loadSectionQuestions(subject, partType, section, new Set(), { previousAttemptsCount: i });
      const ids = (questions || []).map(q => q.questionId || q.id || q._id || q.text?.slice(0,30));
      console.log(`Attempt ${i + 1} (offset ${i}): ${ids.length} questions`);
      console.log(ids.join('\n'));
      console.log('---\n');
    } catch (err) {
      console.error('Error on attempt', i + 1, err && err.message);
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });
