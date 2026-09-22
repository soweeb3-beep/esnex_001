const { callProvider, generateModelAnswer, getEmbedding } = require('./aiProvider');
const { cosineSimilarity, tokenOverlapSimilarity, bestStringSimilarity } = require('../utils/semanticMatcher');

// Provider-agnostic marking service. Uses AI provider configured via environment:
// - AI_PROVIDER=gemini (uses GEMINI_API_KEY / GEMINI_MODEL)
// - AI_PROVIDER=openai (uses OPENAI_API_KEY / OPENAI_MODEL)

/**
 * Build a prompt instructing the model to return a strict JSON evaluation.
 */
function buildPrompt({ questionText, rubric, markingCriteria, expectedPoints, minimumWordCount, modelAnswer, studentAnswer, totalMarks }) {
  const rubricText = rubric && typeof rubric === 'string' ? rubric : (rubric ? JSON.stringify(rubric) : 'No rubric provided');
  const criteriaText = markingCriteria && typeof markingCriteria === 'string' ? markingCriteria : (markingCriteria ? JSON.stringify(markingCriteria) : 'No marking criteria provided');

  return `You are an experienced exam marker. Evaluate the student's answer against the question, rubric, marking criteria, and model answer (if provided).

Respond ONLY with valid JSON (no surrounding text) following this schema:
{
  "score": <number between 0 and TOTAL_MARKS>,
  "breakdown": {
    "relevance": <0-1>,
    "completeness": <0-1>,
    "accuracy": <0-1>,
    "clarity": <0-1>,
    "grammar": <0-1>
  },
  "feedback": "Concise feedback to student (1-3 short paragraphs)",
  "strengths": ["short list of strengths"],
  "weaknesses": ["short list of weaknesses"],
  "grammarCorrections": "Optional short grammar corrections or suggestions.",
  "missingPoints": ["key points missing if any"],
  "suggestions": "Practical suggestions to improve the answer"
}

Replace TOTAL_MARKS in the JSON output with the numeric value ${totalMarks} for the allowed maximum score. Ensure numeric fields are numbers (not strings).
Rubric: ${rubricText}
Marking Criteria: ${criteriaText}
Expected Points: ${expectedPoints ?? 'N/A'}
Minimum Word Count: ${minimumWordCount ?? 'N/A'}

QUESTION:
${questionText}

MODEL_ANSWER (if provided):
${modelAnswer || 'N/A'}

STUDENT_ANSWER:
${studentAnswer}

Score proportionally and conservatively. Output only JSON.`;
}

// Build a prompt specifically when a per-category rubric is provided (e.g., Essay categories)
function buildPromptForRubric({ questionText, rubricObject, markingCriteria, expectedPoints, minimumWordCount, modelAnswer, studentAnswer }) {
  // rubricObject is expected to be an object like { Content: 20, Organization: 10, Expression: 10, MechanicalAccuracy: 10 }
  const categories = Object.keys(rubricObject || {});
  const total = Object.values(rubricObject || {}).reduce((s, v) => s + Number(v || 0), 0) || 0;

  return `You are an experienced WAEC-style exam marker. The question must be scored by category according to the rubric below. Evaluate the student's answer under each category and award numeric marks (integers or decimals) up to the category maximum.

Respond ONLY with valid JSON (no surrounding text) using this schema:
{
  "categoryScores": { ${categories.map(c => `"${c}": <number 0-${rubricObject[c]}>`).join(', ')} },
  "categoryFeedback": { ${categories.map(c => `"${c}": "short feedback for this category"`).join(', ')} },
  "totalScore": <number 0-${total}>,
  "strengths": ["list of strengths across categories"],
  "weaknesses": ["list of weaknesses across categories"],
  "grammarCorrections": "grammar suggestions",
  "missingPoints": ["key missing points if any"],
  "suggestions": "Overall improvement suggestions"
}

Rubric (category: max marks): ${JSON.stringify(rubricObject)}
Marking Criteria: ${markingCriteria || 'N/A'}
Minimum Word Count: ${minimumWordCount || 'N/A'}

QUESTION:
${questionText}

MODEL_ANSWER (if provided):
${modelAnswer || 'N/A'}

STUDENT_ANSWER:
${studentAnswer}

Score conservatively and ensure the sum of categoryScores equals totalScore. Output only JSON.`;
}

// Local heuristic grader used when OpenAI key not present.
function simpleLocalGrader({ questionText, rubric, modelAnswer, studentAnswer, totalMarks = 5 }) {
  const normalize = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const studentWords = new Set(normalize(studentAnswer));
  const modelWords = new Set(normalize(modelAnswer || questionText || ''));

  // Jaccard-like overlap
  const intersection = [...studentWords].filter(w => modelWords.has(w)).length;
  const union = new Set([...studentWords, ...modelWords]).size || 1;
  const overlap = intersection / union;

  // length heuristic (penalize extremely short responses)
  const len = (studentAnswer || '').trim().split(/\s+/).filter(Boolean).length;
  const lengthScore = Math.min(1, len / 50); // 50 words ~ full credit for length

  // grammar heuristic: simple punctuation density (very naive)
  const punctCount = (studentAnswer || '').replace(/[^.,;:!?]/g, '').length;
  const grammarScore = Math.min(1, punctCount / Math.max(1, Math.min(len, 20)));

  // Combine heuristics conservatively
  // If overlap is zero but the student provided some content, give a stronger baseline
  const baselineFromLength = Math.min(0.5, len / 300); // more generous for longer short answers
  const relevance = overlap > 0 ? overlap : Math.max(0.2, baselineFromLength);
  const completeness = Math.max(0, Math.min(1, (overlap * 0.7) + (lengthScore * 0.3)));
  const accuracy = overlap; // fallback
  const clarity = Math.max(0, Math.min(1, (lengthScore + grammarScore) / 2));
  const grammar = Math.max(0, Math.min(1, grammarScore));

  // Combined proportion (0-1) before scaling to totalMarks
  const combinedProportion = Math.max(0, Math.min(1, ((relevance * 0.5) + (completeness * 0.3) + (clarity * 0.2))));
  const score = Math.round(totalMarks * combinedProportion);
  const minScore = len > 0 ? Math.min(Math.max(1, Math.round(totalMarks * 0.1)), totalMarks) : 0;
  const finalScore = Math.max(score, minScore);

  const report = {
    provider: 'local',
    score: finalScore,
    proportion: Number(combinedProportion.toFixed(3)),
    breakdown: {
      relevance: Number(relevance.toFixed(3)),
      completeness: Number(completeness.toFixed(3)),
      accuracy: Number(accuracy.toFixed(3)),
      clarity: Number(clarity.toFixed(3)),
      grammar: Number(grammar.toFixed(3)),
    },
    feedback: `Auto-graded using local heuristic. Overlap: ${(overlap * 100).toFixed(1)}%. Length: ${len} words.`,
    strengths: overlap > 0.2 ? ['Relevant points present'] : [],
    weaknesses: overlap <= 0.2 ? ['Missing key points or insufficient overlap with expected answer'] : [],
    grammarCorrections: '',
    missingPoints: [],
    suggestions: 'Expand on key points and include specific examples to improve completeness.'
  };

  return { report, rawResponse: { local: true } };
}

function safeParseJson(text) {
  try {
    // Some models may wrap JSON in backticks or ```
    const cleaned = text.replace(/^\s*```json\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // Try to extract first { ... } block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e) { /* fallthrough */ }
    }
    throw new Error('Failed to parse JSON from model response');
  }
}

/**
 * Evaluate a single answer using OpenAI and return structured report.
 * - questionText: string
 * - rubric: string or object
 * - modelAnswer: string|null
 * - studentAnswer: string
 * - totalMarks: number
 */
async function evaluateAnswer({ questionText, rubric, markingCriteria, expectedPoints, minimumWordCount, modelAnswer, studentAnswer, totalMarks = 5 }) {
  const effectiveModelAnswer = modelAnswer || null;
  let finalModelAnswer = effectiveModelAnswer;

  // If no model answer exists, try to generate one using configured AI provider
  if (!finalModelAnswer) {
    try {
      finalModelAnswer = await generateModelAnswer({ questionText, rubric });
    } catch (genErr) {
      console.warn('Model answer generation failed, continuing without generated model answer:', genErr.message || genErr);
      finalModelAnswer = null;
    }
  }

  // Try calling the configured AI provider. If that fails, fallback to local heuristic.
  try {
    // Ensure we always have a rubricObject for per-category marking.
    // If rubric is provided as an object use it; otherwise build a sensible default
    // using common WAEC-style categories so downstream always receives `categoryScores`.
    let rubricObject = null;
    if (rubric && typeof rubric === 'object' && !Array.isArray(rubric) && Object.keys(rubric).length > 0) {
      rubricObject = rubric;
    } else {
      const tm = Number(totalMarks) || 5;
      // Default distribution: Content 50%, Organization 20%, Expression 20%, MechanicalAccuracy 10%
      const content = Math.max(1, Math.round(tm * 0.5));
      const organization = Math.max(0, Math.round(tm * 0.2));
      const expression = Math.max(0, Math.round(tm * 0.2));
      const mechanical = Math.max(0, tm - (content + organization + expression));
      rubricObject = { Content: content, Organization: organization, Expression: expression, MechanicalAccuracy: mechanical };
    }

    // Use rubricObject for provider prompting to request per-category scores
    try {
      const prompt = buildPromptForRubric({ questionText, rubricObject, markingCriteria, expectedPoints, minimumWordCount, modelAnswer: finalModelAnswer, studentAnswer });
      console.log('AI rubric prompt preview:', String(prompt).slice(0,300));
      const { raw, content, provider } = await callProvider({ prompt, model: null, maxTokens: 1000 });
      console.log('AI raw response (truncated):', typeof raw === 'string' ? raw.slice(0,400) : JSON.stringify(raw).slice(0,400));
      const parsed = safeParseJson(String(content || ''));

      // Normalise category scores and compute total against rubricObject
      const categoryScores = parsed.categoryScores || {};
      let computedTotal = 0;
      Object.keys(rubricObject).forEach((cat) => {
        const max = Number(rubricObject[cat] || 0);
        let val = Number(categoryScores[cat]);
        if (!Number.isFinite(val)) val = 0;
        val = Math.max(0, Math.min(val, max));
        categoryScores[cat] = val;
        computedTotal += val;
      });

      parsed.totalScore = Number(parsed.totalScore) || computedTotal;
      parsed.totalScore = Math.max(0, Math.min(parsed.totalScore, Object.values(rubricObject).reduce((s, v) => s + Number(v || 0), 0)));
      parsed.categoryScores = categoryScores;
      parsed.categoryTotalMarks = rubricObject;
      parsed.rubric = rubricObject;
      parsed.rubricBreakdown = categoryScores;
      parsed.finalScore = parsed.totalScore;
      parsed.provider = provider || parsed.provider || 'ai';

      // Populate compatibility fields for older consumers
      parsed.score = parsed.totalScore;
      parsed.breakdown = parsed.breakdown || {};
      parsed.breakdown.relevance = parsed.breakdown.relevance || 0;
      parsed.breakdown.completeness = parsed.breakdown.completeness || 0;
      parsed.breakdown.accuracy = parsed.breakdown.accuracy || 0;
      parsed.breakdown.clarity = parsed.breakdown.clarity || 0;
      parsed.breakdown.grammar = parsed.breakdown.grammar || 0;

      if (finalModelAnswer && !modelAnswer) parsed.generatedModelAnswer = finalModelAnswer;
      return { report: parsed, rawResponse: raw };
    } catch (err) {
      // If provider fails, fall back to local grader that uses rubricObject
      console.warn('AI provider for rubric marking failed, falling back:', err.message || err);
      const fallback = simpleLocalGraderWithRubric({ questionText, rubric: rubricObject, modelAnswer: finalModelAnswer, studentAnswer });
      return { report: fallback.report, rawResponse: { local: true } };
    }

    const prompt = buildPrompt({
      questionText,
      rubric,
      markingCriteria,
      expectedPoints,
      minimumWordCount,
      modelAnswer: finalModelAnswer,
      studentAnswer,
      totalMarks,
    });
    console.log('AI prompt preview:', String(prompt).slice(0,300));
    const { raw, content } = await callProvider({ prompt, model: null, maxTokens: 800 });
    console.log('AI raw response (truncated):', typeof raw === 'string' ? raw.slice(0,400) : JSON.stringify(raw).slice(0,400));
    const parsed = safeParseJson(String(content || ''));

    // Normalize score to numeric and clamp
    if (typeof parsed.score !== 'number') parsed.score = Number(parsed.score) || 0;
    parsed.score = Math.max(0, Math.min(parsed.score, totalMarks));

    // Ensure breakdown exists
    parsed.breakdown = parsed.breakdown || {};
    ['relevance', 'completeness', 'accuracy', 'clarity', 'grammar'].forEach((k) => {
      if (typeof parsed.breakdown[k] !== 'number') parsed.breakdown[k] = 0;
      parsed.breakdown[k] = Math.max(0, Math.min(1, parsed.breakdown[k]));
    });

    if (finalModelAnswer && !modelAnswer) parsed.generatedModelAnswer = finalModelAnswer;

    return { report: parsed, rawResponse: raw };
  } catch (err) {
    console.warn('AI provider call failed, falling back to local heuristic:', err.message || err);
    // If rubric object provided, fallback needs to produce categoryScores
    if (rubric && typeof rubric === 'object' && Object.keys(rubric).length > 0) {
      const fallback = simpleLocalGraderWithRubric({ questionText, rubric, modelAnswer: finalModelAnswer, studentAnswer });
      return { report: fallback.report, rawResponse: { local: true } };
    }
    return simpleLocalGrader({ questionText, rubric, modelAnswer: finalModelAnswer, studentAnswer, totalMarks });
  }
}

// Local fallback grader that supports per-category rubric objects
function simpleLocalGraderWithRubric({ questionText, rubric, modelAnswer, studentAnswer, minimumWordCount = 450 }) {
  const overall = simpleLocalGrader({ questionText, modelAnswer, studentAnswer, totalMarks: 100 }).report;
  const proportion = typeof overall.proportion === 'number' ? overall.proportion : Math.max(0, Math.min(1, (overall.score || 0) / 100));

  const actualWordCount = (studentAnswer || '').trim().split(/\s+/).filter(Boolean).length;
  const categoryScores = {};
  let computedTotal = 0;

  Object.keys(rubric).forEach((cat) => {
    const max = Number(rubric[cat] || 0);
    let val = 0;

    if (cat === 'WordCount') {
      if (actualWordCount >= minimumWordCount) {
        val = max;
      } else {
        val = Math.round((actualWordCount / Math.max(1, minimumWordCount)) * max * 100) / 100;
      }
    } else {
      val = Math.round(Math.max(0, proportion) * max * 100) / 100;
    }

    categoryScores[cat] = val;
    computedTotal += val;
  });

  const report = {
    provider: 'local',
    score: computedTotal,
    categoryScores,
    categoryFeedback: Object.keys(rubric).reduce((acc, cat) => { acc[cat] = ''; return acc; }, {}),
    totalScore: computedTotal,
    breakdown: overall.breakdown,
    feedback: overall.feedback,
    strengths: overall.strengths,
    weaknesses: overall.weaknesses,
    grammarCorrections: overall.grammarCorrections,
    missingPoints: overall.missingPoints,
    suggestions: overall.suggestions,
    categoryTotalMarks: rubric,
    rubricBreakdown: categoryScores,
    finalScore: computedTotal,
    wordCount: actualWordCount,
    minimumWordCount,
  };

  return { report };
}

/**
 * Mark English Theory essay questions using WAEC/WASSCE standards
 * Categories: WordCount (5), Content (10), Expression (10), Organization (10), MechanicalAccuracy (15)
 */
async function evaluateEnglishEssay({ essayType, essayText, studentAnswer, modelAnswer = null, rubric = null, minimumWordCount = 450 }) {
  const waecRubric = rubric || {
    Content: 15,
    Organization: 10,
    Expression: 10,
    Grammar: 5,
    MechanicalAccuracy: 5,
    SalutationFormat: 5,
  };

  const prompt = buildPromptForWAECEssay({
    essayType,
    essayText,
    modelAnswer,
    studentAnswer,
    rubric: waecRubric,
    minimumWordCount,
  });

  try {
    console.log('AI essay prompt preview:', String(prompt).slice(0,300));
    const { raw, content, provider } = await callProvider({ prompt, model: null, maxTokens: 4000 });
    console.log('AI raw response (truncated):', typeof raw === 'string' ? raw.slice(0,400) : JSON.stringify(raw).slice(0,400));
    const parsed = safeParseJson(String(content || ''));

    // Normalize category scores
    const categoryScores = parsed.categoryScores || {};
    let totalScore = 0;
    Object.keys(waecRubric).forEach((cat) => {
      const max = Number(waecRubric[cat] || 0);
      let val = Number(categoryScores[cat]);
      if (!Number.isFinite(val)) val = 0;
      val = Math.max(0, Math.min(val, max));
      categoryScores[cat] = val;
      totalScore += val;
    });

    parsed.categoryScores = categoryScores;
    parsed.categoryTotalMarks = waecRubric;
    parsed.rubricBreakdown = categoryScores;
    parsed.totalScore = totalScore;
    parsed.score = totalScore;
    parsed.finalScore = totalScore;
    parsed.provider = provider || parsed.provider || 'ai';
    parsed.wordCount = (studentAnswer || '').trim().split(/\s+/).filter(Boolean).length;
    parsed.minimumWordCount = minimumWordCount;

    return { report: parsed, rawResponse: raw };
  } catch (err) {
    console.warn('WAEC essay marking failed, using fallback:', err.message);
    return simpleLocalGraderWithRubric({ 
      questionText: essayText, 
      rubric: waecRubric, 
      modelAnswer, 
      studentAnswer,
      minimumWordCount,
    });
  }
}

/**
 * Mark comprehension and summary questions
 */
async function evaluateComprehensionOrSummary({ passageText, questionText, studentAnswer, modelAnswer = null, questionType = 'comprehension', acceptedAnswers = [] }) {
  const totalMarks = questionType === 'comprehension' ? 30 : 20; // Comprehension 30, Summary 20
  const rubric = {
    Relevance: Math.round(totalMarks * 0.3),
    Accuracy: Math.round(totalMarks * 0.3),
    Completeness: Math.round(totalMarks * 0.2),
    Grammar: Math.max(1, totalMarks - (Math.round(totalMarks * 0.3) + Math.round(totalMarks * 0.3) + Math.round(totalMarks * 0.2))),
  };

  // If no answer provided, award zero marks immediately
  if (!studentAnswer || String(studentAnswer).trim() === '') {
    const categoryScores = {};
    Object.keys(rubric).forEach((cat) => { categoryScores[cat] = 0; });
    const parsed = {
      provider: 'blank-answer',
      categoryScores,
      categoryTotalMarks: rubric,
      totalScore: 0,
      finalScore: 0,
      score: 0,
      feedback: `No ${questionType} answer provided. Zero marks awarded.`,
      strengths: [],
      weaknesses: [`${questionType.charAt(0).toUpperCase() + questionType.slice(1)} answer is blank or empty`],
      grammarCorrections: '',
      missingPoints: ['Complete answer required'],
      suggestions: `Provide a complete ${questionType} answer.`,
    };
    return { report: parsed, rawResponse: { blankAnswer: true } };
  }
  // If acceptedAnswers provided, attempt semantic similarity shortcut using embeddings or token overlap
  try {
    let bestSim = 0;
    if (acceptedAnswers && acceptedAnswers.length > 0) {
      try {
        // Try embedding similarity first
        if (getEmbedding) {
          const studentVec = await getEmbedding({ text: studentAnswer });
          for (const acc of acceptedAnswers) {
            try {
              const accVec = await getEmbedding({ text: acc });
              const sim = cosineSimilarity(studentVec, accVec);
              if (sim > bestSim) bestSim = sim;
            } catch (e) {
              // ignore per-answer embedding errors
            }
          }
        }
      } catch (e) {
        // embedding provider failed — fallback to token overlap
      }

      if (bestSim === 0) {
        bestSim = bestStringSimilarity(studentAnswer, acceptedAnswers || []);
      }

      // If similarity is high enough, award marks based on similarity
      if (bestSim >= 0.85) {
        // Full credit
        const categoryScores = {};
        Object.keys(rubric).forEach((cat) => { categoryScores[cat] = Number(rubric[cat] || 0); });
        const parsed = {
          provider: 'semantic',
          similarity: Number(bestSim.toFixed(3)),
          categoryScores,
          categoryTotalMarks: rubric,
          totalScore: Object.values(rubric).reduce((s, v) => s + Number(v || 0), 0),
          finalScore: Object.values(rubric).reduce((s, v) => s + Number(v || 0), 0),
          feedback: 'Answer matches accepted answer closely via semantic similarity.',
          strengths: ['Correct and relevant answer'],
          weaknesses: [],
        };
        return { report: parsed, rawResponse: { semanticMatch: true, similarity: bestSim } };
      }

      if (bestSim >= 0.55) {
        // Partial proportional credit
        const totalScore = Math.round((Object.values(rubric).reduce((s, v) => s + Number(v || 0), 0)) * bestSim * 100) / 100;
        // distribute proportionally across categories
        const categoryScores = {};
        const totalRubric = Object.values(rubric).reduce((s, v) => s + Number(v || 0), 0);
        Object.keys(rubric).forEach((cat) => {
          const max = Number(rubric[cat] || 0);
          categoryScores[cat] = Math.round((max / totalRubric) * totalScore * 100) / 100;
        });
        const parsed = {
          provider: 'semantic',
          similarity: Number(bestSim.toFixed(3)),
          categoryScores,
          categoryTotalMarks: rubric,
          totalScore,
          finalScore: totalScore,
          feedback: 'Partial credit awarded based on semantic similarity to accepted answers.',
          strengths: [],
          weaknesses: [],
        };
        return { report: parsed, rawResponse: { semanticMatch: true, similarity: bestSim } };
      }
    }
  } catch (simErr) {
    console.warn('Semantic matching failed, continuing to AI provider:', simErr.message || simErr);
  }

  const prompt = buildPromptForComprehension({
    questionType,
    passageText,
    questionText,
    modelAnswer,
    studentAnswer,
    rubric,
  });

  try {
    console.log('Calling AI provider for comprehension/summary mark; questionType=', questionType);
    const { raw, content, provider } = await callProvider({ prompt, model: null, maxTokens: 4000 });
    const parsed = safeParseJson(String(content || ''));

    // Normalize category scores
    const categoryScores = parsed.categoryScores || {};
    let totalScore = 0;
    Object.keys(rubric).forEach((cat) => {
      const max = Number(rubric[cat] || 0);
      let val = Number(categoryScores[cat]) || 0;
      val = Math.max(0, Math.min(val, max));
      categoryScores[cat] = val;
      totalScore += val;
    });

    parsed.categoryScores = categoryScores;
    parsed.categoryTotalMarks = rubric;
    parsed.rubricBreakdown = categoryScores;
    parsed.totalScore = totalScore;
    parsed.score = totalScore;
    parsed.finalScore = totalScore;
    parsed.provider = provider || parsed.provider || 'ai';

    return { report: parsed, rawResponse: raw };
  } catch (err) {
    console.warn(`${questionType} marking failed, using fallback:`, err.message);
    const fallback = simpleLocalGraderWithRubric({
      questionText: `Passage: ${passageText}\n\nQuestion: ${questionText}`,
      rubric,
      modelAnswer,
      studentAnswer,
    });
    return { report: fallback.report, rawResponse: { local: true, error: String(err?.message || err) } };
  }
}

/**
 * Build WAEC essay marking prompt with category-specific guidance
 */
function buildPromptForWAECEssay({ essayType, essayText, modelAnswer, studentAnswer, rubric, minimumWordCount }) {
  const categories = Object.keys(rubric);
  const categoryInstructions = {
    Content: `Content (${rubric.Content} marks): Relevance to topic, quality and depth of ideas, use of examples, and connection to the prompt.`,
    Organization: `Organization (${rubric.Organization} marks): Clear introduction, logical paragraph structure, transitions, and a strong conclusion.`,
    Expression: `Expression (${rubric.Expression} marks): Vocabulary, clarity, sentence variety, style, and fluency.`,
    Grammar: `Grammar (${rubric.Grammar} marks): Correct sentence structure, subject-verb agreement, tense consistency, and appropriate use of English.`,
    MechanicalAccuracy: `Mechanical Accuracy (${rubric.MechanicalAccuracy} marks): Spelling, punctuation, capitalization, and formatting.`,
    SalutationFormat: `Salutation/Format (${rubric.SalutationFormat || rubric.Salutation || rubric.Salutation_Format || rubric['Salutation/Format']} marks): Proper letter format, salutation, address, closing, and layout.`,
  };

  return `You are an experienced WAEC/WASSCE English Language examiner. Mark the student's ${essayType} essay according to the official WAEC marking categories.

MARKING CATEGORIES AND ALLOCATION:
${Object.keys(rubric).map(cat => categoryInstructions[cat] || `${cat} (${rubric[cat]} marks): Mark this category based on the essay.`).join('\n')}

${modelAnswer ? `\nMODEL ANSWER REFERENCE:\n${modelAnswer}` : ''}

INSTRUCTIONS:
- Assess the student's answer against each category independently.
- Award marks conservatively up to the stated maximum for each category.
- For Word Count, award partial marks when the essay is below ${minimumWordCount} words but still relevant and coherent.
- If this is a debate essay, do not judge whether the student agrees or disagrees with the motion. Evaluate the essay only on the quality of arguments, organization, relevance, and grammar.
- Do not use only zero/full grading; provide partial credit in every category where appropriate.
- Ensure the sum of categoryScores equals totalScore.
- Keep categoryFeedback short and precise: one sentence per category.
- Provide specific, actionable feedback for each category and mention whether the essay meets the word-count requirement.
- Do not include any narrative text outside the exact JSON object.
- Identify strengths and areas for improvement.
- Output compact JSON only. Do not use markdown code fences or any text outside the JSON object.

Respond ONLY with valid JSON (no surrounding text):
{
  "categoryScores": { ${categories.map(c => `"${c}": <0-${rubric[c]}>`).join(', ')} },
  "categoryFeedback": { ${categories.map(c => `"${c}": "specific feedback for this category"`).join(', ')} },
  "totalScore": <sum of categoryScores>,
  "strengths": ["key strengths observed"],
  "weaknesses": ["key weaknesses observed"],
  "grammarCorrections": "specific grammar or spelling corrections",
  "missingPoints": ["important points missing if any"],
  "suggestions": "Specific actionable suggestions for improvement"
}

ESSAY PROMPT:
${essayText}

STUDENT'S ESSAY:
${studentAnswer}

Minimum Word Count: ${minimumWordCount} words.

Now evaluate and respond with JSON only.`;
}

/**
 * Build comprehension/summary marking prompt
 */
function buildPromptForComprehension({ questionType, passageText, questionText, modelAnswer, studentAnswer, rubric }) {
  const typeLabel = questionType === 'comprehension' ? 'Comprehension' : 'Summary';
  return `You are an experienced English Language examiner. Mark the student's ${typeLabel} answer based on the passage and question.

PASSAGE:
${passageText}

QUESTION:
${questionText}

${modelAnswer ? `\nMODEL ANSWER:\n${modelAnswer}` : ''}

MARKING CATEGORIES (${typeLabel}):
- Relevance (${rubric.Relevance} marks): Direct answer to question, stays on topic
- Accuracy (${rubric.Accuracy} marks): Factually correct based on passage, quotes where appropriate
- Completeness (${rubric.Completeness} marks): Addresses all parts of question, sufficient detail
- Grammar (${rubric.Grammar} marks): Correct English, clear expression

Evaluate conservatively and ensure categoryScores sum to totalScore.
- Keep categoryFeedback short and precise: one sentence per category.
- Output compact JSON only. Do not use markdown code fences or any text outside the JSON object.

Respond ONLY with valid JSON:
{
  "categoryScores": {
    "Relevance": <0-${rubric.Relevance}>,
    "Accuracy": <0-${rubric.Accuracy}>,
    "Completeness": <0-${rubric.Completeness}>,
    "Grammar": <0-${rubric.Grammar}>
  },
  "categoryFeedback": {
    "Relevance": "feedback",
    "Accuracy": "feedback",
    "Completeness": "feedback",
    "Grammar": "feedback"
  },
  "totalScore": <total>,
  "strengths": [],
  "weaknesses": [],
  "grammarCorrections": "corrections if any",
  "missingPoints": [],
  "suggestions": "improvement suggestions"
}

STUDENT'S ANSWER:
${studentAnswer}

JSON response only:`;
}

module.exports = {
  evaluateAnswer,
  simpleLocalGrader,
  evaluateEnglishEssay,
  evaluateComprehensionOrSummary,
  buildPromptForWAECEssay,
  buildPromptForComprehension,
  safeParseJson,
};
