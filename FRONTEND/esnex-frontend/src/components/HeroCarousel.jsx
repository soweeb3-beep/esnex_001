import { useEffect, useState } from 'react';

const DEFAULT_SLIDES = [
    {
      tagline: "KEEP LEARNING, KEEP GROWING",
      title: "Success is built",
      titleHighlight: "one step",
      titleEnd: "at a time.",
      description: "Stay consistent, stay focused, and achieve your goals.",
      buttonText: "Explore Courses",
      image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop",
      stats: [
        { icon: "📚", value: "12", label: "Courses Enrolled", change: "+ 2 this week" },
        { icon: "📋", value: "8", label: "Assessments Taken", change: "+ 3 this week" },
        { icon: "✅", value: "5", label: "Courses Completed", change: "+ 1 this week" },
        { icon: "🏆", value: "3", label: "Certificates Earned", change: "View all" }
      ],
      assessmentCard: {
        title: "WAEC Mock Test",
        dueTime: "Tomorrow, 10:00 AM",
        questions: "20 Questions • 30 mins",
        timeLeft: { hours: 23, mins: 45, secs: 12 }
      }
    },
    {
      tagline: "MASTER YOUR SKILLS",
      title: "Learn at your own",
      titleHighlight: "pace",
      titleEnd: "and progress.",
      description: "Access comprehensive courses with expert instructors anytime.",
      buttonText: "Browse Courses",
      image: "https://images.unsplash.com/photo-1516534775068-bb6a25b26c5d?w=600&h=400&fit=crop",
      stats: [
        { icon: "👥", value: "5K+", label: "Active Learners", change: "+ Growing daily" },
        { icon: "⭐", value: "4.8", label: "Avg Rating", change: "From 2K reviews" },
        { icon: "🎯", value: "95%", label: "Success Rate", change: "+ Top courses" },
        { icon: "🚀", value: "200+", label: "Career Skills", change: "Available now" }
      ],
      assessmentCard: {
        title: "Mathematics Quiz",
        dueTime: "Today, 3:00 PM",
        questions: "15 Questions • 25 mins",
        timeLeft: { hours: 2, mins: 30, secs: 45 }
      }
    },
    {
      tagline: "ACHIEVE YOUR GOALS",
      title: "Transform your",
      titleHighlight: "future",
      titleEnd: "today.",
      description: "Get certified and advance your career with ESNEX.",
      buttonText: "Start Learning",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
      stats: [
        { icon: "🎓", value: "500+", label: "Certificates Issued", change: "+ 50 this month" },
        { icon: "💼", value: "10K", label: "Job Placements", change: "Partner companies" },
        { icon: "📈", value: "89%", label: "Salary Increase", change: "Avg for graduates" },
        { icon: "🌍", value: "150+", label: "Countries", change: "Students worldwide" }
      ],
      assessmentCard: {
        title: "Biology Assessment",
        dueTime: "Next Monday, 9:00 AM",
        questions: "25 Questions • 45 mins",
        timeLeft: { hours: 72, mins: 15, secs: 30 }
      }
    },
    {
      tagline: "JOIN OUR COMMUNITY",
      title: "Connect with thousands of",
      titleHighlight: "learners",
      titleEnd: "worldwide.",
      description: "Share knowledge, network, and grow together with peers.",
      buttonText: "Join Community",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
      stats: [
        { icon: "👥", value: "50K+", label: "Community Members", change: "+ 1K monthly" },
        { icon: "💬", value: "100K", label: "Forum Posts", change: "Active discussions" },
        { icon: "🤝", value: "200+", label: "Study Groups", change: "All subjects" },
        { icon: "🏅", value: "99%", label: "Satisfaction", change: "From members" }
      ],
      assessmentCard: {
        title: "Group Project Review",
        dueTime: "Friday, 6:00 PM",
        questions: "Team Submission • 120 mins",
        timeLeft: { hours: 48, mins: 20, secs: 0 }
      }
    }
  ];

const HeroCarousel = ({ compact = false, slides: propsSlides = [], initialSlide = 0, minimal = false, activeIndex }) => {
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const [timeLeft, setTimeLeft] = useState(5);

  const slides = Array.isArray(propsSlides) && propsSlides.length ? propsSlides : DEFAULT_SLIDES;
  const slide = slides[currentSlide] || slides[0] || DEFAULT_SLIDES[0];
  const durationSeconds = Number(slide.durationSeconds) > 0 ? Number(slide.durationSeconds) : 5;
  const hasVideo = slide.videoUrl && String(slide.videoUrl).trim().length > 0;
  const mediaSrc = hasVideo ? String(slide.videoUrl).trim() : slide.image || DEFAULT_SLIDES[0].image;

  useEffect(() => {
    setCurrentSlide(Math.min(Math.max(0, initialSlide), slides.length - 1));
  }, [initialSlide, slides.length]);

  // Support controlled active index (admin preview passes selected index)
  useEffect(() => {
    if (typeof activeIndex === "number") {
      const idx = Math.min(Math.max(0, activeIndex), slides.length - 1);
      setCurrentSlide(idx);
      setTimeLeft(Number(slides[idx]?.durationSeconds) || 5);
    }
  }, [activeIndex, slides]);

  useEffect(() => {
    const newDuration = Number(slides[currentSlide]?.durationSeconds) > 0 ? Number(slides[currentSlide].durationSeconds) : 5;
    setTimeLeft(newDuration);
  }, [currentSlide]);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && slides.length > 0) {
      setCurrentSlide((prevIndex) => (prevIndex + 1) % slides.length);
    }
  }, [timeLeft, slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setTimeLeft(5);
  };

  const nextSlide = () => {
    goToSlide((currentSlide + 1) % slides.length);
  };

  const prevSlide = () => {
    goToSlide((currentSlide - 1 + slides.length) % slides.length);
  };


  if (compact) {
    if (minimal) {
      return (
        <div className="hero-carousel-container hero-carousel-compact" style={{ width: '100%', minHeight: 320 }}>
            <div className="hero-carousel-compact-wrapper" style={{ minHeight: 320 }}>
              {hasVideo ? (
                <video
                  className="hero-main-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  src={mediaSrc}
                  poster={slide.image || DEFAULT_SLIDES[0].image}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img className="hero-main-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={mediaSrc} alt="hero" />
              )}
              <button className="carousel-arrow carousel-arrow-prev" onClick={prevSlide} aria-label="Previous slide" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>&#10094;</button>
              <button className="carousel-arrow carousel-arrow-next" onClick={nextSlide} aria-label="Next slide" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>&#10095;</button>
              {slide.description ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ pointerEvents: 'auto', backgroundColor: 'rgba(0,0,0,0.35)', color: '#e2e8f0', padding: '0.75rem 1rem', borderRadius: '0.5rem', maxWidth: '80%', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.4' }}>{slide.description}</p>
                  </div>
                </div>
              ) : null}

              <div className="carousel-dots compact-dots" style={{ position: 'absolute', bottom: 14, left: 16 }}>
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    className={`dot ${idx === currentSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
        </div>
      );
    }

    return (
      <div className="hero-carousel-container hero-carousel-compact">
        <div className="hero-carousel-slide hero-carousel-slide-compact">
          {hasVideo ? (
            <video
              className="hero-main-img compact-preview-img"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              src={mediaSrc}
              poster={slide.image || DEFAULT_SLIDES[0].image}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img className="hero-main-img compact-preview-img" src={mediaSrc} alt="hero preview" />
          )}
          <div className="compact-preview-overlay" />
          <div className="compact-preview-badge">Homepage preview</div>
          {typeof activeIndex === 'number' || slides.length > 1 ? (
            <div className="compact-active-badge">Previewing slide {currentSlide + 1}</div>
          ) : null}
          <div className="compact-preview-card">
            <p className="carousel-tagline compact-tagline">{slide.tagline || 'Homepage preview'}</p>
            <h3 className="compact-title">{slide.title || 'Live preview title'} <span className="highlight">{slide.titleHighlight || ''}</span> {slide.titleEnd || ''}</h3>
            <p className="compact-description">{slide.description || 'Edit the text and image fields to update this preview instantly.'}</p>
          </div>
          <div className="carousel-dots compact-dots">
            {slides.map((_, idx) => (
              <button
                key={idx}
                className={`dot ${idx === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-carousel-container">
      <div className="hero-carousel-slide" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '1rem', overflow: 'hidden' }}>
          {hasVideo ? (
            <video
              className="hero-main-img"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              src={mediaSrc}
              poster={slide.image || DEFAULT_SLIDES[0].image}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img className="hero-main-img" src={mediaSrc} alt="hero" />
          )}
          <div className="hero-badge" style={{ position: 'absolute', left: '1rem', bottom: '1rem', background: 'rgba(10,20,40,0.9)', color: '#fff', padding: '0.6rem 0.9rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎓</span>
            <div style={{ fontSize: '0.95rem' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Trusted by</div>
              <div style={{ fontWeight: 700 }}>Thousands of Learners</div>
            </div>
          </div>
        </div>
        {/* Navigation Arrows */}
        <button className="carousel-arrow carousel-arrow-prev" onClick={prevSlide} aria-label="Previous slide">
          &#10094;
        </button>
        <button className="carousel-arrow carousel-arrow-next" onClick={nextSlide} aria-label="Next slide">
          &#10095;
        </button>

        {/* Slide Counter & Timer */}
        <div className="carousel-header-info">
          <span className="slide-counter">Slide {currentSlide + 1} of {slides.length}</span>
          <span className="slide-timer">{timeLeft}s</span>
        </div>

        {/* Main Content */}
        <div className="carousel-content-wrapper">
          <div className="carousel-content">
            <p className="carousel-tagline">{slide.tagline || 'Homepage preview'}</p>
            <h1 className="carousel-title">
              {slide.title || 'Live preview title'} <span className="highlight">{slide.titleHighlight || ''}</span> {slide.titleEnd || ''}
            </h1>
            <p className="carousel-description">{slide.description || 'Edit the text and image fields to update this preview instantly.'}</p>
            <button className="btn btn-primary carousel-btn">{slide.buttonText || 'Preview CTA'} →</button>
          </div>

          {/* Right Panel with Stats and Assessment */}
          <div className="carousel-right-panel">
            {/* Stats Grid */}
            <div className="carousel-stats-grid">
              {(slide.stats || DEFAULT_SLIDES[0].stats).map((stat, idx) => (
                <div key={idx} className="carousel-stat-item">
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-content">
                    <strong>{stat.value}</strong>
                    <p className="stat-label">{stat.label}</p>
                    <span className="stat-change">{stat.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Assessment Card */}
            <div className="carousel-assessment-card">
              <p className="assessment-label">UPCOMING ASSESSMENT</p>
              <h3>{slide.assessmentCard?.title || 'Live preview card'}</h3>
              <p className="assessment-due">{slide.assessmentCard?.dueTime || 'Edit the hero copy to change this label.'}</p>
              <p className="assessment-meta">{slide.assessmentCard?.questions || 'Image and text updates appear here instantly.'}</p>

              <div className="assessment-time">
                <div className="time-item">
                  <strong>{String(slide.assessmentCard?.timeLeft?.hours || 0).padStart(2, '0')}</strong>
                  <span>HRS</span>
                </div>
                <div className="time-item">
                  <strong>{String(slide.assessmentCard?.timeLeft?.mins || 0).padStart(2, '0')}</strong>
                  <span>MINS</span>
                </div>
                <div className="time-item">
                  <strong>{String(slide.assessmentCard?.timeLeft?.secs || 0).padStart(2, '0')}</strong>
                  <span>SECS</span>
                </div>
              </div>

              <button className="btn btn-primary carousel-assessment-btn">Start Test</button>
            </div>
          </div>
        </div>

        {/* Slide Dots */}
        <div className="carousel-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`dot ${idx === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroCarousel;
