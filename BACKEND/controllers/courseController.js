const { getModel } = require("../config/adapter");
const connectDB = require("../config/db");
require("../models/Quiz");

const getCourse = () => getModel("Course");

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
};

const normalizeLesson = (lesson) => {
  if (!lesson) return null;
  return {
    _id: lesson._id,
    title: lesson.title || "Untitled Lesson",
    videoUrl: lesson.videoUrl || lesson.url || lesson.src || "",
    sourceType: lesson.sourceType || "External",
    thumbnail: lesson.thumbnail || "",
    description: lesson.description || "",
    notes: lesson.notes || "",
    attachments: Array.isArray(lesson.attachments)
      ? lesson.attachments.map((attachment) => ({ title: attachment.title || "", url: attachment.url || "" }))
      : [],
    duration: lesson.duration || "00:00",
    order: lesson.order || 0,
  };
};

const normalizeSection = (section) => {
  if (!section) return null;
  const lessons = Array.isArray(section.lessons)
    ? section.lessons.map(normalizeLesson)
    : Array.isArray(section.videos)
      ? section.videos.map(normalizeLesson)
      : [];

  const resources = Array.isArray(section.resources)
    ? section.resources.map((resource) => ({ title: resource.title || "", url: resource.url || "" }))
    : [];

  const qa = Array.isArray(section.qa)
    ? section.qa.map((item) => ({ question: item.question || "", answer: item.answer || "" }))
    : [];

  const announcements = Array.isArray(section.announcements)
    ? section.announcements.map((item) => ({ title: item.title || "", message: item.message || "", date: item.date }))
    : [];

  const quizzes = Array.isArray(section.quizzes)
    ? section.quizzes.map((quiz) => ({
        quizId: quiz.quizId?._id || quiz.quizId,
        quizType: quiz.quizType || "quiz",
        duration: quiz.duration || 30,
        totalMarks: quiz.totalMarks || 20,
        passingScore: quiz.passingScore || 50,
        isActive: quiz.isActive !== false,
        quizData: quiz.quizId ? {
          _id: quiz.quizId._id,
          title: quiz.quizId.title,
          description: quiz.quizId.description,
          duration: quiz.quizId.duration,
          totalMarks: quiz.quizId.totalMarks,
          passingScore: quiz.quizId.passingScore,
          status: quiz.quizId.status,
          questionsCount: quiz.quizId.questions?.length || 0
        } : null
      }))
    : [];

  return {
    _id: section._id,
    title: section.title || "Section",
    description: section.description || "",
    objectives: Array.isArray(section.objectives) ? section.objectives : [],
    order: section.order || 0,
    lessons,
    videos: lessons,
    resources,
    qa,
    announcements,
    quizzes,
  };
};

const normalizeCourse = (course) => {
  const data = course.toObject ? course.toObject() : course;
  const students = Array.isArray(data.students) ? data.students : [];
  const sections = Array.isArray(data.sections) ? data.sections : [];

  const totalLessons = sections.reduce((sum, section) => {
    const lessons = Array.isArray(section.lessons)
      ? section.lessons
      : Array.isArray(section.videos)
        ? section.videos
        : [];
    return sum + lessons.length;
  }, 0);

  return {
    _id: data._id,
    title: data.title,
    description: data.description,
    thumbnail: data.thumbnail || "",
    subject: data.subject || "General Subjects",
    status: data.status || "draft",
    totalDuration: data.totalDuration || data.duration || "0h 0m",
    category: data.category || "IT",
    rating: data.rating ?? 4.7,
    price: toNumber(data.price, 0),
    level: data.level || "Beginner",
    instructor: {
      name: data.instructor?.name || "Instructor",
      avatar: data.instructor?.avatar || data.instructor?.photo || "",
      userId: data.instructor?.userId,
      bio: data.instructor?.bio || "",
    },
    sections: sections.map(normalizeSection),
    students,
    certificateEnabled: Boolean(data.certificateEnabled),
    enrollment: students.length,
    lectures: totalLessons,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const normalizeLessonInput = (lesson, index = 0) => ({
  title: lesson?.title || `Lesson ${index + 1}`,
  videoUrl: lesson?.videoUrl || lesson?.url || lesson?.src || "",
  sourceType: lesson?.sourceType || "External",
  thumbnail: lesson?.thumbnail || "",
  description: lesson?.description || "",
  notes: lesson?.notes || "",
  attachments: Array.isArray(lesson?.attachments)
    ? lesson.attachments.map((attachment) => ({ title: attachment.title || "", url: attachment.url || "" }))
    : [],
  duration: lesson?.duration || "00:00",
  order: lesson?.order ?? index + 1,
});

const normalizeSectionInput = (section, index = 0) => ({
  title: section?.title || `Section ${index + 1}`,
  description: section?.description || "",
  objectives: Array.isArray(section?.objectives) ? section.objectives.map((o) => String(o)) : [],
  order: section?.order ?? index + 1,
  lessons: Array.isArray(section?.lessons)
    ? section.lessons.map((lesson, lessonIndex) => normalizeLessonInput(lesson, lessonIndex))
    : Array.isArray(section?.videos)
      ? section.videos.map((lesson, lessonIndex) => normalizeLessonInput(lesson, lessonIndex))
      : [],
  resources: Array.isArray(section?.resources)
    ? section.resources.map((resource) => ({ title: resource.title || "", url: resource.url || "" }))
    : [],
  qa: Array.isArray(section?.qa)
    ? section.qa.map((item) => ({ question: item.question || "", answer: item.answer || "" }))
    : [],
  announcements: Array.isArray(section?.announcements)
    ? section.announcements.map((item) => ({ title: item.title || "", message: item.message || "", date: item.date || new Date() }))
    : [],
});

// Sanitize and validate objectives: trim, cast to string, limit count and length
const sanitizeObjectives = (arr = [], { maxCount = 8, maxLength = 200 } = {}) => {
  if (!Array.isArray(arr)) return [];
  const out = arr
    .map((o) => String(o || "").trim())
    .filter(Boolean)
    .map((s) => (s.length > maxLength ? s.slice(0, maxLength) : s));
  return out.slice(0, maxCount);
};

const normalizeCourseInput = (courseData = {}) => ({
  title: courseData.title || "Untitled Course",
  description: courseData.description || "",
  thumbnail: courseData.thumbnail || courseData.image || "",
  category: courseData.category || "IT",
  subject: courseData.subject || courseData.category || "General Subjects",
  status: courseData.status || "draft",
  price: toNumber(courseData.price, 0),
  level: courseData.level || "Beginner",
  totalDuration: courseData.totalDuration || courseData.duration || "0h 0m",
  certificateEnabled: Boolean(courseData.certificateEnabled),
  instructor: {
    name: courseData.instructor?.name || courseData.instructorName || "Instructor",
    avatar: courseData.instructor?.avatar || courseData.instructorAvatar || courseData.instructor?.photo || "",
    bio: courseData.instructor?.bio || courseData.instructorBio || "",
    userId: courseData.instructor?.userId,
  },
  sections: Array.isArray(courseData.sections)
    ? courseData.sections.map((section, index) => normalizeSectionInput(section, index))
    : Array.isArray(courseData.videos)
      ? courseData.videos.map((section, index) => normalizeSectionInput(section, index))
      : [],
  students: Array.isArray(courseData.students) ? courseData.students : [],
  rating: typeof courseData.rating === "number" ? courseData.rating : undefined,
});

const findCourseBySectionId = async (sectionId) => {
  const course = await getCourse().findOne({ "sections._id": sectionId });
  if (!course) return null;
  const section = course.sections.id(sectionId);
  return { course, section };
};

const findCourseByLessonId = async (lessonId) => {
  const course = await getCourse().findOne({ "sections.lessons._id": lessonId });
  if (!course) return null;
  let section = null;
  let lesson = null;
  course.sections.some((s) => {
    const found = s.lessons.id(lessonId);
    if (found) {
      section = s;
      lesson = found;
      return true;
    }
    return false;
  });
  return { course, section, lesson };
};

exports.addSection = async (req, res) => {
  try {
    const { title, order, lessons = [] } = req.body;
    const course = await getCourse().findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const rawObjectives = req.body.objectives;
    console.log('DEBUG addSection received objectives:', rawObjectives);
    const section = {
      title: title || `Section ${course.sections.length + 1}`,
      order: order ?? course.sections.length + 1,
      lessons: lessons.map(normalizeLessonInput),
      objectives: sanitizeObjectives(rawObjectives),
    };

    course.sections.push(section);
    await course.save();

    res.status(201).json({ message: "Section added", section: course.sections.at(-1) });
  } catch (err) {
    console.error("Add section error:", err);
    res.status(500).json({ message: "Server error adding section" });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const result = await findCourseBySectionId(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Section not found" });
    }

    const { course, section } = result;
    if (req.body.title !== undefined) section.title = req.body.title;
    if (req.body.order !== undefined) section.order = req.body.order;
    if (req.body.objectives !== undefined) {
      console.log('DEBUG updateSection incoming objectives:', req.body.objectives);
      const sanitized = sanitizeObjectives(req.body.objectives);
      console.log('DEBUG updateSection sanitized objectives:', sanitized);
      section.objectives = sanitized;
    }
    if (Array.isArray(req.body.lessons)) {
      section.lessons = req.body.lessons.map(normalizeLessonInput);
    }

    console.log('DEBUG updateSection before save, section.objectives:', section.objectives);
    await course.save();
    try {
      const fresh = await getCourse().findById(course._id).lean();
      const freshSection = Array.isArray(fresh.sections) ? fresh.sections.find((s) => String(s._id) === String(section._id)) : null;
      console.log('DEBUG updateSection after save, freshSection.objectives:', freshSection ? freshSection.objectives : 'not found');
    } catch (e) {
      console.error('DEBUG updateSection reload error:', e.message);
    }

    res.json({ message: "Section updated", section });
  } catch (err) {
    console.error("Update section error:", err);
    res.status(500).json({ message: "Server error updating section" });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const result = await findCourseBySectionId(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Section not found" });
    }

    const { course } = result;
    course.sections.id(req.params.id).remove();
    await course.save();

    res.json({ message: "Section deleted" });
  } catch (err) {
    console.error("Delete section error:", err);
    res.status(500).json({ message: "Server error deleting section" });
  }
};

exports.addLesson = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { title, videoUrl, sourceType, thumbnail, description, notes, attachments, duration, order } = req.body;

    const result = await findCourseBySectionId(sectionId);
    if (!result) {
      return res.status(404).json({ message: "Section not found" });
    }

    const { course, section } = result;
    const lesson = normalizeLessonInput({ title, videoUrl, sourceType, thumbnail, description, notes, attachments, duration, order }, section.lessons.length);
    section.lessons.push(lesson);
    await course.save();

    res.status(201).json({ message: "Lesson added", lesson: section.lessons.at(-1) });
  } catch (err) {
    console.error("Add lesson error:", err);
    res.status(500).json({ message: "Server error adding lesson" });
  }
};

exports.updateLesson = async (req, res) => {
  try {
    const result = await findCourseByLessonId(req.params.id);
    if (!result || !result.lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const { course, lesson } = result;
    if (req.body.title !== undefined) lesson.title = req.body.title;
    if (req.body.videoUrl !== undefined) lesson.videoUrl = req.body.videoUrl;
    if (req.body.sourceType !== undefined) lesson.sourceType = req.body.sourceType;
    if (req.body.thumbnail !== undefined) lesson.thumbnail = req.body.thumbnail;
    if (req.body.description !== undefined) lesson.description = req.body.description;
    if (req.body.notes !== undefined) lesson.notes = req.body.notes;
    if (Array.isArray(req.body.attachments)) lesson.attachments = req.body.attachments.map((attachment) => ({ title: attachment.title || "", url: attachment.url || "" }));
    if (req.body.duration !== undefined) lesson.duration = req.body.duration;
    if (req.body.order !== undefined) lesson.order = req.body.order;

    await course.save();
    res.json({ message: "Lesson updated", lesson });
  } catch (err) {
    console.error("Update lesson error:", err);
    res.status(500).json({ message: "Server error updating lesson" });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const result = await findCourseByLessonId(req.params.id);
    if (!result || !result.lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const { course, section } = result;
    section.lessons.id(req.params.id).remove();
    await course.save();

    res.json({ message: "Lesson deleted" });
  } catch (err) {
    console.error("Delete lesson error:", err);
    res.status(500).json({ message: "Server error deleting lesson" });
  }
};

/* =========================
   CREATE COURSE (ADMIN)
========================= */
exports.createCourse = async (req, res) => {
  try {
    let courseData = req.body;
    if (typeof req.body.courseData === "string") {
      courseData = JSON.parse(req.body.courseData);
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    if (uploadedFiles.length > 0 && Array.isArray(courseData.sections)) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      uploadedFiles.forEach((file) => {
        const [prefix, sectionIndex, resourceIndex] = file.fieldname.split("-");
        if (prefix === "resourceFile") {
          const section = courseData.sections[Number(sectionIndex)];
          if (section && Array.isArray(section.resources)) {
            const resource = section.resources[Number(resourceIndex)];
            if (resource) {
              resource.url = `${baseUrl}/uploads/resources/${file.filename}`;
              if (!resource.title) resource.title = file.originalname;
            }
          }
        }
      });
    }

    const normalizedCourse = normalizeCourseInput(courseData);
    if (!normalizedCourse.title || !normalizedCourse.description || !normalizedCourse.sections.length) {
      return res.status(400).json({
        message: "Title, description, and at least one section with lessons are required",
      });
    }

    const instructor = {
      name: courseData.instructor?.name || "Instructor",
      avatar: courseData.instructor?.avatar || courseData.instructor?.photo || "",
      userId: req.user.id,
    };

    const course = await getCourse().create({
      ...normalizedCourse,
      instructor,
    });

    res.status(201).json({
      message: "Course created successfully",
      course: normalizeCourse(course),
    });
  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ message: "Server error creating course", error: err.message });
  }
};

/* =========================
   GET ALL COURSES
========================= */
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await getCourse().find().populate({
      path: 'sections.quizzes.quizId',
      model: 'Quiz'
    });

    res.json({
      message: "Courses fetched successfully",
      courses: courses.map(normalizeCourse),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching courses" });
  }
};

/* =========================
   GET SINGLE COURSE
========================= */
exports.getCourseById = async (req, res) => {
  try {
    const course = await getCourse().findById(req.params.id).populate({
      path: 'sections.quizzes.quizId',
      model: 'Quiz'
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Public view: do not expose full lesson lists to unauthenticated users,
    // but include a single preview lesson (first lesson of first section)
    const publicCourse = normalizeCourse(course);
    // Build preview sections with all lesson metadata, but expose only the first lesson video URL.
    publicCourse.sections = (course.sections || []).map((origSection, sIdx) => {
      const normSection = publicCourse.sections?.[sIdx] || {};
      const sourceLessons = Array.isArray(origSection.lessons)
        ? origSection.lessons
        : Array.isArray(origSection.videos)
          ? origSection.videos
          : [];
      const lessons = sourceLessons.map((lesson, lessonIndex) => ({
        _id: lesson._id,
        title: lesson.title || `Lesson ${lessonIndex + 1}`,
        videoUrl: sIdx === 0 && lessonIndex === 0 ? (lesson.videoUrl || lesson.url || lesson.src || "") : "",
        sourceType: lesson.sourceType || "External",
        thumbnail: lesson.thumbnail || "",
        description: lesson.description || "",
        notes: lesson.notes || "",
        attachments: Array.isArray(lesson.attachments)
          ? lesson.attachments.map((attachment) => ({ title: attachment.title || "", url: attachment.url || "" }))
          : [],
        duration: lesson.duration || "00:00",
        order: lesson.order || lessonIndex + 1,
      }));

      return {
        _id: normSection._id || origSection._id,
        title: normSection.title || origSection.title,
        order: normSection.order ?? origSection.order,
        objectives: normSection.objectives || origSection.objectives || [],
        quizzes: normSection.quizzes || [],
        announcements: normSection.announcements || [],
        lessons,
      };
    });

    res.json(publicCourse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Return full course content for protected routes
exports.getCourseContent = async (req, res) => {
  try {
    const Course = getCourse();
    let query = Course.findById(req.params.id);
    
    // Safely attempt to populate if method exists (mongoose only, not mock models)
    if (typeof query.populate === 'function') {
      try {
        query = query.populate({
          path: 'sections.quizzes.quizId',
          model: 'Quiz'
        });
      } catch (popErr) {
        // Silently continue if populate fails; it's optional for mock models
        console.warn('Populate failed (expected for mock models):', popErr.message);
      }
    }
    
    const course = await query;

    if (!course) return res.status(404).json({ message: 'Course not found' });

    res.json({ message: 'Course content', course: normalizeCourse(course) });
  } catch (err) {
    console.error('getCourseContent error:', err);
    res.status(500).json({ message: 'Server error loading course content' });
  }
};

/* =========================
   UPDATE COURSE (ADMIN)
========================= */
exports.updateCourse = async (req, res) => {
  try {
    const updatedData = normalizeCourseInput(req.body);
    console.log('DEBUG updateCourse normalized sections:', JSON.stringify(updatedData.sections, null, 2));
    const updated = await getCourse().findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({
      message: "Course updated successfully",
      course: normalizeCourse(updated),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   DELETE COURSE (ADMIN)
========================= */
exports.deleteCourse = async (req, res) => {
  try {
    const deletedCourse = await getCourse().findByIdAndDelete(req.params.id);

    if (!deletedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   ENROLL STUDENT
========================= */
exports.enrollCourse = async (req, res) => {
  try {
    const course = await getCourse().findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.students) course.students = [];
    const alreadyEnrolled = course.students.includes(req.user.id);

    if (!alreadyEnrolled) {
      course.students.push(req.user.id);
      await getCourse().findByIdAndUpdate(req.params.id, { students: course.students });
    }

    res.json({
      message: "Enrolled successfully",
      course: normalizeCourse(course),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error enrolling course" });
  }
};