import { useState, useEffect } from 'react';
import API from '../api/axios';
import './TheoryResultPage.css';

const TheoryResultPage = ({ attemptId, assessment, onReview, onRetake, onBackToDashboard = () => {} }) => {
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await API.get(`/assessments/attempt/${attemptId}`);
        const attemptData = response.data && typeof response.data === 'object'
          ? response.data.attempt ?? response.data
          : null;

        if (!attemptData || typeof attemptData !== 'object') {
          throw new Error('Invalid attempt response from server');
        }

        setAttempt(attemptData);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load results');
        console.error('Results fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchResults();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="theory-result-page">
        <div className="loading">
          <p>Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theory-result-page">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={onBackToDashboard} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="theory-result-page">
        <div className="no-data">
          <p>No results available.</p>
        </div>
      </div>
    );
  }

  const normalizeRubricKey = (key) => String(key || '').replace(/[\s_\-\/]/g, '').toLowerCase();
  const getCategoryLabel = (category) => {
    const normalized = normalizeRubricKey(category);
    if (normalized === 'wordcount') return 'Word Count';
    if (normalized === 'content') return 'Content';
    if (normalized === 'organization') return 'Organization';
    if (normalized === 'expression') return 'Expression';
    if (normalized === 'grammar') return 'Grammar';
    if (normalized === 'mechanicalaccuracy') return 'Mechanical Accuracy';
    if (normalized === 'salutationformat') return 'Salutation/Format';
    if (normalized === 'relevance') return 'Relevance';
    if (normalized === 'accuracy') return 'Accuracy';
    if (normalized === 'completeness') return 'Completeness';
    return category;
  };

  const getAnswerMeta = (answer) => {
    return attempt.questions?.find(
      (q) => q.questionId === answer.questionId || q.id === answer.questionId || q.questionId === answer.questionId || q.question?.questionId === answer.questionId
    );
  };

  const getTheorySectionType = (answer) => {
    const sectionName = String(answer.sectionName || answer.section_title || answer.section || '').toLowerCase();
    if (sectionName.includes('essay')) return 'Essay';
    if (sectionName.includes('comprehension')) return 'Comprehension';
    if (sectionName.includes('summary')) return 'Summary';

    const qId = String(answer.questionId || '').toLowerCase();
    if (qId.includes('essay') || qId.includes('letter') || qId.includes('report') || qId.includes('article')) return 'Essay';
    if (qId.includes('comprehension') || qId.includes('reading')) return 'Comprehension';
    if (qId.includes('summary')) return 'Summary';

    const meta = getAnswerMeta(answer);
    const metaType = String(meta?.questionType || meta?.type || meta?.sectionName || meta?.section_title || '').toLowerCase();
    if (metaType.includes('essay')) return 'Essay';
    if (metaType.includes('comprehension')) return 'Comprehension';
    if (metaType.includes('summary')) return 'Summary';

    return 'Essay';
  };

  const FIXED_SECTION_MAX = {
    Essay: 50,
    Comprehension: 30,
    Summary: 20,
  };

  const getCategoryTotalMarks = (category, categoryTotalMarks = {}, rubricObj = {}) => {
    if (!category) return 0;
    if (categoryTotalMarks?.[category] !== undefined) return Number(categoryTotalMarks[category]);
    if (rubricObj?.[category] !== undefined) return Number(rubricObj[category]);

    const normalized = normalizeRubricKey(category);
    if (categoryTotalMarks?.[getCategoryLabel(category)] !== undefined) return Number(categoryTotalMarks[getCategoryLabel(category)]);
    if (rubricObj?.[getCategoryLabel(category)] !== undefined) return Number(rubricObj[getCategoryLabel(category)]);

    return normalized === 'content'
      ? 20
      : normalized === 'organization'
      ? 10
      : normalized === 'expression'
      ? 10
      : normalized === 'wordcount'
      ? 5
      : normalized === 'grammar'
      ? 5
      : normalized === 'mechanicalaccuracy'
      ? 5
      : normalized === 'salutationformat'
      ? 5
      : normalized === 'relevance'
      ? 9
      : normalized === 'accuracy'
      ? 9
      : normalized === 'completeness'
      ? 6
      : 0;
  };

  const getRawAnswerObtainedMarks = (answer) => {
    if (Number.isFinite(Number(answer.marks))) return Number(answer.marks);
    if (Number.isFinite(Number(answer.aiReport?.score))) return Number(answer.aiReport.score);
    if (Number.isFinite(Number(answer.aiReport?.totalScore))) return Number(answer.aiReport.totalScore);
    const categories = answer.aiReport?.categoryScores;
    if (categories && typeof categories === 'object') {
      return Object.values(categories).reduce((sum, value) => sum + Number(value || 0), 0);
    }
    return 0;
  };

  const getRawAnswerMaxMarks = (answer) => {
    const answerMax = Number(answer.totalMarks || 0);
    const categoryTotals = answer.aiReport?.categoryTotalMarks || answer.aiReport?.rubric || {};
    const keys = Object.keys(categoryTotals || {});
    if (keys.length > 0) {
      return keys.reduce((sum, key) => sum + Number(categoryTotals[key] || 0), 0);
    }
    return answerMax || 0;
  };

  const getAnswerObtainedMarks = (answer) => {
    const sectionType = getTheorySectionType(answer);
    const rawScore = getRawAnswerObtainedMarks(answer);
    const rawMax = getRawAnswerMaxMarks(answer);
    const shouldNormalizeToFixed = sectionType === 'Essay';
    const fixedMax = shouldNormalizeToFixed ? FIXED_SECTION_MAX[sectionType] || 0 : 0;

    if (shouldNormalizeToFixed && fixedMax && rawMax && rawMax !== fixedMax) {
      return Number(((rawScore / rawMax) * fixedMax).toFixed(2));
    }

    return rawScore;
  };

  const getAnswerMaxMarks = (answer) => {
    const sectionType = getTheorySectionType(answer);
    const rawMax = getRawAnswerMaxMarks(answer);
    const answerTotalMarks = Number(answer.totalMarks || 0);

    if (answerTotalMarks > 0) {
      return answerTotalMarks;
    }

    if (sectionType === 'Essay' && FIXED_SECTION_MAX[sectionType]) {
      return FIXED_SECTION_MAX[sectionType];
    }

    return rawMax || 0;
  };

  const sectionTotals = attempt.answers?.reduce((acc, answer) => {
    const sectionType = getTheorySectionType(answer);
    const obtained = getAnswerObtainedMarks(answer);
    const max = getAnswerMaxMarks(answer);
    if (!acc[sectionType]) acc[sectionType] = { obtained: 0, max: 0, answers: [] };
    acc[sectionType].obtained += obtained;
    acc[sectionType].max += max;
    acc[sectionType].answers.push(answer);
    return acc;
  }, {}) || {};

  const totalMarks = (sectionTotals.Essay?.obtained || 0) + (sectionTotals.Comprehension?.obtained || 0) + (sectionTotals.Summary?.obtained || 0);
  const maxMarks = 100;
  const percentage = maxMarks ? (totalMarks / maxMarks) * 100 : 0;
  const passed = percentage >= (assessment?.passingScore || 50);

  const getGradeLetter = (pct) => {
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  };
  const grade = getGradeLetter(percentage);

  return (
    <div className="theory-result-page">
      <div className="result-container">
        <div className="result-header">
          <h1>Assessment Results</h1>
          <div className="result-meta">
            <p>
              <strong>Assessment:</strong> {assessment?.name || 'Theory Assessment'}
            </p>
            <p>
              <strong>Date:</strong> {new Date(attempt.submittedAt || attempt.markedAt || attempt.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className={`score-summary ${passed ? 'passed' : 'failed'}`}>
          <div className="score-display">
            <div className="total-score">
              <span className="score-number">{totalMarks}</span>
              <span className="score-divider">/</span>
              <span className="max-score">{maxMarks}</span>
            </div>
            <div className="percentage-display">{percentage.toFixed(1)}%</div>
          </div>

          <div className="status-badge">
            <span className={`badge ${passed ? 'pass' : 'fail'}`}>
              {passed ? '✓ PASS' : '✗ FAIL'}
            </span>
            <p className="status-message">
              {passed ?
                `Excellent! You have achieved a passing score.` :
                `You did not achieve the required passing score of ${assessment?.passingScore || 50}%.`
              }
            </p>
          </div>
        </div>

        <div className="answers-section">
          <h2>Final Result</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <h3>Essay</h3>
              <p className="large">{sectionTotals.Essay ? `${sectionTotals.Essay.obtained.toFixed(2)} / ${sectionTotals.Essay.max}` : 'N/A'}</p>
            </div>
            <div className="summary-item">
              <h3>Comprehension</h3>
              <p className="large">{sectionTotals.Comprehension ? `${sectionTotals.Comprehension.obtained.toFixed(2)} / ${sectionTotals.Comprehension.max}` : 'N/A'}</p>
            </div>
            <div className="summary-item">
              <h3>Summary</h3>
              <p className="large">{sectionTotals.Summary ? `${sectionTotals.Summary.obtained.toFixed(2)} / ${sectionTotals.Summary.max}` : 'N/A'}</p>
            </div>
            <div className="summary-item">
              <h3>Final Score</h3>
              <p className="large">{totalMarks.toFixed(2)} / {maxMarks}</p>
            </div>
            <div className="summary-item">
              <h3>Percentage</h3>
              <p className="large">{percentage.toFixed(1)}%</p>
            </div>
            <div className="summary-item">
              <h3>Grade</h3>
              <p className="large grade">{grade}</p>
            </div>
            <div className="summary-item">
              <h3>Status</h3>
              <p className={`large ${passed ? 'pass' : 'fail'}`}>{passed ? 'PASS' : 'FAIL'}</p>
            </div>
          </div>

          <div className="review-toggle">
            <button className="btn-secondary" onClick={() => setShowReview(!showReview)}>
              {showReview ? 'Hide Review' : 'Review Assessment'}
            </button>
          </div>

          {showReview && (
            <div className="review-list">
              <h3>Theory Review</h3>
              {attempt.answers?.map((answer, idx) => {
                const sectionType = getTheorySectionType(answer);
                const meta = getAnswerMeta(answer);
                const passage = meta?.passage || meta?.passageText || meta?.question?.passage || meta?.question?.passageText || answer.passage || answer.passageText || answer.aiReport?.passage || null;
                const summaryInstructions = meta?.summary?.instruction || meta?.instruction || answer.aiReport?.instructions || answer.aiReport?.summaryInstructions || null;
                const correctAnswer = answer.correctAnswer || meta?.answer || meta?.sampleAnswer || answer.aiReport?.modelAnswer || 'N/A';
                const answerScore = getAnswerObtainedMarks(answer);
                const answerMax = getAnswerMaxMarks(answer);
                const categoryScores = answer.aiReport?.categoryScores || {};
                const categoryFeedback = answer.aiReport?.categoryFeedback || {};
                const requiredWordCount = answer.aiReport?.minimumWordCount || answer.aiReport?.requiredWordCount || answer.aiReport?.requiredWords || meta?.minimumWordCount || meta?.minimum_words || meta?.requiredWordCount || null;
                const strengths = answer.aiReport?.strengths || answer.aiReport?.keyPoints || [];
                const weaknesses = answer.aiReport?.weaknesses || [];
                const grammarCorrections = answer.aiReport?.grammarCorrections || '';
                const suggestions = answer.aiReport?.suggestions || '';
                const missingPoints = answer.aiReport?.missingPoints || [];
                const expectedPoints = Array.isArray(answer.aiReport?.expectedPoints) ? answer.aiReport.expectedPoints : Array.isArray(answer.aiReport?.keyPoints) ? answer.aiReport.keyPoints : [];
                const pointsFound = Number.isFinite(Number(answer.aiReport?.pointsFound)) ? Number(answer.aiReport.pointsFound) : Number.isFinite(Number(answer.aiReport?.foundPoints)) ? Number(answer.aiReport.foundPoints) : Number.isFinite(Number(answer.aiReport?.keyPointsFound)) ? Number(answer.aiReport.keyPointsFound) : null;

                return (
                  <div key={idx} className="review-item theory-review">
                    <div className="review-q">
                      <strong>{sectionType} Question {idx + 1}</strong>
                      <p>{answer.questionText}</p>
                    </div>

                    {(sectionType === 'Comprehension' || sectionType === 'Summary') && passage && (
                      <div className="review-passage">
                        <h4>Passage</h4>
                        {Array.isArray(passage)
                          ? passage.map((para, pidx) => <p key={pidx}>{para.text || para}</p>)
                          : <p>{passage}</p>}
                      </div>
                    )}

                    <div className="review-answer">
                      <h4>Student Answer</h4>
                      <div className="answer-text">{answer.studentAnswer || '—'}</div>
                    </div>

                    {sectionType === 'Essay' && (
                      <div className="essay-review">
                        <h4>Essay Marking Breakdown</h4>
                        {requiredWordCount ? (
                          <div className="wordcount-requirement">
                            <p><strong>Word Count:</strong> {categoryScores.WordCount ?? categoryScores.wordcount ?? 'N/A'} words</p>
                            <p><strong>Required:</strong> {requiredWordCount} words</p>
                          </div>
                        ) : null}
                        <div className="breakdown-grid">
                          <div><strong>Word Count</strong><span>{categoryScores.WordCount ?? categoryScores.wordcount ?? 'N/A'} / {getCategoryTotalMarks('WordCount', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Content</strong><span>{categoryScores.Content ?? categoryScores.content ?? 'N/A'} / {getCategoryTotalMarks('Content', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Organization</strong><span>{categoryScores.Organization ?? categoryScores.organization ?? 'N/A'} / {getCategoryTotalMarks('Organization', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Expression</strong><span>{categoryScores.Expression ?? categoryScores.expression ?? 'N/A'} / {getCategoryTotalMarks('Expression', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Grammar</strong><span>{categoryScores.Grammar ?? categoryScores.grammar ?? 'N/A'} / {getCategoryTotalMarks('Grammar', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Mechanical Accuracy</strong><span>{categoryScores.MechanicalAccuracy ?? categoryScores.mechanicalaccuracy ?? 'N/A'} / {getCategoryTotalMarks('MechanicalAccuracy', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div><strong>Salutation/Format</strong><span>{categoryScores.SalutationFormat ?? categoryScores.salutationformat ?? 'N/A'} / {getCategoryTotalMarks('SalutationFormat', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          <div className="essay-total"><strong>Essay Total</strong><span>{answerScore.toFixed(2)} / {answerMax}</span></div>
                        </div>

                        {strengths.length > 0 && (
                          <div className="feedback-block">
                            <h5>Strengths</h5>
                            <ul>{strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}

                        {weaknesses.length > 0 && (
                          <div className="feedback-block">
                            <h5>Weaknesses</h5>
                            <ul>{weaknesses.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}

                        {grammarCorrections && (
                          <div className="feedback-block">
                            <h5>Grammar Corrections</h5>
                            <p>{grammarCorrections}</p>
                          </div>
                        )}

                        {suggestions && (
                          <div className="feedback-block">
                            <h5>Suggestions</h5>
                            <p>{suggestions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {sectionType === 'Comprehension' && (
                      <div className="comprehension-review">
                        <h4>Comprehension Review</h4>
                        {passage && (
                          <div className="review-passage">
                            <h5>Passage</h5>
                            {Array.isArray(passage)
                              ? passage.map((para, pidx) => <p key={pidx}>{para.text || para}</p>)
                              : <p>{passage}</p>}
                          </div>
                        )}
                        <p><strong>Question:</strong> {answer.questionText}</p>
                        <p><strong>Your Answer:</strong></p>
                        <div className="answer-text">{answer.studentAnswer || '—'}</div>
                        <p><strong>Correct / Model Answer:</strong></p>
                        <div className="answer-text">{correctAnswer}</div>
                        <p><strong>Marks Awarded:</strong> {answerScore.toFixed(2)} / {answerMax}</p>
                        <div className="breakdown-grid">
                          {Object.entries(categoryScores).map(([category, score]) => (
                            <div key={category} className="breakdown-item"><strong>{getCategoryLabel(category)}</strong><span>{Number(score).toFixed(2)} / {getCategoryTotalMarks(category, answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          ))}
                        </div>
                        {categoryFeedback && Object.keys(categoryFeedback).length > 0 && (
                          <div className="feedback-block">
                            <h5>AI Feedback</h5>
                            {Object.entries(categoryFeedback).map(([category, feedback]) => (
                              <p key={category}><strong>{getCategoryLabel(category)}:</strong> {feedback}</p>
                            ))}
                          </div>
                        )}
                        {suggestions && (
                          <div className="feedback-block">
                            <h5>Suggestions</h5>
                            <p>{suggestions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {sectionType === 'Summary' && (
                      <div className="summary-review">
                        <h4>Summary Review</h4>
                        {passage && (
                          <div className="review-passage">
                            <h5>Passage</h5>
                            {Array.isArray(passage)
                              ? passage.map((para, pidx) => <p key={pidx}>{para.text || para}</p>)
                              : <p>{passage}</p>}
                          </div>
                        )}
                        {summaryInstructions && (
                          <div className="summary-instructions">
                            <h5>Instructions</h5>
                            <p>{summaryInstructions}</p>
                          </div>
                        )}
                        <p><strong>Your Summary:</strong></p>
                        <div className="answer-text">{answer.studentAnswer || '—'}</div>
                        <p><strong>Summary Score:</strong> {answerScore.toFixed(2)} / {answerMax}</p>
                        <div className="breakdown-grid">
                          {Object.entries(categoryScores).map(([category, score]) => (
                            <div key={category} className="breakdown-item"><strong>{getCategoryLabel(category)}</strong><span>{Number(score).toFixed(2)} / {getCategoryTotalMarks(category, answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</span></div>
                          ))}
                        </div>

                        {expectedPoints.length > 0 && (
                          <div className="feedback-block">
                            <h5>Key Points Expected</h5>
                            <ul>{expectedPoints.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}

                        {typeof pointsFound === 'number' && (
                          <div className="feedback-block">
                            <h5>Key Points Found</h5>
                            <p>{pointsFound}{answer.aiReport?.keyPointsTotal ? ` / ${answer.aiReport.keyPointsTotal}` : ''}</p>
                          </div>
                        )}

                        {strengths.length > 0 && (
                          <div className="feedback-block">
                            <h5>Key Points Found</h5>
                            <ul>{strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}

                        {missingPoints.length > 0 && (
                          <div className="feedback-block">
                            <h5>Key Points Missed</h5>
                            <ul>{missingPoints.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}

                        {grammarCorrections && (
                          <div className="feedback-block">
                            <h5>Grammar Corrections</h5>
                            <p>{grammarCorrections}</p>
                          </div>
                        )}

                        {suggestions && (
                          <div className="feedback-block">
                            <h5>Suggestions</h5>
                            <p>{suggestions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {answer.aiReport?.feedback && (
                      <div className="general-feedback">
                        <h4>Overall Feedback</h4>
                        <p>{answer.aiReport.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button onClick={onBackToDashboard} className="btn-secondary">
            Back to Dashboard
          </button>
          <button onClick={onRetake} className="btn-primary">
            Retake Assessment
          </button>
        </div>

        <div className="result-footer">
          <p>Your answers have been marked by our AI system using WAEC/WASSCE standards.</p>
          <p>For any concerns, please contact your instructor.</p>
        </div>
      </div>
    </div>
  );
};

export default TheoryResultPage;
