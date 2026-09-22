import { useEffect, useMemo, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import API from "../api/axios";

const heroSampleImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80";

// Responsive hook
const useWindowSize = () => {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1024 });

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
};


const DEFAULT_COURSE_FORM = {
  title: "",
  description: "",
  duration: "",
  price: "0",
  level: "Beginner",
  certificateEnabled: false,
  instructor: {
    name: "",
    photo: "",
  },
  sections: [
    {
      title: "Section 1: Introduction",
      description: "",
      videos: [],
      resources: [],
      qa: [],
      announcements: [],
    },
  ],
};

const DEFAULT_HOMEPAGE = {
  hero: {
    badge: "Professional exam preparation",
    title: "Learn. Assess. Succeed.",
    subtitle: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology.",
    primaryCtaText: "Get Started Free",
    primaryCtaLink: "/register",
    secondaryCtaText: "Explore Courses",
    secondaryCtaLink: "/courses",
    imageUrl: heroSampleImage,
  },
  stats: [
    { label: "Active Learners", value: "10K+" },
    { label: "Courses", value: "500+" },
    { label: "Assessments Taken", value: "50K+" },
    { label: "Success Rate", value: "95%" },
  ],
  popularCourses: [
    { label: "Bestseller", title: "Mastering WASSCE", rating: "4.8", learners: "2.1k learners", level: "Beginner", lessons: "12 Lessons", duration: "8h 45m", imageUrl: "" },
    { label: "Popular", title: "The Complete Guide", rating: "4.7", learners: "1.8k learners", level: "Intermediate", lessons: "18 Lessons", duration: "12h 30m", imageUrl: "" },
    { label: "New", title: "Script Essentials", rating: "4.6", learners: "1.2k learners", level: "Beginner", lessons: "10 Lessons", duration: "5h 15m", imageUrl: "" },
    { label: "Popular", title: "Fundamentals", rating: "4.7", learners: "980 learners", level: "Intermediate", lessons: "14 Lessons", duration: "7h 20m", imageUrl: "" },
  ],
  testimonials: [
    { quote: "ESNEX has completely transformed the way I learn. The courses are well-structured and the assessments help me track my progress effectively.", name: "Priya S.", role: "Data Analyst", photoUrl: "" },
    { quote: "The platform is intuitive, the content is top-notch, and the certificates helped me land my dream job.", name: "Rahul K.", role: "Software Developer", photoUrl: "" },
    { quote: "I love the real-time analytics and the quality of assessments. Highly recommended for serious learners!", name: "Anita M.", role: "Student", photoUrl: "" },
  ],
};

export default function AdminDashboard() {
  const { width: windowWidth } = useWindowSize();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [courseForm, setCourseForm] = useState(DEFAULT_COURSE_FORM);
  const [quizForm, setQuizForm] = useState({ title: "", description: "", duration: "30" });
  const [questionForm, setQuestionForm] = useState({ text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", explanation: "", subject: "", topic: "", difficulty: "medium" });
  const [assessmentForm, setAssessmentForm] = useState({ title: "", description: "", numberOfQuestions: "", subject: "", topic: "", difficulty: "medium", duration: "" });
  const [sectionAssessmentForm, setSectionAssessmentForm] = useState({ courseId: "", sectionId: "", numberOfQuestions: "", subject: "", topic: "", difficulty: "medium" });
  const selectedSectionCourse = courses.find((course) => course._id === sectionAssessmentForm.courseId);
  const [questionBankForm, setQuestionBankForm] = useState({ text: "", options: ["", "", "", ""], correctAnswer: "", explanation: "", subject: "", topic: "", difficulty: "medium" });
  const [questions, setQuestions] = useState([]);
  const [homepage, setHomepage] = useState(null);
  const [homepageForm, setHomepageForm] = useState(DEFAULT_HOMEPAGE);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [heroImagePreview, setHeroImagePreview] = useState("");
  const [courseImageFiles, setCourseImageFiles] = useState({});
  const [testimonialPhotoFiles, setTestimonialPhotoFiles] = useState({});
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "" });
  const [notificationForm, setNotificationForm] = useState({ title: "", message: "", audience: "All users", priority: "Normal" });
  const [message, setMessage] = useState("");
  const location = useLocation();
  const { searchTerm = "" } = useOutletContext() || {};

  const activeView = useMemo(() => {
    if (location.pathname.includes("/admin/homepage")) return "homepage";
    if (location.pathname.includes("/admin/users")) return "users";
    if (location.pathname.includes("/admin/courses")) return "courses";
    if (location.pathname.includes("/admin/assessments")) return "assessments";
    if (location.pathname.includes("/admin/attempts")) return "attempts";
    if (location.pathname.includes("/admin/notifications")) return "notifications";
    return "overview";
  }, [location.pathname]);

  // Responsive breakpoints
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth < 1024;

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [coursesRes, quizzesRes, usersRes, homepageRes] = await Promise.all([
        API.get("/courses").catch(() => ({ data: { courses: [] } })),
        API.get("/quizzes").catch(() => ({ data: { quizzes: [] } })),
        API.get("/auth/users").catch(() => ({ data: { users: [] } })),
        API.get("/homepage").catch(() => ({ data: { homepage: DEFAULT_HOMEPAGE } })),
      ]);

      setCourses(coursesRes.data.courses || []);
      setQuizzes(quizzesRes.data.quizzes || []);
      setUsers(usersRes.data.users || []);
      const homepagePayload = homepageRes?.data?.homepage || DEFAULT_HOMEPAGE;
      setHomepage(homepagePayload);
      setHomepageForm(homepagePayload);
      setAttempts([
        { _id: "a1", student: { name: "Sainey Badjie" }, quiz: { title: "Math Quiz 1" }, score: 50, total: 50, status: "submitted", createdAt: new Date() },
        { _id: "a2", student: { name: "John Doe" }, quiz: { title: "Science Quiz 1" }, score: 48, total: 50, status: "submitted", createdAt: new Date() },
      ]);
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      setLoading(false);
    }
  };

  const updateHeroField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      hero: {
        ...current.hero,
        [field]: value,
      },
    }));
  };

  const updatePopularCourseField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      popularCourses: current.popularCourses.map((course, idx) =>
        idx === index ? { ...course, [field]: value } : course
      ),
    }));
  };

  const updateTestimonialField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      testimonials: current.testimonials.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleHeroImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setHeroImageFile(file);
  };

  useEffect(() => {
    if (!heroImageFile) {
      setHeroImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(heroImageFile);
    setHeroImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [heroImageFile]);

  const handleCourseImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCourseImageFiles((current) => ({
      ...current,
      [index]: file,
    }));
  };

  const handleTestimonialPhotoChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTestimonialPhotoFiles((current) => ({
      ...current,
      [index]: file,
    }));
  };

  const addPopularCourse = () => {
    setHomepageForm((current) => ({
      ...current,
      popularCourses: [
        ...current.popularCourses,
        {
          label: "Popular",
          title: "",
          rating: "0",
          learners: "",
          level: "Beginner",
          lessons: "",
          duration: "",
          imageUrl: "",
        },
      ],
    }));
  };

  const removePopularCourse = (index) => {
    setHomepageForm((current) => ({
      ...current,
      popularCourses: current.popularCourses.filter((_, idx) => idx !== index),
    }));
  };

  const addTestimonial = () => {
    setHomepageForm((current) => ({
      ...current,
      testimonials: [
        ...current.testimonials,
        { quote: "", name: "", role: "", photoUrl: "" },
      ],
    }));
  };

  const removeTestimonial = (index) => {
    setHomepageForm((current) => ({
      ...current,
      testimonials: current.testimonials.filter((_, idx) => idx !== index),
    }));
  };

  const saveHomepageSettings = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("homepage", JSON.stringify(homepageForm));

      if (heroImageFile) {
        formData.append("heroImage", heroImageFile);
      }

      homepageForm.popularCourses.forEach((course, index) => {
        if (courseImageFiles[index]) {
          formData.append(`courseImage-${index}`, courseImageFiles[index]);
        }
      });

      homepageForm.testimonials.forEach((testimonial, index) => {
        if (testimonialPhotoFiles[index]) {
          formData.append(`testimonialPhoto-${index}`, testimonialPhotoFiles[index]);
        }
      });

      const response = await API.put("/homepage", formData);
      const updatedHomepage = response.data?.homepage || homepageForm;
      setHomepage(updatedHomepage);
      setHomepageForm(updatedHomepage);
      setHeroImageFile(null);
      setCourseImageFiles({});
      setTestimonialPhotoFiles({});
      setMessage("Homepage settings updated successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to update homepage settings.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, []);

  const createCourse = async (e) => {
    e.preventDefault();
    try {
      const courseData = {
        title: courseForm.title,
        description: courseForm.description,
        duration: courseForm.duration,
        price: courseForm.price,
        level: courseForm.level,
        certificateEnabled: courseForm.certificateEnabled,
        instructor: {
          name: courseForm.instructor.name,
          photo: courseForm.instructor.photo,
        },
        sections: courseForm.sections.map((section) => ({
          title: section.title,
          description: section.description,
          resources: Array.isArray(section.resources)
            ? section.resources.map((resource) => ({ title: resource.title, url: resource.url || "" }))
            : [],
          qa: Array.isArray(section.qa)
            ? section.qa.map((item) => ({ question: item.question, answer: item.answer }))
            : [],
          announcements: Array.isArray(section.announcements)
            ? section.announcements.map((item) => ({ title: item.title, message: item.message, date: item.date }))
            : [],
          videos: Array.isArray(section.videos)
            ? section.videos.map((video) =>
                typeof video === "string"
                  ? { filename: video }
                  : {
                      title: video?.title || "",
                      url: video?.url || video?.src || "",
                      filename: video?.filename || video?.name || "",
                    }
              )
            : [],
        })),
      };

      const hasResourceFiles = courseForm.sections.some((section) =>
        Array.isArray(section.resources) && section.resources.some((resource) => resource.file)
      );

      if (hasResourceFiles) {
        const formData = new FormData();
        formData.append("courseData", JSON.stringify(courseData));

        courseForm.sections.forEach((section, sectionIndex) => {
          section.resources?.forEach((resource, resourceIndex) => {
            if (resource.file) {
              formData.append(`resourceFile-${sectionIndex}-${resourceIndex}`, resource.file);
            }
          });
        });

        await API.post("/courses", formData);
      } else {
        await API.post("/courses", courseData);
      }

      setCourseForm(DEFAULT_COURSE_FORM);
      await fetchDashboardData();
      setMessage("Course created successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create course.");
    }
  };

  const addSection = () => {
    setCourseForm((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          title: `Section ${current.sections.length + 1}`,
          description: "",
          videos: [],
          resources: [],
          qa: [],
          announcements: [],
        },
      ],
    }));
  };

  const removeSection = (index) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.filter((_, idx) => idx !== index),
    }));
  };

  const updateSectionTitle = (index, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index ? { ...section, title: value } : section
      ),
    }));
  };

  const handleSectionVideos = (index, event) => {
    const files = Array.from(event.target.files || []);
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index
          ? {
              ...section,
              videos: files.map((file) => ({ filename: file.name, url: "", title: file.name })),
            }
          : section
      ),
    }));
  };

  const handleSectionResourceFileChange = (sectionIndex, resourceIndex, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              resources: section.resources.map((resource, rIdx) =>
                rIdx === resourceIndex
                  ? { ...resource, file, url: resource.url || "" }
                  : resource
              ),
            }
          : section
      ),
    }));
  };

  const addLessonToSection = (sectionIndex) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === sectionIndex
          ? {
              ...section,
              videos: [...(section.videos || []), { title: "", url: "", filename: "" }],
            }
          : section
      ),
    }));
  };

  const updateLessonField = (sectionIndex, lessonIndex, field, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              videos: section.videos.map((lesson, lIdx) =>
                lIdx === lessonIndex
                  ? { ...lesson, [field]: value }
                  : lesson
              ),
            }
          : section
      ),
    }));
  };

  const updateSectionDescription = (index, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index ? { ...section, description: value } : section
      ),
    }));
  };

  const addResourceToSection = (index) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index
          ? { ...section, resources: [...(section.resources || []), { title: "", url: "" }] }
          : section
      ),
    }));
  };

  const updateSectionResourceField = (sectionIndex, resourceIndex, field, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              resources: section.resources.map((resource, rIdx) =>
                rIdx === resourceIndex ? { ...resource, [field]: value } : resource
              ),
            }
          : section
      ),
    }));
  };

  const removeSectionResource = (sectionIndex, resourceIndex) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              resources: section.resources.filter((_, rIdx) => rIdx !== resourceIndex),
            }
          : section
      ),
    }));
  };

  const addQaToSection = (index) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index
          ? { ...section, qa: [...(section.qa || []), { question: "", answer: "" }] }
          : section
      ),
    }));
  };

  const updateSectionQaField = (sectionIndex, qaIndex, field, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              qa: section.qa.map((item, qIdx) =>
                qIdx === qaIndex ? { ...item, [field]: value } : item
              ),
            }
          : section
      ),
    }));
  };

  const removeSectionQa = (sectionIndex, qaIndex) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              qa: section.qa.filter((_, qIdx) => qIdx !== qaIndex),
            }
          : section
      ),
    }));
  };

  const addAnnouncementToSection = (index) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index
          ? {
              ...section,
              announcements: [...(section.announcements || []), { title: "", message: "", date: new Date() }],
            }
          : section
      ),
    }));
  };

  const updateSectionAnnouncementField = (sectionIndex, announcementIndex, field, value) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              announcements: section.announcements.map((item, aIdx) =>
                aIdx === announcementIndex ? { ...item, [field]: value } : item
              ),
            }
          : section
      ),
    }));
  };

  const removeSectionAnnouncement = (sectionIndex, announcementIndex) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              announcements: section.announcements.filter((_, aIdx) => aIdx !== announcementIndex),
            }
          : section
      ),
    }));
  };

  const removeLessonFromSection = (sectionIndex, lessonIndex) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sIdx) =>
        sIdx === sectionIndex
          ? {
              ...section,
              videos: section.videos.filter((_, lIdx) => lIdx !== lessonIndex),
            }
          : section
      ),
    }));
  };

  const handleInstructorPhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCourseForm((current) => ({
      ...current,
      instructor: {
        ...current.instructor,
        photo: file.name,
      },
    }));
  };

  const addQuestion = (e) => {
    e.preventDefault();

    const newQuestion = {
      part: questionForm.part,
      section: questionForm.section,
      type: questionForm.type,
      question: questionForm.question,
      options: questionForm.type === "mcq" ? [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD].filter(Boolean) : [],
      correctAnswer: questionForm.correctAnswer,
      sampleAnswer: questionForm.sampleAnswer,
      useAI: questionForm.useAI,
      markingFormat: questionForm.markingFormat,
      aiGuidance: questionForm.aiGuidance || "",
      correctFormat: questionForm.correctFormat,
    };

    setQuestions((current) => [...current, newQuestion]);
    setQuestionForm({ part: "A", section: "", type: "mcq", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", sampleAnswer: "", useAI: false, markingFormat: "", aiGuidance: "", correctFormat: "" });
  };

  const createAssessment = async (e) => {
    e.preventDefault();
    if (!quizForm.title || !quizForm.duration || questions.length === 0) {
      setMessage("Please enter quiz details and add at least one question.");
      return;
    }

    try {
      const response = await API.post("/quizzes", { ...quizForm, questions });
      setQuizForm({ title: "", description: "", duration: "30" });
      setQuestions([]);
      setMessage("Assessment created successfully.");
      if (response.data?.quiz) {
        setQuizzes((current) => [...current, response.data.quiz]);
      }
      await fetchDashboardData();
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create assessment.");
    }
  };

  const createQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.text || !questionForm.optionA || !questionForm.optionB || !questionForm.optionC || !questionForm.optionD || !questionForm.correctAnswer || !questionForm.subject) {
      setMessage("Please fill in all required fields for the question.");
      return;
    }

    try {
      await API.post("/questions", {
        text: questionForm.text,
        options: [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD],
        correctAnswer: questionForm.correctAnswer,
        explanation: questionForm.explanation,
        subject: questionForm.subject,
        topic: questionForm.topic,
        difficulty: questionForm.difficulty,
      });
      setQuestionForm({ text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", explanation: "", subject: "", topic: "", difficulty: "medium" });
      setMessage("Question added to bank successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to add question.");
    }
  };

  const createGlobalAssessment = async (e) => {
    e.preventDefault();
    if (!assessmentForm.title || !assessmentForm.numberOfQuestions || !assessmentForm.subject) {
      setMessage("Please fill in all required fields for the global assessment.");
      return;
    }

    try {
      await API.post("/assessments/global", assessmentForm);
      setAssessmentForm({ title: "", description: "", numberOfQuestions: "", subject: "", topic: "", difficulty: "medium", duration: "" });
      setMessage("Global assessment created successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create global assessment.");
    }
  };

  const createCourseSectionAssessment = async (e) => {
    e.preventDefault();
    if (!sectionAssessmentForm.courseId || !sectionAssessmentForm.sectionId || !sectionAssessmentForm.numberOfQuestions || !sectionAssessmentForm.subject) {
      setMessage("Please fill in all required fields for the section assessment.");
      return;
    }

    try {
      await API.post("/assessments/course-section", sectionAssessmentForm);
      setSectionAssessmentForm({ courseId: "", sectionId: "", numberOfQuestions: "", subject: "", topic: "", difficulty: "medium" });
      setMessage("Course section assessment created successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create section assessment.");
    }
  };

  const deleteCourse = async (id) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await API.delete(`/courses/${id}`);
      await fetchDashboardData();
      setMessage("Course deleted successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to delete course.");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await API.post("/auth/register", userForm);
      setUserForm({ name: "", email: "", password: "" });
      await fetchDashboardData();
      setMessage("User account created successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create user.");
    }
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    try {
      // Placeholder - no endpoint for notifications yet
      setNotificationForm({ title: "", message: "", audience: "All users", priority: "Normal" });
      setMessage("Notification sent successfully.");
    } catch {
      setMessage("Unable to send notification.");
    }
  };

  const userCount = users.length;
  const courseCount = courses.length;
  const assessmentCount = quizzes.length;
  const attemptCount = attempts.length;
  const certificateCount = attempts.filter((attempt) => attempt.score >= 50).length;
  const completionRate = attemptCount ? Math.round((attempts.filter((attempt) => attempt.status === "submitted").length / attemptCount) * 100) : 0;

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user._id.toString().includes(query)
    );
  }, [searchTerm, users]);

  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      course.title.toLowerCase().includes(query) ||
      course.description.toLowerCase().includes(query) ||
      course._id.toString().includes(query)
    );
  }, [searchTerm, courses]);

  const filteredAttempts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return attempts;
    return attempts.filter((attempt) =>
      attempt.student?.name?.toLowerCase().includes(query) ||
      attempt.quiz?.title?.toLowerCase().includes(query) ||
      attempt._id.toString().includes(query)
    );
  }, [searchTerm, attempts]);

  const recentUsers = users.slice(0, 5);
  const recentAttempts = attempts.slice(0, 5);

  const inputStyle = {
    width: "100%",
    borderRadius: "1rem",
    border: "1px solid #334155",
    backgroundColor: "#020617",
    color: "#f1f5f9",
    padding: "0.9rem 1rem",
    outline: "none",
  };

  const buttonStyle = {
    width: "fit-content",
    borderRadius: "1rem",
    border: "none",
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    padding: "0.95rem 1.25rem",
    cursor: "pointer",
    fontWeight: 700,
  };

  const tableHeader = {
    padding: "1rem",
    fontSize: "0.9rem",
    fontWeight: 600,
  };

  const tableCell = {
    padding: "1rem",
    color: "#e2e8f0",
    verticalAlign: "middle",
  };

  const deleteButtonStyle = {
    borderRadius: "999px",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    color: "#ef4444",
    padding: "0.55rem 0.85rem",
    cursor: "pointer",
  };

  const renderOverview = () => (
    <>
      <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)" }}>
        {[
          { label: "Users", value: userCount, detail: "Active users" },
          { label: "Courses", value: courseCount, detail: "Live courses" },
          { label: "Assessments", value: assessmentCount, detail: "Available quizzes" },
          { label: "Attempts", value: attemptCount, detail: "Total exam attempts" },
          { label: "Certificates", value: certificateCount, detail: "Qualified completions" },
          { label: "Completion", value: `${completionRate}%`, detail: "Submitted rate" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="admin-overview-card"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(148, 163, 184, 0.12)",
              borderRadius: "1.5rem",
              padding: isMobile ? "1rem" : "1.25rem",
              textAlign: "left",
              color: "#e2e8f0",
            }}
          >
            <p style={{ margin: 0, fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#94a3b8" }}>{stat.label}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: isMobile ? "1.5rem" : "2rem", fontWeight: 700 }}>{stat.value}</p>
            <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.75rem" : "0.85rem" }}>{stat.detail}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: isMobile ? "1rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "2fr 1fr", marginTop: isMobile ? "1rem" : "1.5rem" }}>
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.25rem", color: "#e2e8f0" }}>User snapshot</h2>
          <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Recent accounts and enrolment totals.</p>
          <div style={{ display: "grid", gap: isMobile ? "0.5rem" : "0.75rem" }}>
            {recentUsers.map((user) => (
              <div key={user._id} style={{ borderRadius: "1rem", backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? "0.75rem" : "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#fff", fontWeight: 600, fontSize: isMobile ? "0.9rem" : "1rem" }}>{user.name}</p>
                  <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.8rem" : "0.9rem", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <span style={{ color: "#bfdbfe", fontSize: isMobile ? "0.75rem" : "0.85rem", backgroundColor: "rgba(59,130,246,0.12)", padding: "0.25rem 0.5rem", borderRadius: "999px" }}>
                      {user.enrolledCourses || 0} enrolled
                    </span>
                    <span style={{ color: "#bbf7d0", fontSize: isMobile ? "0.75rem" : "0.85rem", backgroundColor: "rgba(34,197,94,0.12)", padding: "0.25rem 0.5rem", borderRadius: "999px" }}>
                      {user.completedAssessments || 0} assessments
                    </span>
                  </div>
                </div>
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: isMobile ? "0.8rem" : "0.95rem", marginLeft: "0.5rem" }}>{user.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.25rem", color: "#e2e8f0" }}>Recent Attempts</h2>
          <div style={{ marginTop: "1rem", display: "grid", gap: isMobile ? "0.5rem" : "0.75rem" }}>
            {recentAttempts.map((attempt) => (
              <div key={attempt._id} style={{ borderRadius: "1rem", backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? "0.75rem" : "1rem" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#fff", fontSize: isMobile ? "0.9rem" : "1rem" }}>{attempt.quiz?.title || "Unknown quiz"}</p>
                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>{attempt.student?.name || "Unknown student"} • {attempt.status}</p>
                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.75rem" : "0.9rem" }}>Score: {attempt.score ?? 0}/{attempt.total ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderUsers = () => (
    <div style={{ display: "grid", gap: isMobile ? "1rem" : "1.5rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Manage Users</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Search users, inspect details, and add new student accounts.</p>
        <form onSubmit={createUser} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1rem" }}>
            <input placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required autoComplete="name" style={inputStyle} />
            <input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required autoComplete="email" style={inputStyle} />
          </div>
          <input placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required autoComplete="new-password" style={inputStyle} />
          <button type="submit" style={buttonStyle}>Add user</button>
        </form>
      </div>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>User details</h2>
        <div style={{ overflowX: "auto", marginTop: "1rem", fontSize: isMobile ? "0.85rem" : "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "600px" : "auto" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Name</th>
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Email</th>}
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Role</th>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>Courses</th>
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Assessments</th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{isMobile ? user.name.split(" ")[0] : user.name}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem", fontSize: "0.9rem" }}>{user.email}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{user.role}</td>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{user.enrolledCourses || 0}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{user.completedAssessments || 0}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCourses = () => (
    <div style={{ display: "grid", gap: isMobile ? "1rem" : "1.5rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Create new course</h2>
        <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Add a course with a full instructor profile and structured sections so students can follow the learning path clearly.</p>
        <form onSubmit={createCourse} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem", marginTop: isMobile ? "0.75rem" : "1rem" }}>
          <input placeholder="Course title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required style={inputStyle} />

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1rem" }}>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Instructor name</label>
              <input placeholder="Instructor name" value={courseForm.instructor.name} onChange={(e) => setCourseForm({ ...courseForm, instructor: { ...courseForm.instructor, name: e.target.value } })} required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Instructor photo</label>
              <input placeholder="Photo URL" value={courseForm.instructor.photo} onChange={(e) => setCourseForm({ ...courseForm, instructor: { ...courseForm.instructor, photo: e.target.value } })} style={inputStyle} />
            </div>
          </div>

          <input type="file" accept="image/*" onChange={handleInstructorPhotoChange} style={inputStyle} />
          {courseForm.instructor.photo && (
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Selected instructor image: {courseForm.instructor.photo}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1rem" }}>
            <input placeholder="Duration (e.g. 4 weeks, 2 months)" value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} required style={inputStyle} />
            <select value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} style={inputStyle}>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <textarea placeholder="Short course description" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} required rows={isMobile ? 3 : 4} style={{ ...inputStyle, resize: "vertical" }} />

          <div style={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "1.25rem", padding: "1rem", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: isMobile ? "1rem" : "1.1rem" }}>Course content structure</h3>
            {courseForm.sections.map((section, index) => (
              <div key={`section-${index}`} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1rem", padding: "1rem", display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <input
                    placeholder={`Section ${index + 1} title`}
                    value={section.title}
                    onChange={(e) => updateSectionTitle(index, e.target.value)}
                    required
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(index)}
                    disabled={courseForm.sections.length === 1}
                    style={{
                      borderRadius: "999px",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      backgroundColor: "rgba(148, 163, 184, 0.08)",
                      color: "#cbd5e1",
                      padding: "0.75rem 1rem",
                      cursor: courseForm.sections.length === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Lesson videos</label>
                  <input type="file" accept="video/*" multiple onChange={(e) => handleSectionVideos(index, e)} style={inputStyle} />
                  <button
                    type="button"
                    onClick={() => addLessonToSection(index)}
                    style={{
                      ...buttonStyle,
                      width: "fit-content",
                      backgroundColor: "#10b981",
                    }}
                  >
                    Add lesson link
                  </button>
                  {section.videos.length > 0 && (
                    <div style={{ display: "grid", gap: "0.75rem", color: "#94a3b8", fontSize: "0.9rem" }}>
                      {section.videos.map((video, lessonIndex) => (
                        <div key={`lesson-${lessonIndex}`} style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderRadius: "1rem", backgroundColor: "rgba(148, 163, 184, 0.05)" }}>
                          <input
                            placeholder="Lesson title"
                            value={video.title || ""}
                            onChange={(e) => updateLessonField(index, lessonIndex, "title", e.target.value)}
                            style={inputStyle}
                          />
                          <input
                            placeholder="Cloudinary / MP4 video URL"
                            value={video.url || ""}
                            onChange={(e) => updateLessonField(index, lessonIndex, "url", e.target.value)}
                            style={inputStyle}
                          />
                          <button
                            type="button"
                            onClick={() => removeLessonFromSection(index, lessonIndex)}
                            style={{
                              ...deleteButtonStyle,
                              width: "fit-content",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0.8rem",
                            }}
                          >
                            Remove lesson
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Section description</label>
                  <textarea
                    placeholder="Describe this section"
                    value={section.description || ""}
                    onChange={(e) => updateSectionDescription(index, e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Section resources</label>
                    <button type="button" onClick={() => addResourceToSection(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>
                      Add resource
                    </button>
                  </div>
                  {section.resources?.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {section.resources.map((resource, resourceIndex) => (
                        <div key={`resource-${resourceIndex}`} style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderRadius: "1rem", backgroundColor: "rgba(148, 163, 184, 0.05)" }}>
                          <input
                            placeholder="Resource title"
                            value={resource.title}
                            onChange={(e) => updateSectionResourceField(index, resourceIndex, "title", e.target.value)}
                            style={inputStyle}
                          />
                          <input
                            placeholder="Resource URL"
                            value={resource.url}
                            onChange={(e) => updateSectionResourceField(index, resourceIndex, "url", e.target.value)}
                            style={inputStyle}
                          />
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx"
                            onChange={(e) => handleSectionResourceFileChange(index, resourceIndex, e)}
                            style={inputStyle}
                          />
                          {resource.file && (
                            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                              Selected file: {resource.file.name}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeSectionResource(index, resourceIndex)}
                            style={{
                              ...deleteButtonStyle,
                              width: "fit-content",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0.8rem",
                            }}
                          >
                            Remove resource
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No resources added yet.</p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Section Q&A</label>
                    <button type="button" onClick={() => addQaToSection(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>
                      Add question
                    </button>
                  </div>
                  {section.qa?.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {section.qa.map((item, qaIndex) => (
                        <div key={`qa-${qaIndex}`} style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderRadius: "1rem", backgroundColor: "rgba(148, 163, 184, 0.05)" }}>
                          <input
                            placeholder="Question"
                            value={item.question}
                            onChange={(e) => updateSectionQaField(index, qaIndex, "question", e.target.value)}
                            style={inputStyle}
                          />
                          <textarea
                            placeholder="Answer (optional)"
                            value={item.answer}
                            onChange={(e) => updateSectionQaField(index, qaIndex, "answer", e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical" }}
                          />
                          <button
                            type="button"
                            onClick={() => removeSectionQa(index, qaIndex)}
                            style={{
                              ...deleteButtonStyle,
                              width: "fit-content",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0.8rem",
                            }}
                          >
                            Remove question
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No Q&A entries yet.</p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Announcements</label>
                    <button type="button" onClick={() => addAnnouncementToSection(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>
                      Add announcement
                    </button>
                  </div>
                  {section.announcements?.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {section.announcements.map((announcement, announcementIndex) => (
                        <div key={`announcement-${announcementIndex}`} style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", borderRadius: "1rem", backgroundColor: "rgba(148, 163, 184, 0.05)" }}>
                          <input
                            placeholder="Announcement title"
                            value={announcement.title}
                            onChange={(e) => updateSectionAnnouncementField(index, announcementIndex, "title", e.target.value)}
                            style={inputStyle}
                          />
                          <textarea
                            placeholder="Announcement message"
                            value={announcement.message}
                            onChange={(e) => updateSectionAnnouncementField(index, announcementIndex, "message", e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical" }}
                          />
                          <button
                            type="button"
                            onClick={() => removeSectionAnnouncement(index, announcementIndex)}
                            style={{
                              ...deleteButtonStyle,
                              width: "fit-content",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0.8rem",
                            }}
                          >
                            Remove announcement
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No announcements yet.</p>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSection}
              style={{
                ...buttonStyle,
                width: isMobile ? "100%" : "fit-content",
                marginTop: "0.25rem",
              }}
            >
              Add section
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#cbd5e1", cursor: "pointer" }}>
            <input type="checkbox" checked={courseForm.certificateEnabled} onChange={(e) => setCourseForm({ ...courseForm, certificateEnabled: e.target.checked })} style={{ cursor: "pointer" }} />
            This course offers a certificate upon completion
          </label>
          <button type="submit" style={buttonStyle}>Create course</button>
        </form>
      </div>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Courses list</h2>
        <div style={{ overflowX: "auto", marginTop: "1rem", fontSize: isMobile ? "0.85rem" : "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "500px" : "auto" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Title</th>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Students</th>
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Duration</th>}
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Status</th>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem", maxWidth: isMobile ? "120px" : "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</td>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{course.students?.length || 0}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{course.duration}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{course.students?.length > 0 ? "Active" : "Draft"}</td>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}><button onClick={() => deleteCourse(course._id)} style={{ ...deleteButtonStyle, padding: isMobile ? "0.45rem 0.6rem" : "0.55rem 0.85rem", fontSize: isMobile ? "0.75rem" : "1rem" }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAttempts = () => (
    <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
      <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Attempt history</h2>
      <div style={{ overflowX: "auto", marginTop: "1rem", fontSize: isMobile ? "0.85rem" : "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "550px" : "auto" }}>
          <thead>
            <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Student</th>
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Quiz</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Score</th>}
              <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Status</th>
              {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Date</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAttempts.map((attempt) => (
              <tr key={attempt._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{attempt.student?.name || "Unknown"}</td>
                <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem", maxWidth: isMobile ? "100px" : "auto", overflow: "hidden", textOverflow: "ellipsis" }}>{attempt.quiz?.title || "Unknown"}</td>
                {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{attempt.score ?? 0}/{attempt.total ?? 0}</td>}
                <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{attempt.status}</td>
                {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{new Date(attempt.createdAt).toLocaleDateString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div style={{ display: "grid", gap: isMobile ? "1rem" : "1.5rem" }}>
      {/* Question Bank Management */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Question Bank</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Manage the central question bank for assessments.</p>
        <form onSubmit={createQuestion} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1rem" }}>
            <input placeholder="Subject" value={questionForm.subject} onChange={(e) => setQuestionForm({ ...questionForm, subject: e.target.value })} required style={inputStyle} />
            <input placeholder="Topic" value={questionForm.topic} onChange={(e) => setQuestionForm({ ...questionForm, topic: e.target.value })} style={inputStyle} />
            <select value={questionForm.difficulty} onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })} style={inputStyle}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <textarea placeholder="Question text" value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} required />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Option A" value={questionForm.optionA} onChange={(e) => setQuestionForm({ ...questionForm, optionA: e.target.value })} style={inputStyle} required />
            <input placeholder="Option B" value={questionForm.optionB} onChange={(e) => setQuestionForm({ ...questionForm, optionB: e.target.value })} style={inputStyle} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Option C" value={questionForm.optionC} onChange={(e) => setQuestionForm({ ...questionForm, optionC: e.target.value })} style={inputStyle} required />
            <input placeholder="Option D" value={questionForm.optionD} onChange={(e) => setQuestionForm({ ...questionForm, optionD: e.target.value })} style={inputStyle} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Correct answer (A, B, C, or D)" value={questionForm.correctAnswer} onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })} style={inputStyle} required />
            <input placeholder="Explanation (optional)" value={questionForm.explanation} onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} style={inputStyle} />
          </div>
          <button type="submit" style={{ ...buttonStyle, width: isMobile ? "100%" : "fit-content" }}>Add to Question Bank</button>
        </form>
      </div>

      {/* Global Assessments */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Global Assessments</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Create standalone assessments like WAEC-style exams.</p>
        <form onSubmit={createGlobalAssessment} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Assessment title" value={assessmentForm.title} onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })} required style={inputStyle} />
            <input placeholder="Number of questions" type="number" value={assessmentForm.numberOfQuestions} onChange={(e) => setAssessmentForm({ ...assessmentForm, numberOfQuestions: e.target.value })} required style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1rem" }}>
            <input placeholder="Subject" value={assessmentForm.subject} onChange={(e) => setAssessmentForm({ ...assessmentForm, subject: e.target.value })} required style={inputStyle} />
            <input placeholder="Topic (optional)" value={assessmentForm.topic} onChange={(e) => setAssessmentForm({ ...assessmentForm, topic: e.target.value })} style={inputStyle} />
            <select value={assessmentForm.difficulty} onChange={(e) => setAssessmentForm({ ...assessmentForm, difficulty: e.target.value })} style={inputStyle}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <input placeholder="Duration (minutes)" type="number" value={assessmentForm.duration} onChange={(e) => setAssessmentForm({ ...assessmentForm, duration: e.target.value })} style={inputStyle} />
          </div>
          <textarea placeholder="Description (optional)" value={assessmentForm.description} onChange={(e) => setAssessmentForm({ ...assessmentForm, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          <button type="submit" style={{ ...buttonStyle, width: isMobile ? "100%" : "fit-content" }}>Create Global Assessment</button>
        </form>
      </div>

      {/* Course Section Assessments */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Course Section Assessments</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Create assessments for specific course sections.</p>
        <form onSubmit={createCourseSectionAssessment} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
            <select
              value={sectionAssessmentForm.courseId}
              onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, courseId: e.target.value, sectionId: "" })}
              required
              style={inputStyle}
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
            {selectedSectionCourse?.sections?.length ? (
              <select
                value={sectionAssessmentForm.sectionId}
                onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, sectionId: e.target.value })}
                required
                style={inputStyle}
              >
                <option value="">Select Section</option>
                {selectedSectionCourse.sections.map((section) => (
                  <option key={section._id} value={section._id}>
                    {section.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder="Section ID"
                value={sectionAssessmentForm.sectionId}
                onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, sectionId: e.target.value })}
                required
                style={inputStyle}
              />
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "1rem" }}>
            <input placeholder="Number of questions" type="number" value={sectionAssessmentForm.numberOfQuestions} onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, numberOfQuestions: e.target.value })} required style={inputStyle} />
            <input placeholder="Subject" value={sectionAssessmentForm.subject} onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, subject: e.target.value })} required style={inputStyle} />
            <input placeholder="Topic (optional)" value={sectionAssessmentForm.topic} onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, topic: e.target.value })} style={inputStyle} />
          </div>
          <select value={sectionAssessmentForm.difficulty} onChange={(e) => setSectionAssessmentForm({ ...sectionAssessmentForm, difficulty: e.target.value })} style={inputStyle}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button type="submit" style={{ ...buttonStyle, width: isMobile ? "100%" : "fit-content" }}>Create Section Assessment</button>
        </form>
      </div>

      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Assessment list</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Existing quizzes created in the system.</p>
        <div style={{ overflowX: "auto", fontSize: isMobile ? "0.85rem" : "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "500px" : "auto" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Title</th>
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Questions</th>
                {!isMobile && <th style={{ ...tableHeader, padding: "1rem" }}>Duration</th>}
                <th style={{ ...tableHeader, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem", maxWidth: isMobile ? "120px" : "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quiz.title}</td>
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{quiz.questionsCount ?? 0}</td>
                  {!isMobile && <td style={{ ...tableCell, padding: "1rem" }}>{quiz.duration}</td>}
                  <td style={{ ...tableCell, padding: isMobile ? "0.75rem 0.5rem" : "1rem" }}>{new Date(quiz.createdAt || Date.now()).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem", display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
      <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Send notification</h2>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Broadcast messages to specific audiences.</p>
      <form onSubmit={sendNotification} style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
        <input placeholder="Title" value={notificationForm.title} onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })} required style={inputStyle} />
        <textarea placeholder="Message" value={notificationForm.message} onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })} required rows={isMobile ? 4 : 5} style={{ ...inputStyle, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1rem" }}>
          <input placeholder="Audience" value={notificationForm.audience} onChange={(e) => setNotificationForm({ ...notificationForm, audience: e.target.value })} style={inputStyle} />
          <input placeholder="Priority" value={notificationForm.priority} onChange={(e) => setNotificationForm({ ...notificationForm, priority: e.target.value })} style={inputStyle} />
        </div>
        <button type="submit" style={buttonStyle}>Send notification</button>
      </form>
    </div>
  );

  const renderHomepage = () => (
    <div style={{ display: "grid", gap: isMobile ? "1rem" : "1.5rem" }}>
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Homepage manager</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Edit homepage hero content, course thumbnails, and learner testimonials from one central place.</p>
        <form onSubmit={saveHomepageSettings} style={{ display: "grid", gap: isMobile ? "1rem" : "1.25rem" }}>
          <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Hero section</h3>
            <input placeholder="Badge text" value={homepageForm.hero.badge} onChange={(e) => updateHeroField("badge", e.target.value)} style={inputStyle} />
            <input placeholder="Headline" value={homepageForm.hero.title} onChange={(e) => updateHeroField("title", e.target.value)} style={inputStyle} />
            <textarea placeholder="Subtitle" value={homepageForm.hero.subtitle} onChange={(e) => updateHeroField("subtitle", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input placeholder="Primary CTA text" value={homepageForm.hero.primaryCtaText} onChange={(e) => updateHeroField("primaryCtaText", e.target.value)} style={inputStyle} />
              <input placeholder="Primary CTA link" value={homepageForm.hero.primaryCtaLink} onChange={(e) => updateHeroField("primaryCtaLink", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input placeholder="Secondary CTA text" value={homepageForm.hero.secondaryCtaText} onChange={(e) => updateHeroField("secondaryCtaText", e.target.value)} style={inputStyle} />
              <input placeholder="Secondary CTA link" value={homepageForm.hero.secondaryCtaLink} onChange={(e) => updateHeroField("secondaryCtaLink", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>Hero image upload</label>
              <input type="file" accept="image/*" onChange={handleHeroImageChange} style={inputStyle} />
              <input placeholder="Hero image URL" value={homepageForm.hero.imageUrl} onChange={(e) => updateHeroField("imageUrl", e.target.value)} style={inputStyle} />
              {heroImageFile && <p style={{ margin: 0, color: "#94a3b8" }}>Selected file: {heroImageFile.name}</p>}
              {(heroImagePreview || homepageForm.hero.imageUrl) && (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.9rem" }}>Hero image preview</p>
                  <img
                    src={heroImagePreview || homepageForm.hero.imageUrl}
                    alt="Hero image preview"
                    style={{ width: "100%", maxHeight: "220px", objectFit: "cover", borderRadius: "1rem", border: "1px solid rgba(148, 163, 184, 0.16)" }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Popular course cards</h3>
            {homepageForm.popularCourses.map((course, index) => (
              <div key={`course-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Label" value={course.label} onChange={(e) => updatePopularCourseField(index, "label", e.target.value)} style={inputStyle} />
                    <input placeholder="Title" value={course.title} onChange={(e) => updatePopularCourseField(index, "title", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Rating" value={course.rating} onChange={(e) => updatePopularCourseField(index, "rating", e.target.value)} style={inputStyle} />
                    <input placeholder="Learners" value={course.learners} onChange={(e) => updatePopularCourseField(index, "learners", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Level" value={course.level} onChange={(e) => updatePopularCourseField(index, "level", e.target.value)} style={inputStyle} />
                    <input placeholder="Lessons" value={course.lessons} onChange={(e) => updatePopularCourseField(index, "lessons", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Duration" value={course.duration} onChange={(e) => updatePopularCourseField(index, "duration", e.target.value)} style={inputStyle} />
                    <input placeholder="Image URL" value={course.imageUrl} onChange={(e) => updatePopularCourseField(index, "imageUrl", e.target.value)} style={inputStyle} />
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => handleCourseImageChange(index, e)} style={inputStyle} />
                  {courseImageFiles[index] && <p style={{ margin: 0, color: "#94a3b8" }}>Selected file: {courseImageFiles[index].name}</p>}
                </div>
                <button type="button" onClick={() => removePopularCourse(index)} disabled={homepageForm.popularCourses.length <= 1} style={{ ...deleteButtonStyle, width: "fit-content" }}>
                  Remove course
                </button>
              </div>
            ))}
            <button type="button" onClick={addPopularCourse} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>
              Add course card
            </button>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Testimonials</h3>
            {homepageForm.testimonials.map((item, index) => (
              <div key={`testimonial-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                <input placeholder="Quote" value={item.quote} onChange={(e) => updateTestimonialField(index, "quote", e.target.value)} style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                  <input placeholder="Name" value={item.name} onChange={(e) => updateTestimonialField(index, "name", e.target.value)} style={inputStyle} />
                  <input placeholder="Role" value={item.role} onChange={(e) => updateTestimonialField(index, "role", e.target.value)} style={inputStyle} />
                </div>
                <input placeholder="Photo URL" value={item.photoUrl} onChange={(e) => updateTestimonialField(index, "photoUrl", e.target.value)} style={inputStyle} />
                <input type="file" accept="image/*" onChange={(e) => handleTestimonialPhotoChange(index, e)} style={inputStyle} />
                {testimonialPhotoFiles[index] && <p style={{ margin: 0, color: "#94a3b8" }}>Selected file: {testimonialPhotoFiles[index].name}</p>}
                <button type="button" onClick={() => removeTestimonial(index)} disabled={homepageForm.testimonials.length <= 1} style={{ ...deleteButtonStyle, width: "fit-content" }}>
                  Remove testimonial
                </button>
              </div>
            ))}
            <button type="button" onClick={addTestimonial} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>
              Add testimonial
            </button>
          </div>

          <button type="submit" style={{ ...buttonStyle, width: isMobile ? "100%" : "fit-content" }}>
            Save homepage settings
          </button>
        </form>
      </div>
    </div>
  );

  const currentSection = {
    overview: renderOverview,
    homepage: renderHomepage,
    users: renderUsers,
    courses: renderCourses,
    attempts: renderAttempts,
    assessments: renderAssessments,
    notifications: renderNotifications,
  }[activeView] || renderOverview;

  return (
    <AdminLayout selectedSection={activeView} onSectionChange={setActiveView} searchValue={search} onSearch={setSearch}>
      <div style={{ padding: isMobile ? "1rem" : isTablet ? "1.5rem" : "2rem" }}>
        <section style={{ display: "flex", justifyContent: "space-between", gap: isMobile ? "0.75rem" : "1rem", flexWrap: "wrap", marginBottom: isMobile ? "1.5rem" : "2rem" }}>
          <div style={{ minWidth: isMobile ? "100%" : "280px" }}>
            <p style={{ color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.3em", fontSize: isMobile ? "0.7rem" : "0.85rem", marginBottom: isMobile ? "0.5rem" : "0.75rem" }}>Admin dashboard</p>
            <h1 style={{ fontSize: isMobile ? "1.5rem" : isTablet ? "2rem" : "2.4rem", margin: 0, color: "#e2e8f0" }}>Welcome back, administrator</h1>
            <p style={{ color: "#94a3b8", marginTop: isMobile ? "0.5rem" : "0.75rem", maxWidth: "42rem", fontSize: isMobile ? "0.85rem" : "1rem" }}>Track platform health, manage courses, and view real-time activity from one place.</p>
          </div>
        </section>

        {message && (
          <div style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "1rem", padding: isMobile ? "0.75rem" : "1rem", marginBottom: isMobile ? "1rem" : "1.5rem", color: "#22c55e", fontSize: isMobile ? "0.9rem" : "1rem" }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: isMobile ? "2rem 1rem" : "3rem" }}>Loading dashboard data...</div>
        ) : (
          currentSection()
        )}

        {/* System Health Footer */}
        <div style={{ marginTop: isMobile ? "2rem" : "3rem", borderTop: "1px solid rgba(148, 163, 184, 0.12)", paddingTop: isMobile ? "1.5rem" : "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "1rem" : "1.5rem", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: isMobile ? "0.85rem" : "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>System Health</p>
            <div style={{ display: "flex", gap: isMobile ? "0.75rem" : "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: isMobile ? "0.75rem" : "0.85rem" }}>
                <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
                <span style={{ color: "#94a3b8" }}>Database</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: isMobile ? "0.75rem" : "0.85rem" }}>
                <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
                <span style={{ color: "#94a3b8" }}>Server</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: isMobile ? "0.75rem" : "0.85rem" }}>
                <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", backgroundColor: "#3b82f6" }}></div>
                <span style={{ color: "#94a3b8" }}>Active Sessions</span>
              </div>
            </div>
          </div>
          <p style={{ margin: "1rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>All systems operational • Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </AdminLayout>
  );
}
