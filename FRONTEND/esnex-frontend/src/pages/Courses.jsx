import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { isLoggedIn } from "../utils/auth";
import { AuthContext } from "../context/AuthContext";
import "../styles/courses-page.css";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect width='400' height='200' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23737475' font-family='Arial, sans-serif' font-size='24'%3ECourse Image%3C/text%3E%3C/svg%3E";

const Courses = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedPrice, setSelectedPrice] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Quick stats data
  const stats = [
    {
      icon: "📚",
      value: courses.length,
      label: "Total Courses"
    },
    {
      icon: "👥",
      value: "2,500+",
      label: "Students"
    },
    {
      icon: "⭐",
      value: "4.8",
      label: "Avg Rating"
    },
    {
      icon: "🎓",
      value: "95%",
      label: "Completion"
    }
  ];

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, [user]);

  useEffect(() => {
    filterCourses();
  }, [courses, searchTerm, selectedCategory, selectedLevel, selectedPrice]);

  const loadCourses = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get("/courses");
      setCourses(response.data.courses || response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load courses");
      console.error("Error loading courses:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    if (!user) return;

    try {
      const response = await axios.get("/enrollments/my-courses");
      setEnrollments(response.data || []);
    } catch (err) {
      console.error("Failed to load enrollments", err);
    }
  };

  const filterCourses = () => {
    // This will be handled in the filteredCourses computation below
  };

  const enroll = (course, accessType = "full") => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }

    navigate(`/payment/${course._id}`, { state: { course, accessType, email: user?.email } });
  };

  const getProgressBadge = (course) => {
    // Simulate progress based on enrollment or random for demo
    const progress = course.progress || Math.floor(Math.random() * 100);
    if (progress >= 80) return { text: "Complete", type: "complete" };
    if (progress > 0) return { text: `${progress}% Complete`, type: "in-progress" };
    if (course.enrollmentCount > 50) return { text: "Best Seller", type: "bestseller" };
    if (course.rating > 4.5) return { text: "Popular", type: "popular" };
    return { text: "New Course", type: "new" };
  };

  const getCourseIcon = (title, category) => {
    const lowerTitle = title.toLowerCase();
    const lowerCategory = category.toLowerCase();

    if (lowerTitle.includes('math') || lowerCategory.includes('math')) return '🧮';
    if (lowerTitle.includes('english') || lowerTitle.includes('language') || lowerCategory.includes('english')) return '📚';
    if (lowerTitle.includes('science') || lowerCategory.includes('science')) return '🧪';
    if (lowerTitle.includes('computer') || lowerTitle.includes('it') || lowerCategory.includes('it')) return '💻';
    if (lowerTitle.includes('business') || lowerCategory.includes('commerce')) return '💼';
    if (lowerTitle.includes('art') || lowerCategory.includes('arts')) return '🎨';
    return '📖'; // default book icon
  };

  const getCourseClass = (category) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('math')) return 'course-math';
    if (lowerCategory.includes('english')) return 'course-english';
    if (lowerCategory.includes('science')) return 'course-science';
    if (lowerCategory.includes('it')) return 'course-it';
    return 'course-default';
  };

  const getInstructorInitials = (name) => {
    if (!name) return "IN";
    return name
      .split(" ")
      .filter((word) => word)
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getBadgeType = (course, index) => {
    if (course.enrollment > 100 || course.enrollmentCount > 100) return "bestseller";
    if (course.rating > 4.5) return "popular";
    if (course.createdAt && new Date(course.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) return "new";
    return "certified";
  };

  const getBadgeText = (type) => {
    switch (type) {
      case "bestseller": return "Bestseller";
      case "popular": return "Popular";
      case "new": return "New";
      case "certified": return "Certified";
      default: return "Premium";
    }
  };

  // Filter and sort courses
  const filteredCourses = courses
    .filter((course) => {
      const title = course.title || "";
      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (course.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      const category = course.category || "IT";
      const level = course.level || "Beginner";
      const matchesCategory = selectedCategory === "all" || category === selectedCategory;
      const matchesLevel = selectedLevel === "all" || level === selectedLevel;
      const coursePrice = Number(course.price || 0);

      let matchesPrice = true;
      if (selectedPrice === "Under D1000") matchesPrice = coursePrice < 1000;
      else if (selectedPrice === "D1000 - D2000") matchesPrice = coursePrice >= 1000 && coursePrice <= 2000;
      else if (selectedPrice === "D2000+") matchesPrice = coursePrice > 2000;

      return matchesSearch && matchesCategory && matchesLevel && matchesPrice;
    })
    .sort((a, b) => (b.enrollment || 0) - (a.enrollment || 0)); // Sort by popularity

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCourses = filteredCourses.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="courses-page">
        <div className="courses-container">
          <div className="courses-loading">Loading premium courses...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="courses-page">
        <div className="courses-container">
          <div className="courses-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="courses-page">
      <div className="courses-container">
        {/* Quick Stats Bar */}
        <div className="courses-stats-bar">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-content">
                <h3>{stat.value}</h3>
                <p>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="courses-header">
          <h1>Explore Premium Courses</h1>
          <p>Discover expertly crafted courses designed to accelerate your career growth</p>
        </div>

        {/* Search & Filters */}
        <div className="courses-controls">
          <div className="courses-search">
            <label htmlFor="courses-search-input" className="sr-only">Search courses</label>
            <input
              id="courses-search-input"
              aria-label="Search courses"
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="courses-search-input"
            />
            <div className="search-icon">🔍</div>
          </div>

          <div className="courses-filters">
            <label htmlFor="filter-category" className="sr-only">Filter by category</label>
            <select
              value={selectedCategory}
              id="filter-category"
              aria-label="Filter by category"
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="courses-filter-select"
            >
              <option value="all">All Categories</option>
              <option value="IT">Technology</option>
              <option value="Science">Science</option>
              <option value="Commerce">Commerce</option>
              <option value="Arts">Arts</option>
              <option value="Language">Language</option>
            </select>

            <label htmlFor="filter-level" className="sr-only">Filter by level</label>
            <select
              value={selectedLevel}
              id="filter-level"
              aria-label="Filter by level"
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setCurrentPage(1);
              }}
              className="courses-filter-select"
            >
              <option value="all">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <label htmlFor="filter-price" className="sr-only">Filter by price</label>
            <select
              value={selectedPrice}
              id="filter-price"
              aria-label="Filter by price"
              onChange={(e) => {
                setSelectedPrice(e.target.value);
                setCurrentPage(1);
              }}
              className="courses-filter-select"
            >
              <option value="all">All Prices</option>
              <option value="Under D1000">Under D1000</option>
              <option value="D1000 - D2000">D1000 - D2000</option>
              <option value="D2000+">D2000+</option>
            </select>
          </div>
        </div>

        {/* Courses Grid */}
        {currentCourses.length === 0 ? (
          <div className="courses-empty">
            <p>No courses found matching your criteria. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="courses-grid">
              {currentCourses.map((course, index) => {
                const badgeType = getBadgeType(course, index);
                const badgeText = getBadgeText(badgeType);
                const progressBadge = getProgressBadge(course);
                const instructorName =
                  typeof course.instructor === "string"
                    ? course.instructor
                    : course.instructor?.name || "Course Instructor";
                const instructorInitials = getInstructorInitials(instructorName);
                const isEnrolled = enrollments.some((e) => {
                  const courseId = e.course?._id ? e.course._id.toString() : e.course?.toString();
                  return courseId === course._id;
                });

                const originalPrice = (course.price || 2000) * 1.3;
                const discount = Math.round(((originalPrice - (course.price || 2000)) / originalPrice) * 100);
                const courseIcon = getCourseIcon(course.title, course.category || "IT");
                const courseClass = getCourseClass(course.category || "IT");

                return (
                  <div key={course._id} className={`course-card ${courseClass}`} onClick={() => navigate(`/course/${course._id}`)}>
                    {/* Course Thumbnail */}
                    <div className="course-thumbnail">
                      <img
                        src={course.thumbnail || PLACEHOLDER_IMAGE}
                        alt={course.title}
                        onError={(e) => {
                          if (e.target.src !== PLACEHOLDER_IMAGE) {
                            e.target.src = PLACEHOLDER_IMAGE;
                          }
                        }}
                      />

                      {/* Branded Illustration Overlay */}
                      <div className="course-illustration">
                        {courseIcon}
                      </div>

                      {/* Premium Badge */}
                      <div className={`course-badge ${badgeType}`}>
                        {badgeText}
                      </div>

                      {/* Progress Badge */}
                      <div className={`course-progress-badge ${progressBadge.type === 'complete' ? 'complete' : ''}`}>
                        {progressBadge.text}
                      </div>

                      {/* Wishlist Button */}
                      <button
                        type="button"
                        className="course-wishlist"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add to wishlist functionality
                        }}
                      >
                        ♥
                      </button>
                    </div>

                    {/* Card Content */}
                    <div className="course-card-content">
                      <h3 className="course-title">{course.title}</h3>
                      <p className="course-description">{course.description}</p>

                      {/* Instructor */}
                      <div className="course-instructor">
                        <div className="instructor-avatar">
                          {instructorInitials}
                        </div>
                        <span className="instructor-name">{instructorName}</span>
                      </div>

                      {/* Rating & Stats */}
                      <div className="course-rating">
                        <span className="rating-stars">
                          {"★".repeat(Math.floor(course.rating || 4.5))}
                          {"☆".repeat(5 - Math.floor(course.rating || 4.5))}
                        </span>
                        <span className="rating-count">
                          ({course.enrollment || Math.floor(Math.random() * 500) + 100})
                        </span>
                      </div>

                      {/* Course Meta */}
                      <div className="course-meta">
                        <span className={`meta-level ${course.level?.toLowerCase()}`}>
                          {course.level || "Beginner"}
                        </span>
                        <span>📚 {course.lectures || Math.floor(Math.random() * 50) + 10} lectures</span>
                        <span>⏱️ {course.duration || `${Math.floor(Math.random() * 20) + 5}h`} total</span>
                      </div>

                      {/* Pricing */}
                      <div className="course-pricing">
                        <span className="price-original">D{originalPrice.toLocaleString()}</span>
                        <span className="price-current">D{(course.price || 2000).toLocaleString()}</span>
                        <span className="discount-badge">{discount}% OFF</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="course-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/course/${course._id}`);
                          }}
                        >
                          View Course
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEnrolled) {
                              navigate(`/course/${course._id}`);
                            } else {
                              enroll(course, "full");
                            }
                          }}
                        >
                          {isEnrolled ? "Continue Course" : "Enroll Now"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="courses-pagination">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCourses.length)} of{" "}
                {filteredCourses.length} courses
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`pagination-btn ${currentPage === page ? "pagination-btn--active" : ""}`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next →
                </button>
              </div>

              <div className="pagination-per-page">
                <label htmlFor="per-page-select">
                  Show
                  <select
                    id="per-page-select"
                    aria-label="Results per page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="per-page-select"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                  </select>
                  per page
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Courses;
