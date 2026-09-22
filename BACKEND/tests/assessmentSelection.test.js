const test = require('node:test');
const assert = require('node:assert/strict');
const { selectAssessmentForStudent } = require('../utils/assessmentSelection');

test('prefers published assessments over drafts for student delivery', () => {
  const published = {
    _id: 'pub-1',
    status: 'published',
    visibility: true,
    updatedAt: '2024-01-02T00:00:00.000Z',
    parts: [{ totalQuestions: 5 }],
  };
  const draft = {
    _id: 'draft-1',
    status: 'draft',
    visibility: true,
    updatedAt: '2024-01-03T00:00:00.000Z',
    parts: [{ totalQuestions: 10 }],
  };

  assert.equal(selectAssessmentForStudent([draft, published])._id, 'pub-1');
});

test('falls back to the latest visible assessment when no published assessment exists', () => {
  const olderDraft = {
    _id: 'draft-old',
    status: 'draft',
    visibility: true,
    updatedAt: '2024-01-01T00:00:00.000Z',
    parts: [{ totalQuestions: 2 }],
  };
  const newerDraft = {
    _id: 'draft-new',
    status: 'draft',
    visibility: true,
    updatedAt: '2024-01-03T00:00:00.000Z',
    parts: [{ totalQuestions: 5 }],
  };

  assert.equal(selectAssessmentForStudent([olderDraft, newerDraft])._id, 'draft-new');
});
