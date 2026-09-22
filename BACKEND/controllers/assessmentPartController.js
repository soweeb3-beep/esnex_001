const { Assessment } = require("../models/Assessment");

/**
 * Get assessment parts structure
 */
exports.getAssessmentParts = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    res.json({ parts: assessment.parts || [] });
  } catch (error) {
    console.error("Get assessment parts error", error);
    res.status(500).json({ message: "Unable to fetch assessment parts" });
  }
};

/**
 * Update a single part of an assessment
 */
exports.updateAssessmentPart = async (req, res) => {
  try {
    const { assessmentId, partIndex } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const index = parseInt(partIndex, 10);
    if (isNaN(index) || index < 0 || index >= assessment.parts.length) {
      return res.status(400).json({ message: "Invalid part index" });
    }

    const { partName, partType, duration, totalQuestions, instructions, sections } = req.body;
    const updatedPart = { ...assessment.parts[index] };

    if (partName) updatedPart.partName = partName;
    if (partType) updatedPart.partType = partType;

    if (duration !== undefined) {
      const parsedDuration = parseInt(duration, 10);
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return res.status(400).json({ message: "Part duration must be a positive integer." });
      }
      updatedPart.duration = parsedDuration;
    }

    if (totalQuestions !== undefined) {
      const parsedQuestions = parseInt(totalQuestions, 10);
      if (!Number.isFinite(parsedQuestions) || parsedQuestions < 0) {
        return res.status(400).json({ message: "Part total questions must be a valid non-negative integer." });
      }
      updatedPart.totalQuestions = parsedQuestions;
    }

    if (instructions !== undefined) updatedPart.instructions = instructions;
    if (sections && Array.isArray(sections)) updatedPart.sections = sections;

    if (Array.isArray(updatedPart.sections) && updatedPart.sections.length > 0) {
      const sectionTotal = updatedPart.sections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
      if (sectionTotal !== updatedPart.totalQuestions) {
        return res.status(400).json({ message: "Section questions must equal the part total questions." });
      }
    }

    assessment.parts[index] = updatedPart;

    await assessment.save();
    res.json({ part: assessment.parts[index], message: "Part updated successfully" });
  } catch (error) {
    console.error("Update assessment part error", error);
    res.status(500).json({ message: "Unable to update assessment part" });
  }
};

/**
 * Create a new part in an assessment
 */
exports.createAssessmentPart = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const { partName, partType, duration, totalQuestions, instructions, sections } = req.body;

    if (!partName || !partType) {
      return res.status(400).json({ message: "Part name and type are required" });
    }

    if (duration === undefined || totalQuestions === undefined) {
      return res.status(400).json({ message: "Part duration and total questions are required." });
    }

    const parsedDuration = parseInt(duration, 10);
    const parsedQuestions = parseInt(totalQuestions, 10);

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({ message: "Part duration must be a positive integer." });
    }

    if (!Number.isFinite(parsedQuestions) || parsedQuestions < 0) {
      return res.status(400).json({ message: "Total questions must be a valid non-negative integer." });
    }

    const newPart = {
      partName,
      partType,
      duration: parsedDuration,
      totalQuestions: parsedQuestions,
      instructions: instructions || "",
      sections: Array.isArray(sections) ? sections : [],
    };

    if (Array.isArray(newPart.sections) && newPart.sections.length > 0) {
      const sectionTotal = newPart.sections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0);
      if (sectionTotal !== newPart.totalQuestions) {
        return res.status(400).json({ message: "Section questions must equal the part total questions." });
      }
    }

    assessment.parts.push(newPart);
    assessment.allowedParts = assessment.parts.map((part) => part.partName);
    assessment.totalQuestions = assessment.parts.reduce((sum, part) => sum + (part.totalQuestions || 0), 0);

    await assessment.save();
    res.status(201).json({ part: newPart, message: "Part created successfully" });
  } catch (error) {
    console.error("Create assessment part error", error);
    res.status(500).json({ message: "Unable to create assessment part" });
  }
};

/**
 * Delete a part from an assessment
 */
exports.deleteAssessmentPart = async (req, res) => {
  try {
    const { assessmentId, partIndex } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const index = parseInt(partIndex, 10);
    if (isNaN(index) || index < 0 || index >= assessment.parts.length) {
      return res.status(400).json({ message: "Invalid part index" });
    }

    assessment.parts.splice(index, 1);
    assessment.allowedParts = assessment.parts.map((part) => part.partName);
    assessment.totalQuestions = assessment.parts.reduce((sum, part) => sum + (part.totalQuestions || 0), 0);

    await assessment.save();
    res.json({ message: "Part deleted successfully", parts: assessment.parts });
  } catch (error) {
    console.error("Delete assessment part error", error);
    res.status(500).json({ message: "Unable to delete assessment part" });
  }
};

/**
 * Add a section to a part
 */
exports.addSectionToPart = async (req, res) => {
  try {
    const { assessmentId, partIndex } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const index = parseInt(partIndex, 10);
    if (isNaN(index) || index < 0 || index >= assessment.parts.length) {
      return res.status(400).json({ message: "Invalid part index" });
    }

    const { name, questionCount, totalMarks, bankPath, instructions } = req.body;

    if (!name || questionCount === undefined) {
      return res.status(400).json({ message: "Section name and question count are required" });
    }

    // Validate that adding this section doesn't exceed part's totalQuestions
    const currentSectionQuestions = (assessment.parts[index].sections || []).reduce(
      (sum, sec) => sum + (sec.questionCount || 0),
      0
    );
    const newSectionQuestionCount = parseInt(questionCount, 10);
    const totalAfterAdd = currentSectionQuestions + newSectionQuestionCount;

    if (totalAfterAdd > assessment.parts[index].totalQuestions) {
      return res.status(400).json({
        message: `Section questions (${totalAfterAdd}) exceed part total (${assessment.parts[index].totalQuestions})`,
      });
    }

    const newSection = {
      name,
      questionCount: newSectionQuestionCount,
      bankPath: bankPath || "",
      instructions: instructions || "",
      questionsPerPage: 1,
    };

    assessment.parts[index].sections.push(newSection);
    await assessment.save();
    res.status(201).json({ section: newSection, message: "Section added successfully" });
  } catch (error) {
    console.error("Add section to part error", error);
    res.status(500).json({ message: "Unable to add section" });
  }
};

/**
 * Update a section within a part
 */
exports.updateSectionInPart = async (req, res) => {
  try {
    const { assessmentId, partIndex, sectionIndex } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const partIdx = parseInt(partIndex, 10);
    const sectionIdx = parseInt(sectionIndex, 10);

    if (isNaN(partIdx) || partIdx < 0 || partIdx >= assessment.parts.length) {
      return res.status(400).json({ message: "Invalid part index" });
    }

    if (isNaN(sectionIdx) || sectionIdx < 0 || sectionIdx >= assessment.parts[partIdx].sections.length) {
      return res.status(400).json({ message: "Invalid section index" });
    }

    const { name, questionCount, bankPath, instructions } = req.body;
    const section = assessment.parts[partIdx].sections[sectionIdx];
    const part = assessment.parts[partIdx];

    // If updating question count, validate against part total
    if (questionCount !== undefined) {
      const newCount = parseInt(questionCount, 10);
      const currentSectionQuestions = (part.sections || []).reduce(
        (sum, sec, idx) => (idx === sectionIdx ? sum : sum + (sec.questionCount || 0)),
        0
      );
      const totalAfterUpdate = currentSectionQuestions + newCount;

      if (totalAfterUpdate > part.totalQuestions) {
        return res.status(400).json({
          message: `Section questions (${totalAfterUpdate}) exceed part total (${part.totalQuestions})`,
        });
      }
      section.questionCount = newCount;
    }

    if (name !== undefined) section.name = name;
    if (bankPath !== undefined) section.bankPath = bankPath;
    if (instructions !== undefined) section.instructions = instructions;

    await assessment.save();
    res.json({ section, message: "Section updated successfully" });
  } catch (error) {
    console.error("Update section in part error", error);
    res.status(500).json({ message: "Unable to update section" });
  }
};

/**
 * Delete a section from a part
 */
exports.deleteSectionFromPart = async (req, res) => {
  try {
    const { assessmentId, partIndex, sectionIndex } = req.params;
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const partIdx = parseInt(partIndex, 10);
    const sectionIdx = parseInt(sectionIndex, 10);

    if (isNaN(partIdx) || partIdx < 0 || partIdx >= assessment.parts.length) {
      return res.status(400).json({ message: "Invalid part index" });
    }

    if (isNaN(sectionIdx) || sectionIdx < 0 || sectionIdx >= assessment.parts[partIdx].sections.length) {
      return res.status(400).json({ message: "Invalid section index" });
    }

    assessment.parts[partIdx].sections.splice(sectionIdx, 1);
    await assessment.save();
    res.json({ message: "Section deleted successfully", sections: assessment.parts[partIdx].sections });
  } catch (error) {
    console.error("Delete section from part error", error);
    res.status(500).json({ message: "Unable to delete section" });
  }
};
