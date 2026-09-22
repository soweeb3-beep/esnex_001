import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../api/axios";

const heroBadges = [
  { title: "WAEC Standard CBT Platform", icon: "🛡️" },
  { title: "Quality Learning Resources", icon: "📘" },
  { title: "Track. Improve. Succeed.", icon: "📈" },
];

const missionVision = [
  {
    title: "Our Mission",
    text: "To make quality education accessible and effective for every student through technology-driven learning and assessment solutions.",
    icon: "🎯",
  },
  {
    title: "Our Vision",
    text: "To become Africa’s leading digital education platform, setting the standard for online learning and examination preparation.",
    icon: "👁️",
  },
];

const features = [
  { title: "CBT Assessments", detail: "WAEC/WASSCE style assessments with real exam simulation.", icon: "📝" },
  { title: "Online Courses", detail: "Well-structured video lessons and resources for each subject.", icon: "🎓" },
  { title: "Mock Exams", detail: "Full-length mock exams that prepare you for the real thing.", icon: "⏱️" },
  { title: "Sectional Quizzes", detail: "Topic-based quizzes inside each course section.", icon: "📚" },
  { title: "Performance Analytics", detail: "Detailed reports and analytics to track your performance.", icon: "📊" },
  { title: "Certificates", detail: "Earn digital certificates for completed courses and achievements.", icon: "🏅" },
  { title: "Student Dashboard", detail: "Personalized dashboard to manage learning and assessments.", icon: "💠" },
  { title: "Instructor Support", detail: "Get support and guidance from subject specialists.", icon: "📞" },
];

const stats = [
  { value: "2,350+", label: "Students" },
  { value: "125+", label: "Courses" },
  { value: "5,800+", label: "Assessments" },
  { value: "1,200+", label: "Certificates Issued" },
];

const DEFAULT_ABOUT = {
  badge: "ABOUT ESNEX",
  title: "Empowering Students. Transforming Education.",
  subtitle: "ESNEX Technologies is a modern online learning and assessment platform built to help students prepare for WAEC/WASSCE and other examinations.",
  primaryCtaText: "Explore Courses",
  primaryCtaLink: "/courses",
  secondaryCtaText: "Start Assessment",
  secondaryCtaLink: "/assessments",
};

export default function About() {
  const [aboutData, setAboutData] = useState(null);

  useEffect(() => {
    const loadHomepage = async () => {
      try {
        const res = await API.get("/homepage");
        setAboutData(res.data.homepage?.about || null);
      } catch (err) {
        console.error("Failed to load about content", err);
      }
    };

    loadHomepage();
  }, []);

  const content = aboutData || DEFAULT_ABOUT;
  const badges = content.badges || heroBadges;
  const missionSections = content.missionVision || missionVision;
  const featureItems = content.features || features;
  const statItems = content.stats || stats;

  return (
    <main className="about-page">
      <section className="page-hero">
        <div className="container page-hero-grid">
          <div className="hero-copy">
            <span className="section-label">{content.badge}</span>
            <h1>
              {content.title}
            </h1>
            <p>{content.subtitle}</p>
            <div className="hero-badges">
              {badges.map((badge) => (
                <div key={badge.title} className="hero-badge-card">
                  <span>{badge.icon}</span>
                  <p>{badge.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-profile-card">
            <div className="profile-ring">
              <img
                src="https://res.cloudinary.com/dl2uffxyl/image/upload/v1778113664/eboy_bkjhmd.png"
                alt="Ebrima Sowe"
              />
            </div>
            <div className="profile-copy">
              <span>Founder & CEO — ESNEX Technologies</span>
              <h2>Ebrima Sowe</h2>
              <p>
                Ebrima Sowe is the founder of ESNEX Technologies, passionate about building innovative digital
                learning solutions that empower students across Africa to achieve academic excellence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-split">
        <div className="section-intro">
          <p>Our Mission & Vision</p>
          <h2>Delivering accessible, high-impact education for every learner.</h2>
        </div>
        <div className="mission-vision-grid">
          {missionSections.map((item) => (
            <article key={item.title} className="info-card">
              <div className="info-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-intro">
          <p>What ESNEX Offers</p>
          <h2>Smart learning tools for exam success.</h2>
        </div>
        <div className="feature-grid">
          {featureItems.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block stats-section">
        <div className="section-intro">
          <p>Our Impact In Numbers</p>
          <h2>Trusted by learners, teachers and schools.</h2>
        </div>
        <div className="stats-grid">
          {statItems.map((stat) => (
            <article key={stat.label} className="stat-card">
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block cta-panel">
        <div>
          <p className="cta-label">Start Your Learning Journey Today</p>
          <h2>Join thousands of students preparing and excelling with ESNEX.</h2>
        </div>
        <div className="cta-actions">
          <Link to={content.primaryCtaLink || "/courses"} className="btn btn-primary large">
            {content.primaryCtaText || "Explore Courses"}
          </Link>
          <Link to={content.secondaryCtaLink || "/assessments"} className="btn btn-secondary large">
            {content.secondaryCtaText || "Start Assessment"}
          </Link>
        </div>
      </section>
    </main>
  );
}
