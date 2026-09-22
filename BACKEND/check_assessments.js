const Assessment = require('./models/Assessment').Assessment;

async function checkAssessments() {
  try {
    const assessments = await Assessment.find({type: 'global'});
    console.log('Found', assessments.length, 'global assessments');

    assessments.forEach((a, i) => {
      console.log(`Assessment ${i+1}:`, a.name, '- Parts:', a.parts?.length || 0);
      if (a.parts?.length > 0) {
        a.parts.forEach((p, j) => {
          console.log(`  Part ${String.fromCharCode(65+j)}: ${p.type}, Sections: ${p.sections?.length || 0}`);
          p.sections?.forEach((s, k) => {
            console.log(`    Section ${k+1}: ${s.name}, Questions: ${s.questionCount}, Instructions: ${s.instructions?.substring(0,50) || 'none'}`);
          });
        });
      }
    });
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

checkAssessments();