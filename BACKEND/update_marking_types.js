#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const QUESTION_BASE = path.join(__dirname, 'questions', 'english', 'theory');

/**
 * Update comprehension and summary questions to add markingType and marks
 */
function updateAnswerKeyQuestions() {
  console.log('📝 Updating answer-key questions (comprehension, summary)...\n');

  const comprehensionPath = path.join(QUESTION_BASE, 'comprehension', 'questions.json');
  const summaryPath = path.join(QUESTION_BASE, 'summary', 'questions.json');

  [comprehensionPath, summaryPath].forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fileName = path.basename(path.dirname(filePath));

    // For each question, add markingType and marks
    if (data.questions && Array.isArray(data.questions)) {
      let totalMarksAssigned = 0;
      
      data.questions.forEach((q, idx) => {
        // Skip grouping questions (those without 'question' field)
        if (!q.question && q.instruction) {
          return;
        }

        // Add markingType
        q.markingType = 'answer_key';

        // Rename answer to modelAnswer if not already done
        if (q.answer && !q.modelAnswer) {
          q.modelAnswer = q.answer;
        }

        // Assign marks if not present
        if (!q.marks) {
          // Default 3-4 marks per question for comprehension/summary
          q.marks = (q.id && q.id.includes('q8')) ? 2 : 3;
        }

        totalMarksAssigned += q.marks;
      });

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ ${fileName}: Updated with markingType='answer_key', total marks: ${totalMarksAssigned}`);
    }
  });
}

/**
 * Update essay questions to add markingType and standardize markingGuide
 */
function updateInstructionBasedQuestions() {
  console.log('\n📝 Updating instruction-based questions (essays)...\n');

  const essayTypesPath = path.join(QUESTION_BASE, 'essay');
  
  if (!fs.existsSync(essayTypesPath)) {
    console.warn(`⚠️  Essay directory not found: ${essayTypesPath}`);
    return;
  }

  // Get essay type directories (letter, article, debate, story)
  const essayTypes = fs.readdirSync(essayTypesPath).filter(f => 
    fs.statSync(path.join(essayTypesPath, f)).isDirectory()
  );

  essayTypes.forEach(essayType => {
    const questionsPath = path.join(essayTypesPath, essayType, 'questions.json');

    if (!fs.existsSync(questionsPath)) {
      console.warn(`⚠️  File not found: ${questionsPath}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

    // The question might be nested under 'question' object or at root
    const targetQuestion = data.question || data;

    if (targetQuestion) {
      // Add markingType
      targetQuestion.markingType = 'instruction';

      // Extract or create marking guide from existing marking_scheme/marking_criteria
      if (!targetQuestion.markingGuide) {
        const scheme = targetQuestion.marking_scheme || targetQuestion.marking_criteria || {};
        targetQuestion.markingGuide = {
          categories: scheme,
          totalMarks: targetQuestion.total_marks || Object.values(scheme).reduce((a, b) => a + b, 0),
          description: 'Evaluate based on content quality, organization, expression, grammar, and format adherence.'
        };
      }

      // Ensure totalMarks is set
      if (!targetQuestion.totalMarks) {
        targetQuestion.totalMarks = targetQuestion.total_marks;
      }
    }

    // Write back
    fs.writeFileSync(questionsPath, JSON.stringify(data, null, 2));
    console.log(`✅ ${essayType}: Updated with markingType='instruction', totalMarks=${targetQuestion.totalMarks || targetQuestion.total_marks}`);
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Starting theory question marking type update...\n');
  console.log(`Base path: ${QUESTION_BASE}\n`);

  try {
    updateAnswerKeyQuestions();
    updateInstructionBasedQuestions();

    console.log('\n✨ All theory questions updated successfully!');
    console.log('\nSummary:');
    console.log('  ✓ Comprehension questions: markingType=answer_key');
    console.log('  ✓ Summary questions: markingType=answer_key');
    console.log('  ✓ Essay questions: markingType=instruction');
    console.log('  ✓ All questions now have marking metadata\n');
  } catch (error) {
    console.error('❌ Error during update:', error.message);
    process.exit(1);
  }
}

main();
