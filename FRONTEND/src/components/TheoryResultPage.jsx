import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TheoryResultPage.css';

/**
 * TheoryResultPage Component
 * 
 * Displays assessment results with WAEC/WASSCE standard breakdown
 * Shows:
 *  - Category scores for essays (Content, Organization, Expression, Mechanical)
 *  - AI feedback per category
 *  - Student answer vs model answer
 *  - Strengths and weaknesses
 *  - Grammar corrections
 *  - Overall performance
 * 
 * Props:
 *  - attemptId: String - ID of the assessment attempt
 *  - assessment: Object - Assessment details
 *  - onReview: Function() - Called when user wants to review
 *  - onRetake: Function() - Called when user wants to retake
 */

const TheoryResultPage = ({ attemptId, assessment, onReview, onRetake }) => {
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAnswer, setExpandedAnswer] = useState(null);
  const [showModelAnswer, setShowModelAnswer] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [polling, setPolling] = useState(false);

  const rubricCategoryLabels = {
    content: 'Content',
    organization: 'Organization',
    expression: 'Expression',
    wordcount: 'Word Count',
    'word_count': 'Word Count',
    'word count': 'Word Count',
    mechanicalaccuracy: 'Mechanical Accuracy',
    mechanical_accuracy: 'Mechanical Accuracy',
    salutationformat: 'Salutation / Format',
    'salutation/format': 'Salutation / Format',
    'salutation_format': 'Salutation / Format',
  };

  const normalizeRubricKey = (category) =>
    category?.toString().trim().replace(/\s+/g, ' ').replace(/[\/ _]/g, '').toLowerCase();

  const getCategoryLabel = (category) => {
    const normalized = normalizeRubricKey(category);
    return (
      rubricCategoryLabels[normalized] ||
      category
        .toString()
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
    );
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
      : normalized === 'mechanicalaccuracy'
      ? 5
      : normalized === 'grammar'
      ? 5
      : normalized === 'salutationformat'
      ? 5
      : 0;
  };

  const getCategoryPercentage = (score, totalMarks) =>
    totalMarks ? Math.round((Number(score) / totalMarks) * 100) : 0;

  const getCategoryCssKey = (category) => normalizeRubricKey(category).replace(/[^a-z0-9]/g, '');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const token =
          localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('token');
        const response = await axios.get(
          `/api/assessments/${attemptId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setAttempt(response.data.attempt || response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load results');
        console.error('Results fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchResults();
    }
  }, [attemptId]);

  // Poll for final AI marking if provisional scores exist
  useEffect(() => {
    let timer = null;
    const shouldPoll = () => {
      if (!attempt || !attempt.answers) return false;
      return attempt.answers.some(a => a.provisional && !a.aiMarked);
    };

    async function pollOnce() {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
        const resp = await axios.get(`/api/assessments/${attemptId}`, { headers: { Authorization: `Bearer ${token}` } });
        const updated = resp.data.attempt || resp.data;
        setAttempt(updated);
        if (!updated.answers || !updated.answers.some(a => a.provisional && !a.aiMarked)) {
          setPolling(false);
          return;
        }
      } catch (e) {
        console.warn('Polling attempt fetch failed', e.message || e);
      }
    }

    if (shouldPoll()) {
      setPolling(true);
      timer = setInterval(pollOnce, 5000);
    }

    return () => {
      if (timer) clearInterval(timer);
      setPolling(false);
    };
  }, [attempt, attemptId]);

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
          <button onClick={onReview} className="btn-primary">
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

  const renderCategoryScore = (category, score, totalMarks, feedback) => {
    const label = getCategoryLabel(category);
    const safeTotal = totalMarks || 1;
    const percentage = totalMarks ? (Number(score) / safeTotal) * 100 : 0;
    const isExcellent = percentage >= 80;
    const isGood = percentage >= 60;
    const isPass = percentage >= 50;

    return (
      <div key={category} className={`category-score category-${getCategoryCssKey(category)}`}>
        <div className="category-header">
          <h4>{label}</h4>
          <span className={`score-display ${isExcellent ? 'excellent' : isGood ? 'good' : isPass ? 'pass' : 'fail'}`}>
            {Number(score)} / {totalMarks || 'N/A'}
          </span>
        </div>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${isExcellent ? 'excellent' : isGood ? 'good' : isPass ? 'pass' : 'fail'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="category-meta">
          <span className="percentage">{totalMarks ? `${percentage.toFixed(1)}%` : 'N/A'}</span>
          {feedback && <p className="category-feedback">{feedback}</p>}
        </div>
      </div>
    );
  };

  const renderAnswerAnalysis = (answer, index) => {
    if (!answer.aiReport) {
      return (
        <div key={index} className="answer-analysis no-report">
          <p>This answer has not been marked yet.</p>
        </div>
      );
    }

    const isEssay = answer.sectionName?.toLowerCase().includes('essay');
    const isExpanded = expandedAnswer === index;

    return (
      <div key={index} className="answer-analysis">
        <div className="analysis-header">
          <div className="answer-title">
            <h3>
              {answer.sectionName ? `${answer.sectionName} - ` : ''}
              Question {index + 1}
            </h3>
            {answer.marks !== undefined && (
              <span className="marks-earned">
                {answer.marks} / {answer.totalMarks || 0} marks
              </span>
            )}
          </div>
          <button 
            onClick={() => setExpandedAnswer(isExpanded ? null : index)}
            className="btn-expand"
          >
            {isExpanded ? '▼ Collapse' : '▶ Expand'}
          </button>
        </div>

        {isExpanded && (
          <div className="analysis-content">
            {/* Question Text */}
            <div className="question-display">
              <h4>Question</h4>
              <p>{answer.questionText}</p>
            </div>

            {/* Student Answer */}
            <div className="answer-display">
              <h4>Your Answer</h4>
              <div className="answer-text">
                {answer.studentAnswer}
              </div>
              <span className="word-count">
                {answer.studentAnswer?.split(/\s+/).filter(w => w).length || 0} words
              </span>
            </div>

            {/* Model Answer if available */}
            {answer.correctAnswer && (
              <div className="model-answer">
                <button 
                  onClick={() => setShowModelAnswer(showModelAnswer === index ? null : index)}
                  className="btn-show-model"
                >
                  {showModelAnswer === index ? '▼ Hide Model Answer' : '▶ Show Model Answer'}
                </button>
                {showModelAnswer === index && (
                  <div className="model-answer-text">
                    <h4>Model Answer</h4>
                    <div className="answer-text">
                      {answer.correctAnswer}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Report Analysis */}
            {answer.aiReport && (
              <div className="ai-analysis">
                {/* Essay Category Breakdown */}
                {isEssay && answer.aiReport.categoryScores && (
                  <div className="category-breakdown">
                    <h4>Category Breakdown (WAEC Standard)</h4>
                    <div className="categories-grid">
                      {Object.entries(answer.aiReport.categoryScores)
                        .sort(([a], [b]) => {
                          const order = ['content', 'organization', 'expression', 'mechanicalaccuracy', 'salutationformat'];
                          return order.indexOf(normalizeRubricKey(a)) - order.indexOf(normalizeRubricKey(b));
                        })
                        .map(([category, score]) => {
                          const totalMarks = getCategoryTotalMarks(category, answer.aiReport.categoryTotalMarks, answer.aiReport.rubric || {});
                          return renderCategoryScore(category, score, totalMarks, answer.aiReport.categoryFeedback?.[category]);
                        })}
                    </div>
                  </div>
                )}

                {/* Category Feedback */}
                {answer.aiReport.categoryFeedback && (
                  <div className="feedback-section">
                    <h4>Detailed Feedback by Category</h4>
                    {Object.entries(answer.aiReport.categoryFeedback).map(([category, feedback]) => (
                      <div key={category} className="feedback-item">
                        <h5>{getCategoryLabel(category)}</h5>
                        <p>{feedback}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* General Feedback */}
                {answer.aiReport.feedback && (
                  <div className="general-feedback">
                    <h4>Overall Feedback</h4>
                    <p>{answer.aiReport.feedback}</p>
                  </div>
                )}

                {/* Strengths */}
                {answer.aiReport.strengths && answer.aiReport.strengths.length > 0 && (
                  <div className="strengths">
                    <h5>✓ Strengths</h5>
                    <ul>
                      {answer.aiReport.strengths.map((strength, i) => (
                        <li key={i}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {answer.aiReport.weaknesses && answer.aiReport.weaknesses.length > 0 && (
                  <div className="weaknesses">
                    <h5>✗ Areas for Improvement</h5>
                    <ul>
                      {answer.aiReport.weaknesses.map((weakness, i) => (
                        <li key={i}>{weakness}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Grammar Corrections */}
                {answer.aiReport.grammarCorrections && (
                  <div className="grammar-section">
                    <h5>Grammar & Punctuation Corrections</h5>
                    <div className="grammar-corrections">
                      {answer.aiReport.grammarCorrections}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {answer.aiReport.suggestions && (
                  <div className="suggestions">
                    <h5>Suggestions for Next Time</h5>
                    <p>{answer.aiReport.suggestions}</p>
                  </div>
                )}

                {/* Missing Points */}
                {answer.aiReport.missingPoints && answer.aiReport.missingPoints.length > 0 && (
                  <div className="missing-points">
                    <h5>Missing Points</h5>
                    <ul>
                      {answer.aiReport.missingPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getTheorySectionType = (answer) => {
    const key = String(answer.sectionName || answer.questionType || answer.type || '').toLowerCase();
    if (key.includes('essay') || key.includes('letter') || key.includes('article') || key.includes('story') || key.includes('debate')) {
      return 'Essay';
    }
    if (key.includes('comprehension')) {
      return 'Comprehension';
    }
    if (key.includes('summary')) {
      return 'Summary';
    }
    return 'Other';
  };

  const getAnswerMeta = (answer) => {
    return attempt.questions?.find(
      (q) => q.questionId === answer.questionId || q.id === answer.questionId || q.questionId === answer.questionId || q.question?.questionId === answer.questionId
    );
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
    const fixedMax = FIXED_SECTION_MAX[sectionType] || 0;
    const rawScore = getRawAnswerObtainedMarks(answer);
    const rawMax = getRawAnswerMaxMarks(answer) || fixedMax;

    if (fixedMax && rawMax && rawMax !== fixedMax) {
      return Number(((rawScore / rawMax) * fixedMax).toFixed(2));
    }

    return rawScore;
  };

  const getAnswerMaxMarks = (answer) => {
    const sectionType = getTheorySectionType(answer);
    const fixedMax = FIXED_SECTION_MAX[sectionType];
    if (fixedMax) return fixedMax;

    const rawMax = getRawAnswerMaxMarks(answer);
    return rawMax || Number(answer.totalMarks || 0) || 0;
  };

  const sectionTotals = attempt.answers?.reduce((acc, answer) => {
    const sectionType = getTheorySectionType(answer);
    const obtained = getAnswerObtainedMarks(answer);
    const max = getAnswerMaxMarks(answer);
    if (!acc[sectionType]) acc[sectionType] = { obtained: 0, max: 0 };
    acc[sectionType].obtained += obtained;
    acc[sectionType].max += max;
    return acc;
  }, {}) || {};

  // Calculate totals
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

  const hasProvisional = attempt.answers?.some(a => a.provisional && !a.aiMarked);

  return (
    <div className="theory-result-page">
      <div className="result-container">
        {/* Header Section */}
        <div className="result-header">
          <h1>Assessment Results</h1>
          <div className="result-meta">
            <p>
              <strong>Assessment:</strong> {assessment?.name || 'Theory Assessment'}
            </p>
            <p>
              <strong>Date:</strong> {new Date(attempt.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Overall Score Summary */}
        <div className={`score-summary ${passed ? 'passed' : 'failed'}`}>
          <div className="score-display">
            <div className="total-score">
              <span className="score-number">{totalMarks}</span>
              <span className="score-divider">/</span>
              <span className="max-score">{maxMarks}</span>
            </div>
            <div className="percentage-display">
              {percentage.toFixed(1)}%
            </div>
          </div>
          
          <div className="status-badge">
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span className={`badge ${passed ? 'pass' : 'fail'}`}>
                  {passed ? '✓ PASS' : '✗ FAIL'}
                </span>
                {hasProvisional && (
                  <span className="badge provisional" title="Provisional AI Score">Provisional AI Score</span>
                )}
                {polling && (
                  <span className="badge loading">Final marking in progress...</span>
                )}
              </div>
            <p className="status-message">
              {passed ? 
                `Excellent! You have achieved a passing score.` :
                `You did not achieve the required passing score of ${assessment?.passingScore || 50}%.`
              }
            </p>
          </div>
        </div>

        {/* Theory section breakdown */}
        <div className="section-breakdown">
          <h2>Theory Subsection Scores</h2>
          <div className="section-scores">
            {['Essay', 'Comprehension', 'Summary'].map((section) => {
              const data = sectionTotals[section];
              if (!data) return null;
              return (
                <div key={section} className="section-score-card">
                  <h3>{section}</h3>
                  <p className="score-value">
                    {data.obtained} / {data.max}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="final-score-lines">
            <p><strong>Essay:</strong> {sectionTotals.Essay ? `${sectionTotals.Essay.obtained} / ${sectionTotals.Essay.max}` : 'N/A'} {hasProvisional && sectionTotals.Essay ? <em>(Provisional)</em> : null}</p>
            <p><strong>Comprehension:</strong> {sectionTotals.Comprehension ? `${sectionTotals.Comprehension.obtained} / ${sectionTotals.Comprehension.max}` : 'N/A'}</p>
            <p><strong>Summary:</strong> {sectionTotals.Summary ? `${sectionTotals.Summary.obtained} / ${sectionTotals.Summary.max}` : 'N/A'}</p>
            <p><strong>Final Score:</strong> {totalMarks} / {maxMarks} {hasProvisional ? <em>(Provisional)</em> : null}</p>
          </div>
        </div>

        {/* Summary & Review Section */}
        <div className="answers-section">
          <h2>Result Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <h3>Grade</h3>
              <p className="large grade">{grade}</p>
            </div>
            <div className="summary-item">
              <h3>Percentage</h3>
              <p className="large">{percentage.toFixed(1)}%</p>
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
                const passage = meta?.passage || meta?.passageText || meta?.question?.passage || meta?.question?.passageText || null;
                const answerScore = getAnswerObtainedMarks(answer);
                const answerMax = getAnswerCategoryMax(answer);
                const categoryScores = answer.aiReport?.categoryScores || {};
                const categoryFeedback = answer.aiReport?.categoryFeedback || {};
                const strengths = answer.aiReport?.strengths || [];
                const weaknesses = answer.aiReport?.weaknesses || [];
                const missingPoints = answer.aiReport?.missingPoints || [];

                return (
                  <div key={idx} className="review-item theory-review">
                    <div className="review-q">
                      <strong>{sectionType} Review:</strong> {answer.questionText}
                    </div>

                    {passage && (
                      <div className="review-passage">
                        <h4>Passage</h4>
                        {Array.isArray(passage)
                          ? passage.map((para, pidx) => (
                              <p key={pidx}>{para.text || para}</p>
                            ))
                          : <p>{passage}</p>}
                      </div>
                    )}

                    <div className="review-answer">
                      <h4>Your Answer</h4>
                      <div className="answer-text">{answer.studentAnswer || '—'}</div>
                    </div>

                    {sectionType === 'Essay' && (
                      <div className="essay-review">
                        <h4>Essay Review</h4>
                        <ul>
                          <li><strong>Word Count:</strong> {answer.aiReport?.wordCount ?? (answer.studentAnswer?.split(/\s+/).filter(Boolean).length || 0)}</li>
                          <li><strong>Content Score:</strong> {categoryScores.Content ?? categoryScores.content ?? 'N/A'} / {getCategoryTotalMarks('Content', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Organization Score:</strong> {categoryScores.Organization ?? categoryScores.organization ?? 'N/A'} / {getCategoryTotalMarks('Organization', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Expression Score:</strong> {categoryScores.Expression ?? categoryScores.expression ?? 'N/A'} / {getCategoryTotalMarks('Expression', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Grammar Score:</strong> {categoryScores.Grammar ?? categoryScores.grammar ?? 'N/A'} / {getCategoryTotalMarks('Grammar', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Mechanical Accuracy Score:</strong> {categoryScores.MechanicalAccuracy ?? categoryScores.mechanicalaccuracy ?? 'N/A'} / {getCategoryTotalMarks('MechanicalAccuracy', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Salutation/Format Score:</strong> {categoryScores.SalutationFormat ?? categoryScores.salutationformat ?? 'N/A'} / {getCategoryTotalMarks('SalutationFormat', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</li>
                          <li><strong>Essay Total:</strong> {answerScore} / {answerMax}</li>
                        </ul>
                      </div>
                    )}

                    {sectionType === 'Comprehension' && (
                      <div className="comprehension-review">
                        <h4>Comprehension Review</h4>
                        <p><strong>Question:</strong> {answer.questionText}</p>
                        <p><strong>Correct Answer:</strong> {answer.correctAnswer || meta?.answer || meta?.sampleAnswer || 'N/A'}</p>
                        <p><strong>Marks Awarded:</strong> {answerScore} / {answerMax}</p>
                        <div className="comprehension-categories">
                          {Object.entries(categoryScores).map(([category, score]) => (
                            <p key={category}><strong>{getCategoryLabel(category)}:</strong> {score} / {getCategoryTotalMarks(category, answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {sectionType === 'Summary' && (
                      <div className="summary-review">
                        <h4>Summary Review</h4>
                        <p><strong>Student Summary:</strong></p>
                        <div className="answer-text">{answer.studentAnswer || '—'}</div>
                        <p><strong>Key Points Found:</strong></p>
                        {strengths.length > 0 ? (
                          <ul>{strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        ) : <p>Not available</p>}
                        <p><strong>Key Points Missing:</strong></p>
                        {missingPoints.length > 0 ? (
                          <ul>{missingPoints.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        ) : <p>Not available</p>}
                        <div className="summary-categories">
                          <p><strong>Language Quality Score:</strong> {categoryScores.Grammar ?? categoryScores.Expression ?? 'N/A'} / {getCategoryTotalMarks('Grammar', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</p>
                          <p><strong>Conciseness Score:</strong> {categoryScores.Completeness ?? categoryScores.Relevance ?? 'N/A'} / {getCategoryTotalMarks('Completeness', answer.aiReport?.categoryTotalMarks, answer.aiReport?.rubric)}</p>
                          <p><strong>Total Summary Score:</strong> {answerScore} / {answerMax}</p>
                        </div>
                      </div>
                    )}

                    {categoryFeedback && Object.keys(categoryFeedback).length > 0 && (
                      <div className="feedback-section">
                        <h4>Category Feedback</h4>
                        {Object.entries(categoryFeedback).map(([category, feedback]) => (
                          <div key={category} className="feedback-item">
                            <strong>{getCategoryLabel(category)}:</strong> <span>{feedback}</span>
                          </div>
                        ))}
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

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={onReview} className="btn-secondary">
            Back to Dashboard
          </button>
          <button onClick={onRetake} className="btn-primary">
            Retake Assessment
          </button>
        </div>

        {/* Footer */}
        <div className="result-footer">
          <p>Your answers have been marked by our AI system using WAEC/WASSCE standards.</p>
          <p>For any concerns, please contact your instructor.</p>
        </div>
      </div>
    </div>
  );
};

export default TheoryResultPage;
