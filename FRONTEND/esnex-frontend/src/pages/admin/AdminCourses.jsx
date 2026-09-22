import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import { useWindowSize, tableHeader, tableCell, inputStyle, buttonStyle } from "./adminUtils";

const createDefaultCourseState = () => ({
  title: "",
  subject: "General Subjects",
  category: "IT",
  status: "draft",
  description: "",
  thumbnail: "",
  price: "0",
  totalDuration: "0h 0m",
  level: "Beginner",
  certificateEnabled: false,
  instructorName: "",
  instructorAvatar: "",
  instructorBio: "",
  sections: [
    {
      title: "Section 1",
      description: "",
      order: 1,
      lessons: [
        {
          title: "Lesson 1",
          description: "",
          videoUrl: "",
          sourceType: "External",
          thumbnail: "",
          duration: "00:00",
          order: 1,
          notes: "",
          attachments: [],
        },
      ],
      resources: [],
      qa: [],
        announcements: [],
        objectives: [],
    },
  ],
});

const normalizeCourseForm = (course) => ({
  title: course.title || "",
  subject: course.subject || course.category || "General Subjects",
  category: course.category || "IT",
  status: course.status || "draft",
  description: course.description || "",
  thumbnail: course.thumbnail || "",
  price: String(course.price ?? 0),
  totalDuration: course.totalDuration || course.duration || "0h 0m",
  level: course.level || "Beginner",
  certificateEnabled: Boolean(course.certificateEnabled),
  instructorName: course.instructor?.name || "",
  instructorAvatar: course.instructor?.avatar || "",
  instructorBio: course.instructor?.bio || "",
  sections: Array.isArray(course.sections)
    ? course.sections.map((section) => ({
        title: section.title || "Section",
        description: section.description || "",
    objectives: Array.isArray(section.objectives) ? section.objectives : [],
        order: section.order || 1,
        lessons: Array.isArray(section.lessons)
          ? section.lessons.map((lesson) => ({
              title: lesson.title || "Lesson",
              description: lesson.description || "",
              videoUrl: lesson.videoUrl || "",
              sourceType: lesson.sourceType || "External",
              thumbnail: lesson.thumbnail || "",
              duration: lesson.duration || "00:00",
              order: lesson.order || 1,
              notes: lesson.notes || "",
              attachments: Array.isArray(lesson.attachments)
                ? lesson.attachments.map((attachment) => ({ title: attachment.title || "", url: attachment.url || "" }))
                : [],
            }))
          : [],
        resources: Array.isArray(section.resources)
          ? section.resources.map((resource) => ({ title: resource.title || "", url: resource.url || "" }))
          : [],
        qa: Array.isArray(section.qa) ? section.qa : [],
        announcements: Array.isArray(section.announcements) ? section.announcements : [],
        objectives: Array.isArray(section.objectives) ? section.objectives : [],
      }))
    : [],
});

export default function AdminCourses() {
  const { width: windowWidth } = useWindowSize();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [formState, setFormState] = useState(createDefaultCourseState());
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const res = await API.get("/courses");
        setCourses(res.data.courses || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      course.title?.toLowerCase().includes(query) ||
      course.category?.toLowerCase().includes(query) ||
      course.subject?.toLowerCase().includes(query) ||
      course._id?.toString().includes(query)
    );
  }, [searchTerm, courses]);

  const openCreateForm = () => {
    setFormMode("create");
    setActiveCourseId(null);
    setFormState(createDefaultCourseState());
    setShowForm(true);
  };

  const openEditForm = (course) => {
    setFormMode("edit");
    setActiveCourseId(course._id);
    setFormState(normalizeCourseForm(course));
    setShowForm(true);
  };

  const updateFormField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const updateSectionField = (sectionIndex, key, value) => {
    setFormState((prev) => {
      const sections = [...prev.sections];
      sections[sectionIndex] = { ...sections[sectionIndex], [key]: value };
      return { ...prev, sections };
    });
  };

  const updateSectionObjectives = (sectionIndex, text) => {
    const arr = String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    updateSectionField(sectionIndex, "objectives", arr);
  };

  const updateLessonField = (sectionIndex, lessonIndex, key, value) => {
    setFormState((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      const lessons = [...section.lessons];
      lessons[lessonIndex] = { ...lessons[lessonIndex], [key]: value };
      section.lessons = lessons;
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  };

  const addSection = () => {
    setFormState((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          title: `Section ${prev.sections.length + 1}`,
          description: "",
          order: prev.sections.length + 1,
          lessons: [
            {
              title: "Lesson 1",
              description: "",
              videoUrl: "",
              sourceType: "External",
              thumbnail: "",
              duration: "00:00",
              order: 1,
              notes: "",
              attachments: [],
            },
          ],
          resources: [],
          qa: [],
          announcements: [],
        },
      ],
    }));
  };

  const removeSection = (sectionIndex) => {
    setFormState((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex).map((section, index) => ({ ...section, order: index + 1 })),
    }));
  };

  const addLesson = (sectionIndex) => {
    setFormState((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      const lessons = [
        ...section.lessons,
        {
          title: `Lesson ${section.lessons.length + 1}`,
          description: "",
          videoUrl: "",
          sourceType: "External",
          thumbnail: "",
          duration: "00:00",
          order: section.lessons.length + 1,
          notes: "",
          attachments: [],
        },
      ];
      section.lessons = lessons;
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  };

  const removeLesson = (sectionIndex, lessonIndex) => {
    setFormState((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      section.lessons = section.lessons.filter((_, index) => index !== lessonIndex).map((lesson, index) => ({ ...lesson, order: index + 1 }));
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      title: formState.title,
      subject: formState.subject,
      category: formState.category,
      status: formState.status,
      description: formState.description,
      thumbnail: formState.thumbnail,
      price: Number(formState.price || 0),
      totalDuration: formState.totalDuration,
      level: formState.level,
      certificateEnabled: Boolean(formState.certificateEnabled),
      instructor: {
        name: formState.instructorName,
        avatar: formState.instructorAvatar,
        bio: formState.instructorBio,
      },
      sections: formState.sections.map((section) => ({
        title: section.title,
        description: section.description,
        order: Number(section.order) || 1,
        lessons: section.lessons.map((lesson) => ({
          title: lesson.title,
          description: lesson.description,
          videoUrl: lesson.videoUrl,
          sourceType: lesson.sourceType,
          thumbnail: lesson.thumbnail,
          duration: lesson.duration,
          order: Number(lesson.order) || 1,
          notes: lesson.notes,
          attachments: lesson.attachments,
        })),
        resources: section.resources,
        qa: section.qa,
        announcements: section.announcements,
        objectives: Array.isArray(section.objectives) ? section.objectives : [],
      })) ,
    };

    try {
      if (formMode === "edit" && activeCourseId) {
        const res = await API.put(`/courses/${activeCourseId}`, payload);
        setCourses((current) => current.map((course) => course._id === activeCourseId ? res.data.course || { ...course, ...payload } : course));
      } else {
        const res = await API.post("/courses", payload);
        setCourses((current) => [res.data.course, ...current]);
      }
      setShowForm(false);
      setActiveCourseId(null);
      setFormState(createDefaultCourseState());
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCourse = async (courseId) => {
    if (!courseId || !window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await API.delete(`/courses/${courseId}`);
      setCourses((current) => current.filter((course) => course._id !== courseId));
      if (activeCourseId === courseId) {
        setShowForm(false);
        setActiveCourseId(null);
        setFormState(createDefaultCourseState());
      }
    } catch (err) {
      console.error("Error deleting course:", err);
      alert("Failed to delete course. Please try again.");
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Courses</h2>
              <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Create, manage and publish full course content without touching code.</p>
            </div>
            <button type="button" onClick={openCreateForm} style={{ ...buttonStyle, padding: "0.85rem 1rem", backgroundColor: "#16a34a" }}>New Course</button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, color: "#e2e8f0" }}>{formMode === "edit" ? "Edit Course" : "Create Course"}</h3>
                <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: "0.95rem" }}>Add course metadata, structure, lessons, and publish status.</p>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setActiveCourseId(null); setFormState(createDefaultCourseState()); }} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Close</button>
            </div>

            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
              <input value={formState.title} onChange={(e) => updateFormField("title", e.target.value)} placeholder="Course title" style={inputStyle} required />
              <input value={formState.subject} onChange={(e) => updateFormField("subject", e.target.value)} placeholder="Course subject" style={inputStyle} required />
              <input value={formState.category} onChange={(e) => updateFormField("category", e.target.value)} placeholder="Course category" style={inputStyle} required />
              <select value={formState.status} onChange={(e) => updateFormField("status", e.target.value)} style={inputStyle}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <input value={formState.thumbnail} onChange={(e) => updateFormField("thumbnail", e.target.value)} placeholder="Thumbnail URL" style={inputStyle} />
              <input value={formState.totalDuration} onChange={(e) => updateFormField("totalDuration", e.target.value)} placeholder="Course duration" style={inputStyle} />
              <input value={formState.price} onChange={(e) => updateFormField("price", e.target.value)} placeholder="Course price" style={inputStyle} />
              <select value={formState.level} onChange={(e) => updateFormField("level", e.target.value)} style={inputStyle}>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <textarea value={formState.description} onChange={(e) => updateFormField("description", e.target.value)} placeholder="Course description" rows={3} style={{ ...inputStyle, resize: "vertical" }} required />

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.9rem 1rem", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "0.9rem", backgroundColor: "rgba(255,255,255,0.03)" }}>
              <input
                id="certificate-enabled"
                type="checkbox"
                checked={Boolean(formState.certificateEnabled)}
                onChange={(e) => updateFormField("certificateEnabled", e.target.checked)}
                style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
              />
              <label htmlFor="certificate-enabled" style={{ color: "#e2e8f0", cursor: "pointer" }}>
                Enable certificates for this course
              </label>
            </div>

            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
              <input value={formState.instructorName} onChange={(e) => updateFormField("instructorName", e.target.value)} placeholder="Instructor name" style={inputStyle} />
              <input value={formState.instructorAvatar} onChange={(e) => updateFormField("instructorAvatar", e.target.value)} placeholder="Instructor avatar URL" style={inputStyle} />
            </div>
            <textarea value={formState.instructorBio} onChange={(e) => updateFormField("instructorBio", e.target.value)} placeholder="Instructor bio" rows={2} style={{ ...inputStyle, resize: "vertical" }} />

            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, color: "#e2e8f0" }}>Course Structure</h3>
                <button type="button" onClick={addSection} style={{ ...buttonStyle, backgroundColor: "#0ea5e9" }}>Add Section</button>
              </div>

              {formState.sections.map((section, sectionIndex) => (
                <div key={`section-${sectionIndex}`} style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.25rem", padding: "1rem" }}>
                  <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                    <input value={section.title} onChange={(e) => updateSectionField(sectionIndex, "title", e.target.value)} placeholder="Section title" style={inputStyle} required />
                    <input value={section.order} onChange={(e) => updateSectionField(sectionIndex, "order", Number(e.target.value))} placeholder="Section order" type="number" style={inputStyle} />
                    <button type="button" onClick={() => removeSection(sectionIndex)} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>Remove section</button>
                  </div>
                  <textarea value={section.description} onChange={(e) => updateSectionField(sectionIndex, "description", e.target.value)} placeholder="Section description" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Section objectives (one per line)</label>
                    <textarea value={Array.isArray(section.objectives) ? section.objectives.join('\n') : ''} onChange={(e) => updateSectionObjectives(sectionIndex, e.target.value)} placeholder="Enter objectives, one per line" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {section.lessons.map((lesson, lessonIndex) => (
                      <div key={`lesson-${sectionIndex}-${lessonIndex}`} style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "1rem", padding: "0.9rem", display: "grid", gap: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, color: "#e2e8f0" }}>Lesson {lessonIndex + 1}</h4>
                          <button type="button" onClick={() => removeLesson(sectionIndex, lessonIndex)} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>Remove lesson</button>
                        </div>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                          <input value={lesson.title} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "title", e.target.value)} placeholder="Lesson title" style={inputStyle} required />
                          <select value={lesson.sourceType} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "sourceType", e.target.value)} style={inputStyle}>
                            <option value="YouTube">YouTube</option>
                            <option value="Vimeo">Vimeo</option>
                            <option value="Cloudinary">Cloudinary</option>
                            <option value="MP4">MP4</option>
                            <option value="External">External</option>
                            <option value="None">None</option>
                          </select>
                        </div>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                          <input value={lesson.videoUrl} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "videoUrl", e.target.value)} placeholder="Video URL" style={inputStyle} />
                          <input value={lesson.thumbnail} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "thumbnail", e.target.value)} placeholder="Video thumbnail URL" style={inputStyle} />
                        </div>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                          <input value={lesson.duration} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "duration", e.target.value)} placeholder="Lesson duration" style={inputStyle} />
                          <input value={lesson.order} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "order", Number(e.target.value))} placeholder="Lesson order" type="number" style={inputStyle} />
                        </div>
                        <textarea value={lesson.description} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "description", e.target.value)} placeholder="Lesson description" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                        <textarea value={lesson.notes} onChange={(e) => updateLessonField(sectionIndex, lessonIndex, "notes", e.target.value)} placeholder="Lesson notes / summary" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addLesson(sectionIndex)} style={{ ...buttonStyle, backgroundColor: "#2563eb" }}>Add lesson</button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => { setShowForm(false); setActiveCourseId(null); setFormState(createDefaultCourseState()); }} style={{ ...buttonStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button type="submit" style={buttonStyle}>{formMode === "edit" ? "Save Course" : "Create Course"}</button>
            </div>
          </form>
        )}

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "640px" : "auto" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Title</th>
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Subject</th>}
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Status</th>}
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Price</th>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>Loading courses...</td></tr>
              ) : filteredCourses.length === 0 ? (
                <tr><td colSpan={5} style={{ ...tableCell, padding: "1.5rem" }}>No courses found.</td></tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                    <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{course.title}</td>
                    {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{course.subject || course.category}</td>}
                    {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{course.status || "draft"}</td>}
                    <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{course.price ? `D${course.price}` : "Free"}</td>
                    <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openEditForm(course)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#2563eb" }}>Edit</button>
                        <button type="button" onClick={() => deleteCourse(course._id)} style={{ ...buttonStyle, padding: "0.5rem 0.75rem", backgroundColor: "#ef4444" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
