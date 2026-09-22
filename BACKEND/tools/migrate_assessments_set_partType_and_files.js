const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Assessment } = require('../models/Assessment');
const { getSectionFileCandidates, findQuestionDirectory, normalizeSubjectKey } = require('../utils/examLoader');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/esnex_learning';

const findFileRecursively = async (startDir, targetFileName) => {
  try {
    const entries = await fs.promises.readdir(startDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(startDir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetFileName.toLowerCase()) {
        return entryPath;
      }
      if (entry.isDirectory()) {
        const found = await findFileRecursively(entryPath, targetFileName);
        if (found) return found;
      }
    }
  } catch (err) {
    return null;
  }
  return null;
};

const capitalizePartType = (t) => {
  if (!t) return 'Objective';
  const cleaned = String(t).trim().toLowerCase();
  if (cleaned === 'objective') return 'Objective';
  if (cleaned === 'theory') return 'Theory';
  if (cleaned === 'oral') return 'Oral';
  if (cleaned === 'practical' || cleaned === 'pratical') return 'Practical';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

(async () => {
  await mongoose.connect(mongoUri);
  console.log('Connected to Mongo');

  const assessments = await Assessment.find({ type: 'global', subject: { $regex: new RegExp('^english$', 'i') } });
  if (!assessments.length) {
    console.log('No English global assessments found.');
    await mongoose.disconnect();
    return;
  }

  for (const ass of assessments) {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `assessment_backup_${ass._id}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(ass.toObject(), null, 2), 'utf8');
    console.log('Backed up assessment to', backupPath);

    const normalized = normalizeSubjectKey(ass.subject || 'english');
    let changed = false;

    const updatedParts = [];
    for (const part of (ass.parts || [])) {
      const newPart = JSON.parse(JSON.stringify(part));
      if (!newPart.partType) {
        if (newPart.partName && /essay|summary|comprehension/i.test(newPart.partName)) {
          newPart.partType = 'Theory';
        } else if (newPart.partName && /oral/i.test(newPart.partName)) {
          newPart.partType = 'Oral';
        } else {
          newPart.partType = 'Objective';
        }
        changed = true;
      } else {
        const cap = capitalizePartType(newPart.partType);
        if (cap !== newPart.partType) {
          newPart.partType = cap;
          changed = true;
        }
      }

      const updatedSections = [];
      for (const section of (newPart.sections || [])) {
        const newSection = JSON.parse(JSON.stringify(section));
        if (!newSection.files || !Array.isArray(newSection.files) || newSection.files.length === 0) {
          const candidates = getSectionFileCandidates(newSection);
          let found = false;
          let basePath = null;
          try {
            basePath = await findQuestionDirectory(normalized, newPart.partType.toLowerCase(), candidates);
          } catch (err) {
            basePath = null;
          }

          if (!basePath) {
            newSection.files = ['questions.json'];
            changed = true;
            updatedSections.push(newSection);
            continue;
          }

          for (const cand of candidates) {
            try {
              const directPath = path.join(basePath, cand);
              if (fs.existsSync(directPath)) {
                newSection.files = [cand];
                found = true;
                changed = true;
                break;
              }
              const recPath = await findFileRecursively(basePath, cand);
              if (recPath) {
                const rel = path.relative(basePath, recPath).replace(/\\/g, '/');
                newSection.files = [rel];
                found = true;
                changed = true;
                break;
              }
            } catch (err) {
              // ignore
            }
          }

          if (!found) {
            newSection.files = ['questions.json'];
            changed = true;
          }
        }
        updatedSections.push(newSection);
      }

      newPart.sections = updatedSections;
      updatedParts.push(newPart);
    }

    if (changed) {
      // apply update
      await Assessment.updateOne({ _id: ass._id }, { $set: { parts: updatedParts } });
      console.log('Updated assessment', ass._id);
    } else {
      console.log('No changes required for', ass._id);
    }
  }

  await mongoose.disconnect();
  console.log('Migration complete and disconnected.');
})();
