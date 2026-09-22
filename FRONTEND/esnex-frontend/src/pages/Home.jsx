import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../api/axios";
import HeroCarousel from "../components/HeroCarousel";
import "../styles/hero-carousel.css";
import courseImageScience from "../assets/images/science.png";
import courseImageMaths from "../assets/images/maths.png";
import courseImageEnglish from "../assets/images/english.png";
import courseImageAgric from "../assets/images/agric.png";
  const currentYear = new Date().getFullYear();
const DEFAULT_HOMEPAGE = {
  hero: {
    badge: "Professional exam preparation",
    title: "Study smarter. Pass stronger.",
    subtitle: "ESNEX helps students and institutions build confidence with secure practice tests, real exam-style questions, and smart analytics for WAEC and school assessments.",
    primaryCtaText: "Start Free",
    primaryCtaLink: "/register",
    secondaryCtaText: "Browse Courses",
    secondaryCtaLink: "/courses",
    imageUrl: "",
  },
  heroSlides: [
    {
      tagline: "Professional exam preparation",
      title: "Study smarter. Pass stronger.",
      titleHighlight: "",
      titleEnd: "",
      description: "ESNEX helps students and institutions build confidence with secure practice tests, real exam-style questions, and smart analytics for WAEC and school assessments.",
      buttonText: "Start Free",
      imageUrl: "",
      durationSeconds: 7,
    },
  ],
  stats: [
    { label: "Learners", value: "10K+" },
    { label: "Courses", value: "350+" },
    { label: "Assessments", value: "50K+" },
    { label: "Success Rate", value: "95%" },
  ],
  popularCourses: [
    { label: "Bestseller", title: "Mastering WAEC Science", teacher: "Mr. Bah", price: "D2,000", rating: "4.8", learners: "1.2k", lessons: "12", duration: "8h 45m", imageUrl: courseImageScience },
    { label: "Popular", title: "Mathematics Complete Guide", teacher: "Mr. Singhteh", price: "D2,000", rating: "4.7", learners: "1.8k", lessons: "18", duration: "12h 30m", imageUrl: courseImageMaths },
    { label: "New", title: "English Mock Exams", teacher: "Mrs. Jallow", price: "D2,000", rating: "4.8", learners: "1.1k", lessons: "10", duration: "5h 15m", imageUrl: courseImageEnglish },
    { label: "Popular", title: "Fundamentals WAEC Prep", teacher: "Mr. Drammeh", price: "D2,000", rating: "4.6", learners: "1.5k", lessons: "14", duration: "7h 20m", imageUrl: courseImageAgric },
  ],
  testimonials: [
    { quote: "ESNEX helped me improve my WAEC scores with confidence. The practice tests are exactly like the real exam!", name: "Fatou S.", role: "WAEC Student", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80" },
    { quote: "The platform is intuitive, the content is top-notch, and the certificates helped my students.", name: "Musa Sillah", role: "Teacher", photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80" },
    { quote: "A reliable platform for exam readiness and assessments.", name: "Hassan N.", role: "School Owner", photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80" },
  ],
  footer: {
    contactInfo: "Support Center",
    email: "esnextechnologies@gmail.com",
    phone: "+220 3165040",
    address: "Latrikunda, The Gambia",
    text: `© ${currentYear} ESNEX Technologies. All rights reserved.`,
  },
};

const categoryCards = [
  { title: "WAEC Prep", subtitle: "Prepare for WAEC exams.", link: "/courses?category=waec" },
  { title: "Science", subtitle: "Biology, Chemistry & Physics.", link: "/courses?category=science" },
  { title: "Mathematics", subtitle: "Build strong math skills.", link: "/courses?category=maths" },
  { title: "English", subtitle: "Grammar, literature & oral.", link: "/courses?category=english" },
  { title: "Mock Exams", subtitle: "Real exam-style practice.", link: "/assessments" },
  { title: "Oral Theory", subtitle: "Speaking and long-answer prep.", link: "/courses?category=oral-theory" },
  { title: "Certificates", subtitle: "Earn verified achievement badges.", link: "/courses?category=certificates" },
  { title: "Grade 7-9", subtitle: "Junior secondary essentials.", link: "/courses?category=grade-7-9" },
];

const latestAssessments = [
  { title: "WAEC Mock Exam", subject: "WAEC", questions: "80 Questions", duration: "120 mins", difficulty: "Hard", link: "/assessments" },
  { title: "Biology Practice Test", subject: "Biology", questions: "40 Questions", duration: "60 mins", difficulty: "Medium", link: "/assessments" },
  { title: "Mathematics Timed Quiz", subject: "Mathematics", questions: "30 Questions", duration: "45 mins", difficulty: "Medium", link: "/assessments" },
  { title: "English Oral Practice", subject: "English", questions: "20 Prompts", duration: "30 mins", difficulty: "Easy", link: "/assessments" },
];

const educatorProfiles = [
  { name: "Mr. Bah", subject: "Science Teacher", experience: "10+ years", rating: "4.8", reviews: "1.2k", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80" },
  { name: "Mrs. Jallow", subject: "English Specialist", experience: "8+ years", rating: "4.7", reviews: "980", photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80" },
  { name: "Mr. Singhteh", subject: "Maths Expert", experience: "12+ years", rating: "4.9", reviews: "1.5k", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80" },
  { name: "Mr. Drammeh", subject: "ICT Instructor", experience: "7+ years", rating: "4.6", reviews: "760", photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80" },
];

const featureItems = [
  { title: "Exam-Focused", description: "Practice with questions modeled after real exams." },
  { title: "Smart Analytics", description: "Track progress, identify gaps, and revise with confidence." },
  { title: "Secure Assessments", description: "Build skills with reliable, fair testing." },
  { title: "Certificates", description: "Earn recognitions that showcase achievement." },
  { title: "Learn Anywhere", description: "Access lessons and tests from any device." },
  { title: "Trusted Support", description: "Get help from educators and exam coaches." },
];

const dashboardStats = [
  { icon: "📚", label: "Courses Enrolled", value: "12" },
  { icon: "📝", label: "Assessments Taken", value: "8" },
  { icon: "✅", label: "Courses Completed", value: "5" },
  { icon: "🏆", label: "Certificates Earned", value: "3" },
];

const continueLearning = {
  title: "Mathematics",
  subtitle: "WAEC Preparation",
  progress: 65,
  buttonText: "Continue",
};

const upcomingAssessment = {
  title: "WAEC Mock Test",
  details: "20 Questions • 30 mins",
  date: "Tomorrow, 10:00 AM",
  buttonText: "Start",
};

const courseCards = [
  { label: "Bestseller", title: "Mastering WAEC Science", teacher: "Mr. Bah", price: "D2,000", rating: "4.8", learners: "1.2k", lessons: "12", duration: "8h 45m", imageUrl: courseImageScience },
  { label: "Popular", title: "Mathematics Complete Guide", teacher: "Mr. Singhteh", price: "D2,000", rating: "4.7", learners: "1.8k", lessons: "18", duration: "12h 30m", imageUrl: courseImageMaths },
  { label: "New", title: "English Mock Exams", teacher: "Mrs. Jallow", price: "D2,000", rating: "4.8", learners: "1.1k", lessons: "10", duration: "5h 15m", imageUrl: courseImageEnglish },
  { label: "Popular", title: "Fundamentals WAEC Prep", teacher: "Mr. Drammeh", price: "D2,000", rating: "4.6", learners: "1.5k", lessons: "14", duration: "7h 20m", imageUrl: courseImageAgric },
];

export default function Home() {
  const [countdown, setCountdown] = useState({ days: "02", hours: "04", minutes: "12", seconds: "45" });
  const [homepage, setHomepage] = useState(DEFAULT_HOMEPAGE);
  const [loadingHomepage, setLoadingHomepage] = useState(true);

  const normalizeHomepage = (payload) => ({
    ...DEFAULT_HOMEPAGE,
    ...payload,
    hero: {
      ...DEFAULT_HOMEPAGE.hero,
      ...(payload?.hero || {}),
    },
    heroSlides: Array.isArray(payload?.heroSlides) && payload.heroSlides.length
      ? payload.heroSlides
      : DEFAULT_HOMEPAGE.heroSlides,
    stats: Array.isArray(payload?.stats) && payload.stats.length ? payload.stats : DEFAULT_HOMEPAGE.stats,
    popularCourses: Array.isArray(payload?.popularCourses) && payload.popularCourses.length ? payload.popularCourses : DEFAULT_HOMEPAGE.popularCourses,
    testimonials: Array.isArray(payload?.testimonials) && payload.testimonials.length ? payload.testimonials : DEFAULT_HOMEPAGE.testimonials,
    footer: {
      ...DEFAULT_HOMEPAGE.footer,
      ...(payload?.footer || {}),
    },
  });

  useEffect(() => {
    const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: "00", hours: "00", minutes: "00", seconds: "00" });
        return;
      }
      const days = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, "0");
      const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, "0");
      const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
      const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
      setCountdown({ days, hours, minutes, seconds });
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadHomepage = async () => {
      setLoadingHomepage(true);
      try {
        const res = await API.get("/homepage");
        setHomepage(normalizeHomepage(res.data.homepage || {}));
      } catch (err) {
        console.error("Homepage load error", err);
        setHomepage(DEFAULT_HOMEPAGE);
      } finally {
        setLoadingHomepage(false);
      }
    };

    loadHomepage();
  }, []);

  const hero = homepage.hero || DEFAULT_HOMEPAGE.hero;
  const heroSlides = (Array.isArray(homepage.heroSlides) && homepage.heroSlides.length ? homepage.heroSlides : DEFAULT_HOMEPAGE.heroSlides).map((slide) => ({
    tagline: slide.tagline || hero.badge || "Professional exam preparation",
    title: slide.title || hero.title || "Study smarter. Pass stronger.",
    titleHighlight: slide.titleHighlight || "",
    titleEnd: slide.titleEnd || "",
    description: slide.description || slide.subtitle || hero.subtitle || hero.description || "ESNEX helps students and institutions build confidence with secure practice tests, real exam-style questions, and smart analytics for WAEC and school assessments.",
    buttonText: slide.buttonText || hero.primaryCtaText || "Start Free",
    image: slide.imageUrl || slide.image || hero.imageUrl || hero.backgroundUrl || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80",
    durationSeconds: Number(slide.durationSeconds) || 7,
    stats: slide.stats,
    assessmentCard: slide.assessmentCard,
  }));
  const stats = homepage.stats || DEFAULT_HOMEPAGE.stats;
  const popularCourseCards = (homepage.popularCourses || DEFAULT_HOMEPAGE.popularCourses).map((course, index) => ({
    label: course.label || "Popular",
    title: course.title || "Course title",
    teacher: course.teacher || course.instructor || "ESNEX Instructor",
    price: course.price || "D2,000",
    rating: course.rating || "4.8",
    learners: course.learners || "1.2k",
    lessons: course.lessons || "12",
    duration: course.duration || "8h 45m",
    imageUrl: course.imageUrl || course.backgroundUrl || course.heroImage || "",
    link: course.link || "/courses",
    key: `course-${index}`,
  }));
  const homepageTestimonials = homepage.testimonials || DEFAULT_HOMEPAGE.testimonials;
  const footerContent = homepage.footer || DEFAULT_HOMEPAGE.footer;

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-left">
            <div className="hero-card-placeholder">
              <HeroCarousel compact minimal slides={heroSlides} />
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-copy">
              <p className="hero-topline">WELCOME TO ESNEX LEARNING PLATFORM</p>
              <h1 className="hero-heading">{hero.title}</h1>
              <p className="hero-subtitle">{hero.subtitle}</p>

              <div className="hero-ctas">
                <Link className="btn btn-primary" to={hero.primaryCtaLink || '/register'}>{hero.primaryCtaText || 'Start Free Today'}</Link>
                <Link className="btn btn-outline" to={hero.secondaryCtaLink || '/courses'}>{hero.secondaryCtaText || 'Browse Courses'}</Link>
              </div>

              <div className="hero-features">
                <div className="feature-item">Expert Instructors</div>
                <div className="feature-item">Industry Certification</div>
                <div className="feature-item">Career Growth</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block category-block">
        <div className="container section-intro">
          <p>Browse by category</p>
          <h2>Find the right path for your exam journey.</h2>
        </div>
        <div className="container category-grid">
          {categoryCards.map((category) => (
            <Link key={category.title} className="category-card" to={category.link}>
              <div className="category-icon">{category.title.charAt(0)}</div>
              <h3>{category.title}</h3>
              <p>{category.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block popular-courses-block">
        <div className="container section-intro">
          <p>Popular courses</p>
          <h2>Discover high-demand, exam-ready courses.</h2>
        </div>
        <div className="container popular-courses-grid">
          {popularCourseCards.map((course) => (
            <article key={course.key} className="popular-course-card course-card">
              <div className="course-image" style={{ backgroundImage: `url(${course.imageUrl})` }} />
              <div className="course-card-meta">
                <span className={`course-badge course-badge-${course.label.toLowerCase().replace(/\s+/g, "-")}`}>{course.label}</span>
                <strong className="course-price">{course.price}</strong>
              </div>
              <h3>{course.title}</h3>
              <p className="course-teacher">{course.teacher}</p>
              <div className="course-meta">
                <span>{course.rating} ?</span>
                <span>{course.duration}</span>
              </div>
              <div className="course-card-footer">
                <span>{course.lessons} lessons</span>
                <span>{course.learners} learners</span>
              </div>
              <div className="course-card-actions">
                <Link className="btn btn-secondary" to={course.link}>View Course</Link>
                <Link className="btn btn-primary" to={course.link}>Enroll Now</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block latest-assessments-block">
        <div className="container section-intro">
          <p>Latest assessments</p>
          <h2>Practice with the latest exam-style tests.</h2>
        </div>
        <div className="container assessments-grid">
          {latestAssessments.map((item) => (
            <article key={item.title} className="assessment-card">
              <div className="assessment-card-top">
                <span className="assessment-chip">{item.subject}</span>
                <span className="assessment-difficulty">{item.difficulty}</span>
              </div>
              <h3>{item.title}</h3>
              <div className="assessment-meta">
                <span>{item.questions}</span>
                <span>{item.duration}</span>
              </div>
              <Link className="btn btn-primary small" to={item.link}>Start Test</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block features-block">
        <div className="container section-intro">
          <p>Why choose ESNEX?</p>
          <h2>Secure exam prep built for learners and schools.</h2>
        </div>
        <div className="container feature-grid">
          {featureItems.map((item) => (
            <article key={item.title} className="feature-card">
              <div className="feature-icon">?</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block educators-block">
        <div className="container section-intro">
          <p>Meet our educators</p>
          <h2>Trusted experts guiding every exam-ready learner.</h2>
        </div>
        <div className="container educator-grid">
          {educatorProfiles.map((educator) => (
            <article key={educator.name} className="educator-card">
              <div className="educator-avatar" style={{ backgroundImage: `url(${educator.photoUrl})` }} />
              <div className="educator-content">
                <h3>{educator.name}</h3>
                <span>{educator.subject}</span>
                <p>{educator.experience} experience</p>
                <div className="educator-rating">
                  <span>{educator.rating}</span>
                  <span>({educator.reviews})</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block testimonials-block" id="reviews">
        <div className="container section-intro">
          <p>What learners say</p>
          <h2>Trusted by students, teachers and school owners.</h2>
        </div>
        <div className="container testimonials-grid">
          {homepageTestimonials.map((item) => (
            <article key={`${item.name}-${item.quote}`} className="testimonial-card">
              <div className="testimonial-avatar">
                <img src={item.photoUrl || "https://via.placeholder.com/80"} alt={item.name} />
              </div>
              <p>“{item.quote}”</p>
              <div className="testimonial-meta">
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <div className="container cta-grid">
          <div>
            <p>Ready to excel?</p>
            <h2>Join thousands of learners and take the first step towards your goals.</h2>
          </div>
          <div>
            <Link className="btn btn-primary" to="/register">Start Free Today</Link>
          </div>
        </div>
      </section>

      <footer className="site-footer" id="contact">
        <div className="container footer-grid">
          <div>
            <h2>ESNEX</h2>
            <p>{footerContent.contactInfo || "Empowering learners and organizations with the tools they need to succeed."}</p>
            <p style={{ marginTop: "0.75rem", fontSize: "0.95rem" }}>{footerContent.email} · {footerContent.phone}</p>
            <p style={{ marginTop: "0.25rem", fontSize: "0.95rem" }}>{footerContent.address}</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>Quick Links</strong>
              <nav>
                <Link to="/">Home</Link>
                <Link to="/courses">Courses</Link>
                <Link to="/assessments">Assessments</Link>
                <Link to="/certificates">Certificates</Link>
              </nav>
            </div>
            <div>
              <strong>Support</strong>
              <nav>
                <a href="#">Help Center</a>
                <a href="#">FAQ</a>
                <a href="#contact">Contact</a>
              </nav>
            </div>
            <div>
              <strong>Legal</strong>
              <nav>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms</a>
              </nav>
            </div>
          </div>
        </div>
        <div className="footer-copy">
          <span>{footerContent.text || "© 2026 ESNEX Technologies. All rights reserved."}</span>
          <div>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>

      <nav className="mobile-bottom-nav">
        <Link to="/">
          <span>🏠</span>
          <small>Home</small>
        </Link>
        <Link to="/courses">
          <span>📚</span>
          <small>Courses</small>
        </Link>
        <Link to="/assessments">
          <span>📝</span>
          <small>Assess</small>
        </Link>
        <Link to="/about">
          <span>ℹ️</span>
          <small>About</small>
        </Link>
        <Link to="/contact">
          <span>✉️</span>
          <small>Contact</small>
        </Link>
        <Link to="/certificates">
          <span>🏆</span>
          <small>Certs</small>
        </Link>
        <Link to="/login">
          <span>👤</span>
          <small>Account</small>
        </Link>
      </nav>
    </main>
  );
}
