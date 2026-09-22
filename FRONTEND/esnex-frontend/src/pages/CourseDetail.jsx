import { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { isLoggedIn } from "../utils/auth";
import "../styles/course-detail.css";

const isYouTubeUrl = (url) => {
  if (!url) return false;
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/.test(url);
};

const getYouTubeEmbedUrl = (url) => {
  if (!isYouTubeUrl(url)) return "";
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/);
  const videoId = match?.[1];
  if (!videoId) return "";
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    controls: "1",
    fs: "1",
    origin: typeof window !== "undefined" ? window.location.origin : "",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

const isVimeoUrl = (url) => {
  if (!url) return false;
  return /(?:vimeo\.com\/(?:channels\/[\w]+\/|groups\/[\w]+\/videos\/|video\/)?)(\d+)/.test(url);
};

const getVimeoEmbedUrl = (url) => {
  if (!isVimeoUrl(url)) return "";
  const match = url.match(/(?:vimeo\.com\/(?:channels\/[\w]+\/|groups\/[\w]+\/videos\/|video\/)?)(\d+)/);
  const videoId = match?.[1];
  if (!videoId) return "";
  return `https://player.vimeo.com/video/${videoId}`;
};

const isCloudinaryUrl = (url) => {
  if (!url) return false;
  return url.includes("res.cloudinary.com");
};

const getStreamableVideoUrl = (url) => {
  if (!url) return "";
  if (isYouTubeUrl(url) || isVimeoUrl(url)) return "";
  if (isCloudinaryUrl(url)) return url;
  return url;
};

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({ enrolled: false, progress: { completedLessons: [], percentage: 0 }, totalLessons: 0, completedCount: 0, completed: false, accessType: null, validUntil: null });
  const [selectedSection, setSelectedSection] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [progressLoading, setProgressLoading] = useState(false);
  const [videoLocked, setVideoLocked] = useState(true);
  const [activeTab, setActiveTab] = useState("About");
  const [sectionAssessmentLoading, setSectionAssessmentLoading] = useState(false);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [videoPlaybackReady, setVideoPlaybackReady] = useState(false);
  const [isProtectedContent, setIsProtectedContent] = useState(false);
  const [protectedContentAccessDenied, setProtectedContentAccessDenied] = useState(false);
  const videoRef = useRef(null);
  const contentRef = useRef(null);

  const courseSections = useMemo(() => {
    if (course?.sections?.length > 0) return course.sections;
    if (course?.videos?.length > 0) return [{ title: "Lessons", lessons: course.videos }];
    return [];
  }, [course]);

  const selectedVideo = useMemo(() => {
    const section = courseSections[selectedSection] || courseSections[0] || null;
    const lessons = section?.lessons ?? section?.videos;
    return lessons?.[selectedLesson] || null;
  }, [courseSections, selectedSection, selectedLesson]);

  const completedMap = useMemo(() => {
    const map = {};
    progressData.progress?.completedLessons?.forEach((item) => {
      map[`${item.sectionIndex}:${item.lessonIndex}`] = true;
    });
    return map;
  }, [progressData.progress]);

  const currentLessonKey = `${selectedSection}:${selectedLesson}`;
  const selectedLessonCompleted = completedMap[currentLessonKey];

  const getNextLessonIndex = () => {
    const section = courseSections[selectedSection];
    const lessons = section?.lessons ?? section?.videos ?? [];
    if (selectedLesson + 1 < lessons.length) {
      return { sectionIndex: selectedSection, lessonIndex: selectedLesson + 1 };
    }
    if (selectedSection + 1 < courseSections.length) {
      return { sectionIndex: selectedSection + 1, lessonIndex: 0 };
    }
    return null;
  };

  const sectionLessons = courseSections[selectedSection]?.lessons ?? courseSections[selectedSection]?.videos ?? [];
  const sectionCompleted = sectionLessons.length > 0 && sectionLessons.every((_, index) => completedMap[`${selectedSection}:${index}`]);
  const sectionQuizUnlocked = sectionCompleted && progressData.enrolled && !videoLocked;

  const markLessonCompleted = async (completed = true) => {
    if (!course || !progressData.enrolled) {
      return;
    }

    setLessonSaving(true);
    try {
      const res = await API.put(`/enrollments/progress/${id}`, {
        sectionIndex: selectedSection,
        lessonIndex: selectedLesson,
        completed,
      });
      setProgressData(res.data);
      if (completed) {
        toast.success("Lesson marked complete.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to update lesson progress.");
    } finally {
      setLessonSaving(false);
    }
  };

  const getPreviousLessonIndex = () => {
    const lessons = courseSections[selectedSection]?.lessons ?? courseSections[selectedSection]?.videos ?? [];
    if (selectedLesson > 0) {
      return { sectionIndex: selectedSection, lessonIndex: selectedLesson - 1 };
    }
    if (selectedSection > 0) {
      const prevSection = courseSections[selectedSection - 1];
      const prevLessons = prevSection?.lessons ?? prevSection?.videos ?? [];
      return { sectionIndex: selectedSection - 1, lessonIndex: Math.max(prevLessons.length - 1, 0) };
    }
    return null;
  };

  const goToNextLesson = () => {
    const next = getNextLessonIndex();
    if (!next) {
      toast.success("You have finished the course lessons.");
      return;
    }
    const { sectionIndex, lessonIndex } = next;
    if (!hasCourseAccess && !(sectionIndex === 0 && lessonIndex === 0)) {
      toast.error(`Pay D${courseAccessPrice} to unlock the next lesson.`);
      return;
    }
    setSelectedSection(sectionIndex);
    setSelectedLesson(lessonIndex);
  };

  const goToPreviousLesson = () => {
    const prev = getPreviousLessonIndex();
    if (!prev) return;
    setSelectedSection(prev.sectionIndex);
    setSelectedLesson(prev.lessonIndex);
  };

  const handleVideoEnded = async () => {
    if (!progressData.enrolled || selectedLessonCompleted) {
      goToNextLesson();
      return;
    }
    await markLessonCompleted(true);
    goToNextLesson();
  };

  const fetchCourse = async () => {
    try {
      const courseRes = await API.get(`/courses/${id}`);
      setCourse(courseRes.data);
      setIsProtectedContent(false);
      setProtectedContentAccessDenied(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to load course");
    }
  };

  const fetchProtectedCourse = async () => {
    try {
      const protectedRes = await API.get(`/courses/${id}/content`);
      if (protectedRes?.data?.course) {
        setCourse(protectedRes.data.course);
        setIsProtectedContent(true);
        setProtectedContentAccessDenied(false);
      }
    } catch (protectedErr) {
      if (protectedErr?.response?.status === 403) {
        setProtectedContentAccessDenied(true);
      } else {
        console.error("Protected course fetch error:", protectedErr);
      }
    }
  };

  const fetchProgress = async () => {
    if (!user) return;
    try {
      setProgressLoading(true);
      const res = await API.get(`/enrollments/progress/${id}`);
      setProgressData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCourse();
      setLoading(false);
    };
    load();
  }, [id]);

  useEffect(() => {
    if (user) {
      fetchProtectedCourse();
      fetchProgress();
    }
  }, [id, user]);

  useEffect(() => {
    if (location.state?.selectedSection != null && location.state?.selectedLesson != null) {
      setSelectedSection(location.state.selectedSection);
      setSelectedLesson(location.state.selectedLesson);
    }
  }, [location.state]);

  useEffect(() => {
    const updateLocked = () => {
      const now = new Date();
      const valid = progressData.enrolled && (progressData.accessType === "full" || (progressData.accessType === "assessment" && progressData.validUntil && new Date(progressData.validUntil) > now));
      setVideoLocked(!valid);
    };
    updateLocked();
  }, [progressData]);

  useEffect(() => {
    if (!loading && user) {
      fetchProgress();
    }
  }, [loading, user]);

  useEffect(() => {
    if (isProtectedContent) {
      setVideoLocked(false);
    }
  }, [isProtectedContent]);

  const courseAccessPrice = course?.price || 2000;
  const hasCourseAccess = progressData.enrolled && progressData.accessType === "full";
  const isPreviewLesson = selectedSection === 0 && selectedLesson === 0;
  const freePreviewAllowed = !hasCourseAccess && isPreviewLesson;
  const selectedLessonUnlocked = hasCourseAccess || freePreviewAllowed;
  const firstLesson = courseSections[0]?.lessons?.[0] ?? courseSections[0]?.videos?.[0];
  const displayedVideo = selectedLessonUnlocked ? selectedVideo : firstLesson;
  const selectedVideoIsIntro = isPreviewLesson;

  const goToCourseContent = () => {
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goToPayment = (accessType) => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }

    navigate(`/payment/${id}`, {
      state: { course, accessType, email: user?.email },
    });
  };

  const handleSelectLesson = (sectionIndex, lessonIndex) => {
    const isIntro = sectionIndex === 0 && lessonIndex === 0;
    if (!hasCourseAccess && !isIntro) {
      toast.error(`Pay D${courseAccessPrice} to unlock full course access.`);
      setSelectedSection(0);
      setSelectedLesson(0);
      return;
    }

    setSelectedSection(sectionIndex);
    setSelectedLesson(lessonIndex);
  };

  const continueLearning = () => {
    if (videoLocked) {
      goToPayment("full");
      return;
    }
    if (!courseSections.length) return;
    const sectionIndex = selectedSection >= 0 ? selectedSection : 0;
    const lessonIndex = selectedLesson >= 0 ? selectedLesson : 0;
    setSelectedSection(sectionIndex);
    setSelectedLesson(lessonIndex);
    document.querySelector(".section-block")?.scrollIntoView({ behavior: "smooth" });
  };

  const startSectionQuiz = async () => {
    const section = courseSections[selectedSection];
    if (!section || !section.quizzes || section.quizzes.length === 0) {
      toast.error("No quiz available for this section.");
      return;
    }

    // Get the first active quiz for this section
    const sectionQuiz = section.quizzes.find(sq => sq.isActive);
    if (!sectionQuiz || !sectionQuiz.quizId) {
      toast.error("Quiz data is not available.");
      return;
    }

    if (!progressData.enrolled) {
      toast.error("You must enroll or have access to start this section quiz.");
      return;
    }
    if (!sectionQuizUnlocked) {
      toast.error("Complete all lessons in this section to unlock the quiz.");
      return;
    }

    setSectionAssessmentLoading(true);
    toast.loading("Starting section quiz...");
    try {
      const res = await API.post(`/quiz/course-section/start/${sectionQuiz.quizId}`);

      const { attemptId, questions, timeLimit } = res.data;
      if (!attemptId) {
        throw new Error("No attempt ID returned from server");
      }

      const assessmentMeta = {
        questions,
        timeLimit,
        title: `${section.title} Quiz`,
        course: { title: course.title, _id: course._id },
        section: { title: section.title, _id: section._id },
      };
      sessionStorage.setItem("currentAssessment", JSON.stringify(assessmentMeta));
      toast.dismiss();
      navigate(`/assessment/${attemptId}`);
    } catch (err) {
      console.error("Section quiz start error:", err);
      toast.dismiss();
      const errorMsg = err.response?.data?.message || err.message || "Unable to start section quiz. Please check your connection.";
      toast.error(errorMsg);
    } finally {
      setSectionAssessmentLoading(false);
    }
  };

  const toggleCompleted = async () => {
    if (!course) return;
    if (!progressData.enrolled) {
      toast.error("You must enroll to track progress.");
      return;
    }

    const key = `${selectedSection}:${selectedLesson}`;
    const completed = !completedMap[key];

    try {
      const res = await API.put(`/enrollments/progress/${id}`, {
        sectionIndex: selectedSection,
        lessonIndex: selectedLesson,
        completed,
      });
      setProgressData(res.data);
      toast.success(completed ? "Marked lesson complete" : "Marked lesson incomplete");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to update progress.");
    }
  };

  if (loading) {
    return <div className="course-detail-loading">Loading course...</div>;
  }

  if (!course) {
    return <div className="course-detail-error">Course not found.</div>;
  }

  const selectedSectionMeta = courseSections[selectedSection] || {};
  const currentVideoUrl = getStreamableVideoUrl(displayedVideo?.videoUrl || displayedVideo?.url || "");
  const embedUrl = getYouTubeEmbedUrl(displayedVideo?.videoUrl || displayedVideo?.url || "");
  const currentVideoBlocked = Boolean(displayedVideo?.videoUrl || displayedVideo?.url) && !currentVideoUrl && !embedUrl;
  const videoUnavailable = !currentVideoUrl && !embedUrl;
  const totalLessonsCount = courseSections.reduce((acc, section) => {
    const lessons = section.lessons ?? section.videos;
    return acc + (lessons?.length || 0);
  }, 0);
  const progressPercentage = totalLessonsCount ? Math.round((Object.keys(completedMap).length / totalLessonsCount) * 100) : 0;
  const totalSections = courseSections.length;
  const rating = course.rating || 4.8;
  const learners = course.learners || 1245;
  const lastUpdated = course.updatedAt ? new Date(course.updatedAt).toLocaleDateString() : "Jan 2025";
  const courseCompleted = progressPercentage >= 100 || progressData.completed;
  const certificateReady = courseCompleted && course.certificateEnabled;
  const nextLessonIndex = getNextLessonIndex();
  const selectedLessonProgress = Math.max(0, Math.min(100, Math.round((selectedLesson / Math.max(sectionLessons.length, 1)) * 100)));
  const thumbnailUrl = course.thumbnail || course.coverImage || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80";
  const courseVideoTitle = displayedVideo?.title || course.title;
  const courseVideoDuration = displayedVideo?.duration || course.duration || "00:00";
  const tabItems = ["About", "Resources", "Q&A (12)", "Announcements"];

  const upcomingDeadlines = [
    { title: `${selectedSectionMeta.title || `Section ${selectedSection + 1}`} Quiz`, date: "May 15, 2026" },
    { title: "Grammar Assignment 1", date: "May 20, 2026" },
  ];

  const courseQuickStats = [
    { label: "Lessons", value: totalLessonsCount },
    { label: "Duration", value: course.duration || "3h 45m" },
    { label: "Avg. Score", value: "84%" },
    { label: "Certificates", value: course.certificateEnabled ? 1 : 0 },
  ];

  const progressDonutStyle = {
    background: `conic-gradient(#7c3aed ${progressPercentage}%, rgba(255,255,255,0.08) ${progressPercentage}% 100%)`,
  };

  const sectionLessonProgress = (sectionIndex, lessons) => {
    const completed = lessons.reduce((count, _, idx) => count + (completedMap[`${sectionIndex}:${idx}`] ? 1 : 0), 0);
    return `${completed} / ${lessons.length}`;
  };

  const totalDurationLabel = course.duration || "3h 45m";
  const instructorName = course.instructor?.name || "ESNEX Educator";

  return (
    <div className="course-detail-page">
      <section className="course-detail-hero">
        <div className="course-hero-copy">
          <div className="course-hero-top">
            <span className="hero-badge">Beginner</span>
            <span className="hero-rating">⭐ {rating.toFixed(1)} ({learners})</span>
          </div>
          <h1>{course.title}</h1>
          <p>{course.description || "Improve your skills with lessons on grammar, writing, and comprehension."}</p>
        </div>
        <div className="course-hero-progress-card">
          <p className="sidebar-widget-title">Course Progress</p>
          <div className="hero-progress-bar">
            <div className="hero-progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <span className="hero-progress-label">{progressPercentage}% Complete</span>
        </div>
      </section>
      <div className="course-detail-grid three-column-layout">
        <aside className="course-sidebar sidebar-left">
          <section className="sidebar-card modern-card course-details-widget">
            <p className="sidebar-card-title">COURSE DETAILS</p>
            <div className="course-thumbnail-small" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
            <h3>{course.title}</h3>
            <div className="course-meta-badges">
              <span className="badge-level">Beginner</span>
              <span className="badge-rating">⭐ {rating.toFixed(1)} ({learners})</span>
            </div>
            <p className="course-short-desc">{course.description?.substring(0, 120)}</p>
          </section>

          <section className="sidebar-card modern-card instructor-widget-enhanced">
            <p className="sidebar-widget-title">Instructor</p>
            <div className="instructor-detail-body">
              <div className="instructor-avatar-large">
                <img src={course.instructor?.avatar || "https://via.placeholder.com/120"} alt={instructorName} />
              </div>
              <h4>{instructorName}</h4>
              <p className="instructor-role">{course.instructor?.role || "Expert Instructor"}</p>

              <div className="instructor-stats">
                <div className="instructor-stat">
                  <span className="stat-value">⭐ {rating.toFixed(1)}</span>
                  <span className="stat-label">Instructor Rating</span>
                </div>
                <div className="instructor-stat">
                  <span className="stat-value">{learners}</span>
                  <span className="stat-label">Students Taught</span>
                </div>
              </div>

              <p className="instructor-bio">
                {course.instructor?.bio || "Experienced educator dedicated to helping students succeed."}
              </p>

              <button 
                type="button" 
                className="btn-primary full-width"
                onClick={() => toast.success(`View ${instructorName}'s profile - Coming soon!`)}
              >
                View Profile
              </button>
              {!hasCourseAccess && (
                <button
                  type="button"
                  className="btn-secondary full-width"
                  onClick={() => goToPayment("full")}
                >
                  Enroll for D{courseAccessPrice}
                </button>
              )}
            </div>
          </section>
        </aside>

        <main className="course-detail-main">

          <section className="course-video-card modern-card" style={!embedUrl ? { backgroundImage: `linear-gradient(180deg, rgba(2, 12, 33, 0.28), rgba(2, 10, 24, 0.96)), url(${thumbnailUrl})` } : {}}>
            <div className="course-video-card-header">
              <div className="course-video-breadcrumb">
                <span>{course.title}</span>
                <span className="divider">›</span>
                <span>{selectedSectionMeta.title || `Section ${selectedSection + 1}`}</span>
                <span className="divider">›</span>
                <span>Lesson {selectedLesson + 1}</span>
              </div>
              <button type="button" className="fullscreen-button">Fullscreen</button>
            </div>
            <div className="course-access-top">
              {hasCourseAccess ? (
                <span className="course-badge purchased">Purchased</span>
              ) : (
                <span className="course-badge preview">Preview Free</span>
              )}
              {!hasCourseAccess && (
                <div className="course-pay-note">
                  Pay D{courseAccessPrice} to unlock full course access.
                </div>
              )}
            </div>

            {protectedContentAccessDenied && !freePreviewAllowed ? (
              <div className="course-video-player course-video-fallback">
                <div className="course-video-error">
                  <strong>Video locked</strong>
                  <p>You have access to this course, but full lesson content is restricted until you enroll or complete payment.</p>
                </div>
                <button type="button" className="btn-primary course-video-source-button" onClick={() => goToPayment("full")}>Pay to unlock</button>
              </div>
            ) : embedUrl ? (
              <div className="course-video-player course-video-embed">
                <iframe
                  src={embedUrl}
                  title="YouTube lesson"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="course-video-iframe"
                />
                {videoLocked && !freePreviewAllowed && (
                  <div className="course-video-overlay">
                    <div>
                      <strong>Unlock to watch</strong>
                      <p>Pay D{courseAccessPrice}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : currentVideoUrl ? (
              <div className="course-video-player">
                <video
                  ref={videoRef}
                  src={currentVideoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="course-native-player"
                  onCanPlay={() => setVideoPlaybackReady(true)}
                  onEnded={handleVideoEnded}
                />
                {videoLocked && !freePreviewAllowed && (
                  <div className="course-video-overlay">
                    <div>
                      <strong>Unlock to watch</strong>
                      <p>Pay D{courseAccessPrice}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="course-video-player course-video-fallback">
                <div className="course-video-error">
                  <strong>No video available</strong>
                  <p>Please update the lesson with a video source.</p>
                </div>
                {(displayedVideo?.videoUrl || displayedVideo?.url) && (
                  <button
                    type="button"
                    className="btn-primary course-video-source-button"
                    onClick={() => window.open(displayedVideo?.videoUrl || displayedVideo?.url, "_blank")}
                  >
                    Open lesson source
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="lesson-details-card modern-card">
            <div className="lesson-detail-header">
              <div className="lesson-breadcrumb">
                <span>{selectedSectionMeta.title || `Section ${selectedSection + 1}`}</span>
                <span className="divider">•</span>
                <span>Lesson {selectedLesson + 1} of {sectionLessons.length}</span>
              </div>
              <h2>{courseVideoTitle}</h2>
              <p className="lesson-description">{displayedVideo?.description || course.description?.substring(0, 200) || "Learn the key concepts in this lesson."}</p>
            </div>

            <div className="lesson-objectives">
              <h4>What you'll learn:</h4>
              {selectedSectionMeta?.objectives && selectedSectionMeta.objectives.length > 0 ? (
                <ul>
                  {selectedSectionMeta.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              ) : (
                <ul>
                  <li>Master key concepts and techniques</li>
                  <li>Understand real-world applications</li>
                  <li>Practice with hands-on examples</li>
                </ul>
              )}
            </div>

            <div className="lesson-detail-badges">
              <span>⭐ {rating.toFixed(1)} Rating</span>
              <span>👥 {learners} Learners</span>
              <span>⏱️ {courseVideoDuration}</span>
            </div>

            <div className="lesson-control-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={goToPreviousLesson}
                disabled={!getPreviousLessonIndex()}
              >
                ← Previous
              </button>
              <button
                type="button"
                className={`btn-outline ${selectedLessonCompleted ? "completed" : ""}`}
                onClick={() => markLessonCompleted(!selectedLessonCompleted)}
                disabled={!progressData.enrolled || lessonSaving}
              >
                {selectedLessonCompleted ? "✓ Completed" : "Mark Complete"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={goToNextLesson}
                disabled={!nextLessonIndex || lessonSaving}
              >
                Next →
              </button>
            </div>
          </section>

        </main>

        <aside className="course-sidebar sidebar-right">
          <section className="sidebar-card modern-card progress-widget">
            <p className="sidebar-widget-title">Course Progress</p>
            <div className="progress-card-top">
              <div>
                <strong>{progressPercentage}%</strong>
                <p className="progress-summary">Complete</p>
              </div>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
            </div>
            <div className="progress-stats-grid">
              <div className="progress-stat-card">
                <strong>{totalLessonsCount}</strong>
                <span>Lessons</span>
              </div>
              <div className="progress-stat-card">
                <strong>{totalSections}</strong>
                <span>Sections</span>
              </div>
              <div className="progress-stat-card">
                <strong>{totalDurationLabel}</strong>
                <span>Duration</span>
              </div>
            </div>
          </section>

          <section className="sidebar-card modern-card course-content-widget">
            <div className="course-content-header">
              <div>
                <p className="sidebar-widget-title">Course Content</p>
                <span className="course-content-progress">{progressPercentage}% Complete</span>
              </div>
              <div className="course-content-progressbar">
                <div className="course-content-progressbar-fill" style={{ width: `${progressPercentage}%` }} />
              </div>
            </div>
            <div className="course-sections-list">
              {courseSections.map((section, sectionIndex) => {
                const lessons = section.lessons ?? section.videos ?? [];
                const sectionProgress = sectionLessonProgress(sectionIndex, lessons);
                const sectionCompleted = lessons.length > 0 && lessons.every((_, idx) => completedMap[`${sectionIndex}:${idx}`]);
                return (
                  <div key={`content-section-${sectionIndex}`} className="course-section-card expanded">
                    <div className="course-section-card-header">
                      <div>
                        <h4>{section.title || `Section ${sectionIndex + 1}`}</h4>
                        <p className="section-lesson-count">{lessons.length} lessons</p>
                      </div>
                      <span className="section-progress-badge">{sectionProgress}</span>
                    </div>
                    <div className="course-lessons-list">
                      {lessons.map((lesson, lessonIndex) => {
                        const lessonKey = `${sectionIndex}:${lessonIndex}`;
                        const completed = completedMap[lessonKey];
                        const isActive = sectionIndex === selectedSection && lessonIndex === selectedLesson;
                        const isIntro = sectionIndex === 0 && lessonIndex === 0;
                        const lessonLocked = !hasCourseAccess && !isIntro;
                        return (
                          <button
                            key={lessonKey}
                            type="button"
                            className={`lesson-item ${isActive ? "active" : ""} ${lessonLocked ? "locked-lesson" : ""}`}
                            onClick={() => handleSelectLesson(sectionIndex, lessonIndex)}
                            disabled={lessonLocked}
                            aria-label={lessonLocked ? "Locked lesson" : `Lesson ${lessonIndex + 1}`}
                          >
                            <div className="lesson-item-content">
                              <span className="lesson-number">{lessonIndex + 1}</span>
                              <div>
                                <span className="lesson-title">{lesson.title || `Lesson ${lessonIndex + 1}`}</span>
                                <small className="lesson-duration">{lesson.duration || "Video"}</small>
                              </div>
                            </div>
                            <div className="lesson-status">
                              {completed && <span className="status-completed">✓</span>}
                              {lessonLocked && <span className="status-locked">🔒</span>}
                              {!completed && !lessonLocked && <span className="status-play">▶</span>}
                            </div>
                          </button>
                        );
                      })}
                      {section.quizzes && section.quizzes.some(sq => sq.isActive) && (
                        <button
                          type="button"
                          className={`lesson-item quiz-button ${sectionCompleted ? "unlocked" : "locked"}`}
                          onClick={() => {
                            setSelectedSection(sectionIndex);
                            if (sectionCompleted) {
                              startSectionQuiz();
                            } else {
                              toast.error("Complete all lessons first!");
                            }
                          }}
                          disabled={!sectionCompleted}
                        >
                          <div className="lesson-item-content">
                            <span className="quiz-icon">🧠</span>
                            <div>
                              <span className="lesson-title">Section Quiz</span>
                              <small className="quiz-status">{sectionCompleted ? "Ready" : "Complete lessons first"}</small>
                            </div>
                          </div>
                          <span className="quiz-lock">{sectionCompleted ? "→" : "🔒"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn btn-secondary full-width download-resources-button">
              Download Course Resources
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
