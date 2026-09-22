import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './TheoryAnswerPage.css';

/**
 * TheoryAnswerPage Component
 * 
 * Displays theory questions (essay, comprehension, summary) for student to answer
 * Features:
 *  - Large, clear question/passage display
 *  - Rich text editor for answer input
 *  - Live word counter
 *  - Auto-save functionality
 *  - Time remaining display
 *  - Submit button
 * 
 * Props:
 *  - attemptId: String - ID of the assessment attempt
 *  - questions: Array - Theory questions to display
 *  - timeLimit: Number - Time limit in minutes
 *  - onSubmit: Function(answers) - Called when student submits
 *  - onBack: Function() - Called when user wants to go back
 */

const TheoryAnswerPage = ({ attemptId, questions, timeLimit, onSubmit, onBack }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60); // in seconds
  const [wordCounts, setWordCounts] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const [flatQuestions, setFlatQuestions] = useState([]);
  const [questionSections, setQuestionSections] = useState([]);

  // Normalize incoming questions prop into section-based groups and a flat question list.
  useEffect(() => {
    if (!Array.isArray(questions)) {
      setQuestionSections([]);
      setFlatQuestions([]);
      return;
    }

    const sections = [];

    questions.forEach(item => {
      const normalizedType = String(item.type || item.sectionName || '').toLowerCase();
      const isComprehension = normalizedType.includes('comprehension') || Array.isArray(item.questions);
      const isSummary = normalizedType.includes('summary') || Boolean(item.summary);
      const isEssay = normalizedType.includes('essay') || item.type === 'essay';

      if (item.summary && Array.isArray(item.summary.questions)) {
        sections.push({
          type: 'summary',
          sectionName: item.sectionName || 'Summary',
          passage: item.summary.passage || item.passage || item.passageText || item.passageBody || item.passageContent,
          instruction: item.summary.instruction || item.instruction,
          questions: item.summary.questions || []
        });
        return;
      }

      if (isComprehension) {
        sections.push({
          type: 'comprehension',
          sectionName: item.sectionName || 'Comprehension',
          passage: item.passage || item.passageText || item.passageBody || item.passageContent,
          instruction: item.instruction,
          questions: Array.isArray(item.questions) ? item.questions : [item]
        });
        return;
      }

      if (isEssay) {
        sections.push({
          type: 'essay',
          sectionName: item.sectionName || 'Essay',
          questions: Array.isArray(item.questions) ? item.questions : [item]
        });
        return;
      }

      sections.push({
        type: 'question',
        sectionName: item.sectionName || 'Question',
        questions: Array.isArray(item.questions) ? item.questions : [item]
      });
    });

    const flattened = [];
    sections.forEach((section, sectionIndex) => {
      (section.questions || []).forEach((question, questionIndex) => {
        flattened.push({
          ...question,
          sectionIndex,
          sectionQuestionIndex: questionIndex,
          sectionType: section.type,
          sectionName: section.sectionName,
          sectionPassage: section.passage,
          sectionInstruction: section.instruction
        });
      });
    });

    setQuestionSections(sections);
    setFlatQuestions(flattened);
    setCurrentQuestionIndex(0);
  }, [questions]);

  const currentQuestion = flatQuestions[currentQuestionIndex];
  const currentSection = questionSections[currentQuestion?.sectionIndex];
  const currentAnswer = answers[currentQuestionIndex] || '';
  const currentWordCount = wordCounts[currentQuestionIndex] || 0;

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      autoSaveAnswer();
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentQuestionIndex, answers]);

  // Auto-submit if time runs out
  useEffect(() => {
    if (timeLeft === 0) {
      handleSubmit();
    }
  }, [timeLeft]);

  const handleAnswerChange = (e) => {
    const newAnswer = e.target.value;
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: newAnswer
    }));

    // Count words
    const words = newAnswer.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCounts(prev => ({
      ...prev,
      [currentQuestionIndex]: words.length
    }));
  };

  const autoSaveAnswer = async () => {
    if (!attemptId || !currentAnswer) return;

    try {
      setIsSaving(true);
      const token = localStorage.getItem('authToken');
      
      await axios.post(
        `/api/assessments/${attemptId}/autosave`,
        {
          answer: currentAnswer,
          questionIndex: currentQuestionIndex,
          questionId: currentQuestion?.questionId || currentQuestion?.id,
          questionText: currentQuestion?.text || currentQuestion?.prompt || currentQuestion?.question || currentQuestion?.instruction,
          totalMarks: currentQuestion?.totalMarks,
          rubric: currentQuestion?.rubric || currentQuestion?.markingRubric,
          currentQuestionIndex
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);

      // Build answers array from state
      const submittedAnswers = flatQuestions.map((question, index) => ({
        questionIndex: index,
        questionId: question.questionId || question.id,
        studentAnswer: answers[index] || '',
        totalMarks: question.totalMarks,
        rubric: question.rubric || question.markingRubric || question.rubric,
        questionText: question.text || question.prompt || question.question || question.instruction
      }));

      if (onSubmit) {
        await onSubmit(submittedAnswers);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getExpectedWordCount = (question) => {
    // Based on WAEC-style theory expectations
    if (question.sectionName?.toLowerCase().includes('essay')) {
      return { min: 450, max: 700 };
    } else if (question.sectionName?.toLowerCase().includes('comprehension')) {
      return { min: 100, max: 250 };
    } else if (question.sectionName?.toLowerCase().includes('summary')) {
      return { min: 80, max: 150 };
    }
    return { min: 100, max: 300 };
  };

  const expectedWordCount = getExpectedWordCount(currentQuestion);

  const getQuestionType = (question) => {
    const sectionType = question.sectionType || question.sectionName;
    if (String(sectionType).toLowerCase().includes('essay')) {
      return 'Essay';
    } else if (String(sectionType).toLowerCase().includes('comprehension')) {
      return 'Comprehension';
    } else if (String(sectionType).toLowerCase().includes('summary')) {
      return 'Summary';
    }
    return 'Question';
  };

  const getSectionQuestionLabel = (section, question, index) => {
    if (!section) return `Q${index + 1}`;
    if (section.type === 'essay') {
      return 'Essay';
    }

    const id = String(question.id || question.questionId || '');
    const match = id.match(/_q(\d+[a-z]?)/i);
    if (match) {
      return `Q${match[1]}`;
    }

    return `Q${index + 1}`;
  };

  const answeredCount = Object.keys(answers).filter((key) => answers[key]?.trim().length > 0).length;
  const progressPercent = flatQuestions.length ? Math.round((answeredCount / flatQuestions.length) * 100) : 0;

  if (!currentQuestion) {
    return (
      <div className="theory-answer-page">
        <div className="no-questions">
          <p>No questions available.</p>
        </div>
      </div>
    );
  }

  const timeWarning = timeLeft < 300; // Less than 5 minutes

  return (
    <div className="theory-answer-page">
      {/* Header with timer and progress */}
      <div className={`page-header ${timeWarning ? 'time-warning' : ''}`}>
        <div className="header-left">
          <h1>Assessment Answer Page</h1>
          <p className="question-counter">
            Question {currentQuestionIndex + 1} of {flatQuestions.length}
          </p>
        </div>
        <div className="header-right">
          <div className={`timer ${timeWarning ? 'warning' : ''}`}>
            <span className="timer-label">Time Remaining:</span>
            <span className="timer-value">{formatTime(timeLeft)}</span>
          </div>
          {lastSaved && (
            <div className="save-indicator">
              <span className="save-text">
                Saved at {lastSaved.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="answer-container">
        {/* Question Section */}
        <div className="question-section">
          <div className="question-header">
            <h2>{getQuestionType(currentQuestion)}</h2>
            {currentQuestion.totalMarks && (
              <span className="marks-label">
                Total Marks: {currentQuestion.totalMarks}
              </span>
            )}
          </div>

          <div className="question-content">
            {/* Display section passage/instruction once for comprehension/summary */}
            {currentSection && ['comprehension', 'summary'].includes(currentSection.type) && currentQuestion.sectionQuestionIndex === 0 && (currentSection.passage || currentSection.instruction) && (
              <div className="passage-section">
                <h3>Passage</h3>
                {currentSection.instruction && (
                  <div className="instructions">
                    <strong>Instructions:</strong>
                    <p>{currentSection.instruction}</p>
                  </div>
                )}
                {currentSection.passage && (
                  <div className="passage-text">
                    {currentSection.passage}
                  </div>
                )}
              </div>
            )}

            {/* Display question text */}
            <div className="question-text">
              <h3>Question / Prompt</h3>
              <p>{currentQuestion.text || currentQuestion.prompt || currentQuestion.question || currentQuestion.instruction}</p>
            </div>

            {/* Display single-question instructions if available and not already shown by section */}
            {!['comprehension', 'summary'].includes(currentSection?.type) && currentQuestion.instruction && (
              <div className="instructions">
                <strong>Instructions:</strong>
                <p>{currentQuestion.instruction}</p>
              </div>
            )}

            {/* Word count expectation */}
            <div className="word-count-expectation">
              <p>
                <strong>Expected Length:</strong> {expectedWordCount.min} - {expectedWordCount.max} words
              </p>
            </div>
          </div>
        </div>

        {/* Answer Section */}
        <div className="answer-input-section">
          <div className="answer-header">
            <h3>Your Answer</h3>
            <div className="word-counter">
              <span className={`word-count ${
                currentWordCount < expectedWordCount.min ? 'below-min' :
                currentWordCount > expectedWordCount.max ? 'above-max' :
                'ok'
              }`}>
                {currentWordCount} words
              </span>
              <span className="expected">
                (Expected: {expectedWordCount.min}-{expectedWordCount.max})
              </span>
            </div>
          </div>

          <textarea
            value={currentAnswer}
            onChange={handleAnswerChange}
            placeholder={`Write your ${getQuestionType(currentQuestion).toLowerCase()} answer here. Minimum ${expectedWordCount.min} words recommended.`}
            className="answer-textarea"
            disabled={submitting}
          />

          {currentWordCount < expectedWordCount.min && (
            <div className="warning-message">
              ⚠️ Your answer is shorter than recommended. Consider adding more details.
            </div>
          )}
          {currentWordCount > expectedWordCount.max && (
            <div className="warning-message">
              ⚠️ Your answer is longer than recommended. Consider editing to be more concise.
            </div>
          )}
        </div>

        {/* Navigation and Action Buttons */}
        <div className="action-buttons">
          <button 
            onClick={() => {
              if (currentQuestionIndex > 0) {
                autoSaveAnswer();
                setCurrentQuestionIndex(currentQuestionIndex - 1);
              }
            }} 
            className="btn-secondary"
            disabled={currentQuestionIndex === 0 || submitting}
          >
            ← Previous Question
          </button>

          <div className="center-actions">
            {isSaving && (
              <span className="saving-indicator">Saving...</span>
            )}
            <button 
              onClick={autoSaveAnswer} 
              className="btn-tertiary"
              disabled={submitting || isSaving || !currentAnswer}
            >
              Save Answer
            </button>
          </div>

          {currentQuestionIndex < flatQuestions.length - 1 ? (
            <button 
              onClick={() => {
                autoSaveAnswer();
                setCurrentQuestionIndex(currentQuestionIndex + 1);
              }} 
              className="btn-secondary"
              disabled={submitting}
            >
              Next Question →
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          )}
        </div>

        {/* Question navigator */}
        <div className="question-navigator">
          <div className="navigator-header">
            <div className="navigator-item">
              <span className="navigator-label">Timer</span>
              <span className="navigator-value">{formatTime(timeLeft)}</span>
            </div>
            <div className="navigator-item">
              <span className="navigator-label">Progress</span>
              <span className="navigator-value">{answeredCount} / {flatQuestions.length} answered</span>
            </div>
            <div className="navigator-item navigator-submit">
              <span className="navigator-label">Submit</span>
              <button
                type="button"
                className="navigator-submit-btn"
                onClick={handleSubmit}
                disabled={submitting || flatQuestions.length === 0}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
          <h4>Questions</h4>
          <div className="question-sections">
            {questionSections.map((section, sectionIndex) => {
              const startIndex = questionSections.slice(0, sectionIndex).reduce((sum, item) => sum + (item.questions?.length || 0), 0);
              return (
                <div className="section-group" key={sectionIndex}>
                  <div className="section-title">{section.sectionName}</div>
                  <div className="section-buttons">
                    {section.questions.map((question, questionIndex) => {
                      const globalIndex = startIndex + questionIndex;
                      const label = getSectionQuestionLabel(section, question, questionIndex);
                      return (
                        <button
                          key={globalIndex}
                          onClick={() => {
                            autoSaveAnswer();
                            setCurrentQuestionIndex(globalIndex);
                          }}
                          className={`q-btn ${
                            globalIndex === currentQuestionIndex ? 'active' :
                            answers[globalIndex] ? 'answered' :
                            'unanswered'
                          }`}
                          title={`${section.sectionName} ${label}${answers[globalIndex] ? ' (answered)' : ''}`}
                        >
                          <span>{label}</span>
                          <span className={`q-status ${answers[globalIndex] ? 'answered' : 'unanswered'}`}>
                            {answers[globalIndex] ? 'Answered' : 'Not answered'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TheoryAnswerPage;
