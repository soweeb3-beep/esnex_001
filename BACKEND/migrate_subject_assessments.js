require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { Assessment } = require('./models/Assessment');
const { getSubjectConfig, normalizeSubjectKey } = require('./utils/examLoader');

const buildGlobalAssessmentParts = (subjectConfig) => {
  const parts = [];

  if (subjectConfig.objective?.parts?.length) {
    const sections = subjectConfig.objective.parts.map((section) => ({
      name: section.name || 'Section',
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? undefined,
      bankPath: section.bankPath || '',
      instructions: section.instructions || '',
    }));

    parts.push({
      partName: 'Objective',
      partType: 'Objective',
      title: 'Objective',
      type: 'objective',
      duration: subjectConfig.timeLimit,
      totalMarks: subjectConfig.objective.totalMarks,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
      randomizeQuestions: true,
      markingEnabled: true,
      instructions: subjectConfig.objective.instructions || '',
    });
  }

  if (subjectConfig.theory?.types?.length) {
    const sections = subjectConfig.theory.types.map((section) => ({
      name: section.name || 'Theory',
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? undefined,
      bankPath: section.bankPath || '',
      instructions: section.instructions || '',
    }));

    parts.push({
      partName: 'Theory',
      partType: 'Theory',
      title: 'Theory',
      type: 'theory',
      duration: subjectConfig.timeLimit,
      totalMarks: subjectConfig.theory.totalMarks,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
      randomizeQuestions: true,
      markingEnabled: true,
      instructions: subjectConfig.theory.instructions || '',
    });
  }

  if (subjectConfig.practical?.sections?.length) {
    const sections = subjectConfig.practical.sections.map((section) => ({
      name: section.name || 'Practical',
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? undefined,
      bankPath: section.bankPath || '',
      instructions: section.instructions || '',
    }));

    parts.push({
      partName: 'Practical',
      partType: 'Practical',
      title: 'Practical',
      type: 'practical',
      duration: subjectConfig.timeLimit,
      totalMarks: subjectConfig.practical.totalMarks,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
      randomizeQuestions: true,
      markingEnabled: true,
      instructions: subjectConfig.practical.instructions || '',
    });
  }

  if (subjectConfig.oral?.sections?.length) {
    const sections = subjectConfig.oral.sections.map((section) => ({
      name: section.name || 'Oral',
      questionCount: section.questionCount ?? section.count,
      totalMarks: section.marks ?? undefined,
      bankPath: section.bankPath || '',
      instructions: section.instructions || '',
    }));

    parts.push({
      partName: 'Oral',
      partType: 'Oral',
      title: 'Oral',
      type: 'oral',
      duration: subjectConfig.timeLimit,
      totalMarks: subjectConfig.oral.totalMarks,
      totalQuestions: sections.reduce((sum, section) => sum + (section.questionCount ?? 0), 0),
      sections,
      randomizeQuestions: true,
      markingEnabled: true,
      instructions: subjectConfig.oral.instructions || '',
    });
  }

  return parts;
};

const runMigration = async () => {
  try {
    await connectDB();
    if (!connectDB.isMongoConnected?.()) {
      console.error('MongoDB is not connected. Aborting migration.');
      process.exit(1);
    }

    const assessments = await Assessment.find({ type: 'global' });
    if (!assessments.length) {
      console.log('No global assessments found. Nothing to migrate.');
      process.exit(0);
    }

    console.log(`Found ${assessments.length} global assessment(s).`);
    let migratedCount = 0;

    for (const assessment of assessments) {
      const normalizedSubject = normalizeSubjectKey(assessment.subject);
      const subjectConfig = normalizedSubject ? await getSubjectConfig(normalizedSubject) : null;

      if (!normalizedSubject || !subjectConfig) {
        console.warn(`Skipping assessment ${assessment._id}: subject '${assessment.subject}' is not mapped in questions config.`);
        continue;
      }

      const parts = buildGlobalAssessmentParts(subjectConfig);
      const totalQuestions = parts.reduce((sum, part) => sum + (part.totalQuestions ?? 0), 0);
      const allowedParts = parts.map((_, index) => String.fromCharCode(65 + index));

      const needsUpdate =
        !assessment.parts ||
        !assessment.parts.length ||
        assessment.parts.some((part) => typeof part.totalQuestions !== 'number' || part.totalQuestions === 0) ||
        assessment.allowedParts?.length !== allowedParts.length ||
        assessment.totalQuestions !== totalQuestions;

      if (!needsUpdate) {
        console.log(`Skipping ${assessment._id} (${normalizedSubject}): already up to date.`);
        continue;
      }

      const updates = {
        parts,
        allowedParts,
        totalQuestions,
      };

      if (!assessment.duration && subjectConfig.timeLimit) {
        updates.duration = subjectConfig.timeLimit;
      }
      if (!assessment.totalMarks && subjectConfig.totalMarks) {
        updates.totalMarks = subjectConfig.totalMarks;
      }
      if (!assessment.passingScore && subjectConfig.passingScore) {
        updates.passingScore = subjectConfig.passingScore;
      }

      await Assessment.updateOne({ _id: assessment._id }, updates, { runValidators: true });
      console.log(`Migrated ${assessment._id} (${normalizedSubject}) → ${parts.length} part(s), ${totalQuestions} questions.`);
      migratedCount += 1;
    }

    console.log(`Migration complete. Updated ${migratedCount} assessment(s).`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

runMigration();
