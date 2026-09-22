import { useEffect, useState } from "react";
import API from "../../api/axios";
import HeroCarousel from "../../components/HeroCarousel";
import "../../styles/hero-carousel.css";
import { useWindowSize, inputStyle, buttonStyle, sectionCardStyle, sectionHeadingStyle } from "./adminUtils";

const heroSampleImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80";

const DEFAULT_HERO_SLIDE = {
  tagline: "Professional exam preparation",
  title: "Learn. Assess. Succeed.",
  titleHighlight: "",
  titleEnd: "",
  description: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology.",
  buttonText: "Get Started Free",
  imageUrl: heroSampleImage,
  videoUrl: "",
  durationSeconds: 7,
};

const DEFAULT_HOMEPAGE = {
  hero: {
    visible: true,
    badge: "Professional exam preparation",
    title: "Learn. Assess. Succeed.",
    subtitle: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology.",
    description: "Build confidence, practice exams, and track progress across courses and assessments.",
    primaryCtaText: "Get Started Free",
    primaryCtaLink: "/register",
    secondaryCtaText: "Explore Courses",
    secondaryCtaLink: "/courses",
    imageUrl: heroSampleImage,
    backgroundType: "image",
    backgroundUrl: heroSampleImage,
    videoUrl: "",
  },
  heroSlides: [
    {
      tagline: "Professional exam preparation",
      title: "Learn. Assess. Succeed.",
      titleHighlight: "",
      titleEnd: "",
      description: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology.",
      buttonText: "Get Started Free",
      imageUrl: heroSampleImage,
      videoUrl: "",
      durationSeconds: 7,
    },
  ],
  statsVisible: true,
  stats: [
    { label: "Total courses", value: "24", icon: "📚" },
    { label: "Total students", value: "3.2K", icon: "👥" },
    { label: "Rating", value: "4.8/5", icon: "⭐" },
    { label: "Completion", value: "92%", icon: "✅" },
  ],
  popularCoursesVisible: true,
  popularCourses: [
    { label: "Bestseller", title: "Mastering WASSCE", description: "Comprehensive training for exam success.", rating: "4.8", learners: "2.1k", level: "Beginner", duration: "8h 45m", price: "Free", discount: "20%", featured: true, imageUrl: "" },
    { label: "Popular", title: "The Complete Guide", description: "Step-by-step course to master your subject.", rating: "4.7", learners: "1.8k", level: "Intermediate", duration: "12h 30m", price: "$29", discount: "15%", featured: false, imageUrl: "" },
  ],
  testimonialsVisible: true,
  testimonials: [
    { quote: "ESNEX has completely transformed the way I learn.", name: "Priya S.", role: "Data Analyst", photoUrl: "", approved: true, visible: true },
    { quote: "The platform is intuitive and the content is top-notch.", name: "Rahul K.", role: "Software Developer", photoUrl: "", approved: true, visible: true },
  ],
  faqVisible: true,
  faq: [
    { question: "How do I enroll in a course?", answer: "Click signup, choose a course, and complete your registration.", visible: true },
    { question: "Can I reset my progress?", answer: "Progress resets require admin action through your account settings.", visible: true },
  ],
  about: {
    badge: "ABOUT ESNEX",
    title: "Empowering Students. Transforming Education.",
    subtitle: "ESNEX Technologies is a modern online learning and assessment platform built to help students prepare for WAEC/WASSCE and other examinations.",
    primaryCtaText: "Explore Courses",
    primaryCtaLink: "/courses",
    secondaryCtaText: "Start Assessment",
    secondaryCtaLink: "/assessments",
    badges: [
      { title: "WAEC Standard CBT Platform", icon: "🛡️" },
      { title: "Quality Learning Resources", icon: "📘" },
      { title: "Track. Improve. Succeed.", icon: "📈" },
    ],
    missionVision: [
      { title: "Our Mission", text: "To make quality education accessible and effective for every student through technology-driven learning and assessment solutions.", icon: "🎯" },
      { title: "Our Vision", text: "To become Africa’s leading digital education platform, setting the standard for online learning and examination preparation.", icon: "👁️" },
    ],
    features: [
      { title: "CBT Assessments", detail: "WAEC/WASSCE style assessments with real exam simulation.", icon: "📝" },
      { title: "Online Courses", detail: "Well-structured video lessons and resources for each subject.", icon: "🎓" },
      { title: "Mock Exams", detail: "Full-length mock exams that prepare you for the real thing.", icon: "⏱️" },
      { title: "Sectional Quizzes", detail: "Topic-based quizzes inside each course section.", icon: "📚" },
      { title: "Performance Analytics", detail: "Detailed reports and analytics to track your performance.", icon: "📊" },
      { title: "Certificates", detail: "Earn digital certificates for completed courses and achievements.", icon: "🏅" },
    ],
    stats: [
      { value: "2,350+", label: "Students" },
      { value: "125+", label: "Courses" },
      { value: "5,800+", label: "Assessments" },
      { value: "1,200+", label: "Certificates Issued" },
    ],
  },
  contact: {
    heroTitle: "We Would Love To Hear From You",
    heroSubtitle: "Have questions or need help? Reach out to us anytime, and our team will respond with fast, friendly support.",
    email: "support@esnex.com",
    phone: "+220 123 4567",
    whatsapp: "+220 123 4567",
    location: "Brikama, West Coast Region\nThe Gambia",
    supportHours: "Monday – Saturday\n8:00 AM – 8:00 PM",
    mapQuery: "Brikama, The Gambia",
    cards: [
      { title: "Email Us", detail: "support@esnex.com\ninfo@esnex.com", icon: "✉️", action: "mailto:support@esnex.com" },
      { title: "Call Us", detail: "+220 123 4567\n+220 987 6543", icon: "📞", action: "tel:+2201234567" },
      { title: "WhatsApp", detail: "+220 123 4567", icon: "💬", action: "https://wa.me/2201234567" },
      { title: "Our Location", detail: "Brikama, West Coast Region\nThe Gambia", icon: "📍" },
      { title: "Support Hours", detail: "Monday – Saturday\n8:00 AM – 8:00 PM", icon: "⏰" },
    ],
    faqs: [
      { question: "How do I enroll in a course?", answer: "Choose the course you want, click enroll, and complete the registration process. You can start learning immediately after enrollment.", visible: true },
      { question: "How do assessments work?", answer: "Each assessment is designed to simulate exam conditions. Review your score and analytics after each attempt to improve faster.", visible: true },
      { question: "Are the questions WAEC/WASSCE standard?", answer: "Yes. Our content is built to match WAEC/WASSCE standards, with realistic question formats and grading models.", visible: true },
      { question: "How do payments work?", answer: "You can pay securely via the payment gateway after selecting a course or assessment. Receipts are issued immediately after payment.", visible: true },
      { question: "Can I access quizzes on mobile?", answer: "Absolutely. Our platform is responsive and works across desktop, tablet, and mobile devices.", visible: true },
      { question: "How do I get help if I have an issue?", answer: "Reach out using email, phone, WhatsApp, or the contact form. Our support team is available during support hours.", visible: true },
    ],
    social: {
      facebook: "",
      twitter: "",
      tiktok: "",
      instagram: "",
      youtube: "",
      linkedin: "",
    },
  },
  footer: {
    contactInfo: "Support Center",
    email: "support@esnex.com",
    phone: "+232 76 123 456",
    address: "Freetown, Sierra Leone",
    social: {
      facebook: "",
      twitter: "",
      tiktok: "",
      instagram: "",
      youtube: "",
      linkedin: "",
    },
    text: "© 2026 ESNEX. All rights reserved.",
    logoUrl: "",
  },
};

export default function AdminHomepage() {
  const { width: windowWidth } = useWindowSize();
  const [homepageForm, setHomepageForm] = useState(DEFAULT_HOMEPAGE);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [heroSlideImageFiles, setHeroSlideImageFiles] = useState({});
  const [courseImageFiles, setCourseImageFiles] = useState({});
  const [testimonialPhotoFiles, setTestimonialPhotoFiles] = useState({});
  const [selectedPreviewSlideIndex, setSelectedPreviewSlideIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const isMobile = windowWidth < 768;

  const updateHeroField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      hero: {
        ...current.hero,
        [field]: value,
      },
    }));
  };

  const updateStatsField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      stats: current.stats.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
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

  const updateFaqField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      faq: current.faq.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  const updateFooterField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        [field]: value,
      },
    }));
  };

  const updateFooterSocialField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        social: {
          ...current.footer.social,
          [field]: value,
        },
      },
    }));
  };

  const updateAboutField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      about: {
        ...current.about,
        [field]: value,
      },
    }));
  };

  const updateAboutArrayField = (section, index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      about: {
        ...current.about,
        [section]: current.about[section].map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
      },
    }));
  };

  const addAboutArrayItem = (section, item) => {
    setHomepageForm((current) => ({
      ...current,
      about: {
        ...current.about,
        [section]: [...(current.about[section] || []), item],
      },
    }));
  };

  const removeAboutArrayItem = (section, index) => {
    setHomepageForm((current) => ({
      ...current,
      about: {
        ...current.about,
        [section]: current.about[section].filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateContactField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [field]: value,
      },
    }));
  };

  const updateContactCardField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        cards: current.contact.cards.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
      },
    }));
  };

  const updateContactFaqField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        faqs: current.contact.faqs.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
      },
    }));
  };

  const updateContactSocialField = (field, value) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        social: {
          ...current.contact.social,
          [field]: value,
        },
      },
    }));
  };

  const addContactCard = () => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        cards: [...(current.contact.cards || []), { title: "New card", detail: "", icon: "📌", action: "" }],
      },
    }));
  };

  const removeContactCard = (index) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        cards: current.contact.cards.filter((_, idx) => idx !== index),
      },
    }));
  };

  const addContactFaq = () => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        faqs: [...(current.contact.faqs || []), { question: "", answer: "", visible: true }],
      },
    }));
  };

  const removeContactFaq = (index) => {
    setHomepageForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        faqs: current.contact.faqs.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateHeroSlideField = (index, field, value) => {
    setHomepageForm((current) => ({
      ...current,
      heroSlides: current.heroSlides.map((slide, idx) =>
        idx === index ? { ...slide, [field]: value } : slide
      ),
    }));
  };

  const addHeroSlide = () => {
    const nextSlides = [...(homepageForm.heroSlides || []), { ...DEFAULT_HERO_SLIDE }];
    setHomepageForm((current) => ({
      ...current,
      heroSlides: nextSlides,
    }));
    setSelectedPreviewSlideIndex(nextSlides.length - 1);
  };

  const removeHeroSlide = (index) => {
    setHomepageForm((current) => {
      const nextSlides = (current.heroSlides || []).filter((_, idx) => idx !== index);
      const safeSlides = nextSlides.length ? nextSlides : [{ ...DEFAULT_HERO_SLIDE }];
      setSelectedPreviewSlideIndex(Math.max(0, Math.min(index, safeSlides.length - 1)));
      return {
        ...current,
        heroSlides: safeSlides,
      };
    });
  };

  const selectPreviewSlide = (index) => {
    setSelectedPreviewSlideIndex(Math.max(0, Math.min(index, (homepageForm.heroSlides?.length || 1) - 1)));
  };

  const handleHeroSlideImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setHeroSlideImageFiles((current) => ({ ...current, [index]: file }));
    updateHeroSlideField(index, "imageUrl", previewUrl);
  };

  const handleHeroImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setHeroImageFile(file);
  };

  const handleCourseImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCourseImageFiles((current) => ({ ...current, [index]: file }));
  };

  const handleTestimonialPhotoChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTestimonialPhotoFiles((current) => ({ ...current, [index]: file }));
  };

  const addStat = () => {
    setHomepageForm((current) => ({
      ...current,
      stats: [...current.stats, { label: "New stat", value: "0", icon: "📈" }],
    }));
  };

  const removeStat = (index) => {
    setHomepageForm((current) => ({
      ...current,
      stats: current.stats.filter((_, idx) => idx !== index),
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
          description: "",
          rating: "0",
          learners: "",
          level: "Beginner",
          duration: "",
          price: "",
          discount: "0%",
          featured: false,
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
      testimonials: [...current.testimonials, { quote: "", name: "", role: "", photoUrl: "", approved: false, visible: true }],
    }));
  };

  const removeTestimonial = (index) => {
    setHomepageForm((current) => ({
      ...current,
      testimonials: current.testimonials.filter((_, idx) => idx !== index),
    }));
  };

  const addFaq = () => {
    setHomepageForm((current) => ({
      ...current,
      faq: [...current.faq, { question: "", answer: "", visible: true }],
    }));
  };

  const removeFaq = (index) => {
    setHomepageForm((current) => ({
      ...current,
      faq: current.faq.filter((_, idx) => idx !== index),
    }));
  };

  const moveFaq = (index, direction) => {
    setHomepageForm((current) => {
      const next = [...current.faq];
      const [item] = next.splice(index, 1);
      next.splice(index + direction, 0, item);
      return { ...current, faq: next };
    });
  };

  const normalizeHomepagePayload = (payload) => {
    const merged = {
      ...DEFAULT_HOMEPAGE,
      ...payload,
      hero: {
        ...DEFAULT_HOMEPAGE.hero,
        ...(payload?.hero || {}),
      },
      stats: Array.isArray(payload?.stats) && payload.stats.length ? payload.stats : DEFAULT_HOMEPAGE.stats,
      heroSlides: Array.isArray(payload?.heroSlides) && payload.heroSlides.length ? payload.heroSlides : [DEFAULT_HERO_SLIDE],
      popularCourses: Array.isArray(payload?.popularCourses) && payload.popularCourses.length ? payload.popularCourses : DEFAULT_HOMEPAGE.popularCourses,
      testimonials: Array.isArray(payload?.testimonials) && payload.testimonials.length ? payload.testimonials : DEFAULT_HOMEPAGE.testimonials,
      faq: Array.isArray(payload?.faq) && payload.faq.length ? payload.faq : DEFAULT_HOMEPAGE.faq,
      about: {
        ...DEFAULT_HOMEPAGE.about,
        ...(payload?.about || {}),
      },
      contact: {
        ...DEFAULT_HOMEPAGE.contact,
        ...(payload?.contact || {}),
      },
      footer: {
        ...DEFAULT_HOMEPAGE.footer,
        ...(payload?.footer || {}),
      },
    };

    return merged;
  };

  const loadHomepage = async () => {
    setLoading(true);
    try {
      const res = await API.get("/homepage");
      const homepagePayload = res.data.homepage || DEFAULT_HOMEPAGE;
      setHomepageForm(normalizeHomepagePayload(homepagePayload));
    } catch (err) {
      console.error(err);
      setHomepageForm(DEFAULT_HOMEPAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomepage();
  }, []);

  const previewSlides = (Array.isArray(homepageForm.heroSlides) && homepageForm.heroSlides.length ? homepageForm.heroSlides : [
    {
      tagline: homepageForm.hero.badge || "Professional preview",
      title: homepageForm.hero.title || "Live preview title",
      titleHighlight: "",
      titleEnd: "",
      description: homepageForm.hero.subtitle || homepageForm.hero.description || "Edit text and image fields to update this preview instantly.",
      buttonText: homepageForm.hero.primaryCtaText || "Preview CTA",
      image: homepageForm.hero.imageUrl || homepageForm.hero.backgroundUrl || heroSampleImage,
      videoUrl: homepageForm.hero.backgroundType === "video" ? homepageForm.hero.backgroundUrl || "" : "",
      durationSeconds: 7,
    },
  ]).map((slide) => ({
    tagline: slide.tagline || "Professional preview",
    title: slide.title || "Live preview title",
    titleHighlight: slide.titleHighlight || "",
    titleEnd: slide.titleEnd || "",
    description: slide.description || "Edit text and image fields to update this preview instantly.",
    buttonText: slide.buttonText || "Preview CTA",
    image: slide.imageUrl || heroSampleImage,
    videoUrl: slide.videoUrl || "",
    durationSeconds: Number(slide.durationSeconds) || 7,
    stats: (homepageForm.stats || []).slice(0, 4).map((item) => ({
      icon: item.icon || "📌",
      value: item.value || "0",
      label: item.label || "Stat",
      change: "Updated live",
    })),
    assessmentCard: {
      title: slide.title || "Live preview card",
      dueTime: slide.description || "Preview text updates here instantly",
      questions: `${slide.buttonText || "Preview"} • ${homepageForm.hero.secondaryCtaText || "Live"}`,
      timeLeft: { hours: 12, mins: 30, secs: 45 },
    },
  }));

  const saveHomepageSettings = async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData();
      formData.append("homepage", JSON.stringify(homepageForm));
      if (heroImageFile) {
        formData.append("heroImage", heroImageFile);
      }
      (homepageForm.popularCourses || []).forEach((course, index) => {
        if (courseImageFiles[index]) {
          formData.append(`courseImage-${index}`, courseImageFiles[index]);
        }
      });
      (homepageForm.testimonials || []).forEach((testimonial, index) => {
        if (testimonialPhotoFiles[index]) {
          formData.append(`testimonialPhoto-${index}`, testimonialPhotoFiles[index]);
        }
      });
      const response = await API.put("/homepage", formData);
      setHomepageForm(response.data.homepage || homepageForm);
      setMessage("Homepage settings updated successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to update homepage settings.");
    }
  };

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      {/* Hero Carousel Preview */}
      <div style={{ marginBottom: "2rem", backgroundColor: "rgba(15, 23, 42, 0.55)", border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <div>
            <h2 style={{ color: "#e2e8f0", margin: "0 0 0.25rem 0", fontSize: isMobile ? "1rem" : "1.25rem" }}>Live Preview</h2>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Image-first preview with minimal supporting text for a more professional admin view.</p>
          </div>
          <span style={{ padding: "0.35rem 0.65rem", borderRadius: "999px", backgroundColor: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.22)", color: "#bae6fd", fontSize: "0.82rem" }}>Professional</span>
        </div>
        <HeroCarousel compact minimal slides={previewSlides} initialSlide={selectedPreviewSlideIndex} activeIndex={selectedPreviewSlideIndex} />
      </div>

      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "1.5rem", padding: isMobile ? "1rem" : "1.5rem" }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: isMobile ? "1rem" : "1.25rem" }}>Homepage & Page Content CMS</h2>
        <p style={{ margin: "0.5rem 0 1rem", color: "#94a3b8", fontSize: isMobile ? "0.85rem" : "0.95rem" }}>Manage homepage, About and Contact page content from one central admin interface.</p>
        {loading ? (
          <div style={{ color: "#94a3b8", padding: "1rem" }}>Loading homepage settings...</div>
        ) : (
          <form onSubmit={saveHomepageSettings} style={{ display: "grid", gap: isMobile ? "1rem" : "1.25rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
              <a href="#hero-section" style={{ ...buttonStyle, backgroundColor: "#64748b", padding: "0.75rem 1rem" }}>Hero</a>
              <a href="#about-section" style={{ ...buttonStyle, backgroundColor: "#64748b", padding: "0.75rem 1rem" }}>About</a>
              <a href="#contact-section" style={{ ...buttonStyle, backgroundColor: "#64748b", padding: "0.75rem 1rem" }}>Contact</a>
              <a href="#stats-section" style={{ ...buttonStyle, backgroundColor: "#64748b", padding: "0.75rem 1rem" }}>Stats</a>
            </div>
            <div id="hero-section" style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Hero section</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                <input
                  type="checkbox"
                  checked={homepageForm.hero.visible}
                  onChange={(e) => updateHeroField("visible", e.target.checked)}
                />
                Show hero section
              </label>
              <input placeholder="Badge text" value={homepageForm.hero.badge} onChange={(e) => updateHeroField("badge", e.target.value)} style={inputStyle} />
              <input placeholder="Headline" value={homepageForm.hero.title} onChange={(e) => updateHeroField("title", e.target.value)} style={inputStyle} />
              <textarea placeholder="Subtitle" value={homepageForm.hero.subtitle} onChange={(e) => updateHeroField("subtitle", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              <textarea placeholder="Description" value={homepageForm.hero.description} onChange={(e) => updateHeroField("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
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
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                <select value={homepageForm.hero.backgroundType} onChange={(e) => updateHeroField("backgroundType", e.target.value)} style={inputStyle}>
                  <option value="image">Background image</option>
                  <option value="video">Background video</option>
                </select>
                <input placeholder="Background URL" value={homepageForm.hero.backgroundUrl} onChange={(e) => updateHeroField("backgroundUrl", e.target.value)} style={inputStyle} />
              </div>
              {homepageForm.hero.backgroundType === "video" && (
                <input placeholder="Background video URL" value={homepageForm.hero.videoUrl || ""} onChange={(e) => updateHeroField("videoUrl", e.target.value)} style={inputStyle} />
              )}
            </div>
            <div id="hero-slides-section" style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem" }}>
              <h4 style={{ margin: 0, color: "#e2e8f0" }}>Hero slides (live preview controls)</h4>
              {(homepageForm.heroSlides || []).map((slide, index) => (
                <div key={`hero-slide-${index}`} style={{ padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#cbd5e1" }}>Slide {index + 1}</strong>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" onClick={() => selectPreviewSlide(index)} style={{ ...buttonStyle, backgroundColor: selectedPreviewSlideIndex === index ? "#059669" : "#64748b" }}>{selectedPreviewSlideIndex === index ? "Previewing" : "Preview"}</button>
                      <button type="button" onClick={() => removeHeroSlide(index)} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>Remove</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                      <input placeholder="Slide title" value={slide.title} onChange={(e) => updateHeroSlideField(index, "title", e.target.value)} style={inputStyle} />
                      <input placeholder="CTA text" value={slide.buttonText} onChange={(e) => updateHeroSlideField(index, "buttonText", e.target.value)} style={inputStyle} />
                    </div>
                    <textarea placeholder="Slide description" value={slide.description} onChange={(e) => updateHeroSlideField(index, "description", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                      <label style={{ color: "#cbd5e1" }}>
                        Image
                        <input type="file" accept="image/*" onChange={(e) => handleHeroSlideImageChange(index, e)} style={inputStyle} />
                      </label>
                      <input placeholder="Image URL" value={slide.imageUrl || slide.image} onChange={(e) => updateHeroSlideField(index, "imageUrl", e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                      <input placeholder="Video URL" value={slide.videoUrl || ""} onChange={(e) => updateHeroSlideField(index, "videoUrl", e.target.value)} style={inputStyle} />
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <label style={{ color: "#cbd5e1", margin: 0 }}>Duration (seconds)</label>
                        <input type="number" min={1} value={Number(slide.durationSeconds) || 7} onChange={(e) => updateHeroSlideField(index, "durationSeconds", Number(e.target.value))} style={{ ...inputStyle, width: "8rem" }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div>
                <button type="button" onClick={addHeroSlide} style={{ ...buttonStyle, backgroundColor: "#2563eb" }}>Add hero slide</button>
              </div>
            </div>

            <div id="about-section" style={sectionCardStyle}>
              <h3 style={sectionHeadingStyle}>About section</h3>
              <input placeholder="About badge" value={homepageForm.about.badge} onChange={(e) => updateAboutField("badge", e.target.value)} style={inputStyle} />
              <input placeholder="About title" value={homepageForm.about.title} onChange={(e) => updateAboutField("title", e.target.value)} style={inputStyle} />
              <textarea placeholder="About subtitle" value={homepageForm.about.subtitle} onChange={(e) => updateAboutField("subtitle", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                <input placeholder="Primary CTA text" value={homepageForm.about.primaryCtaText} onChange={(e) => updateAboutField("primaryCtaText", e.target.value)} style={inputStyle} />
                <input placeholder="Primary CTA link" value={homepageForm.about.primaryCtaLink} onChange={(e) => updateAboutField("primaryCtaLink", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                <input placeholder="Secondary CTA text" value={homepageForm.about.secondaryCtaText} onChange={(e) => updateAboutField("secondaryCtaText", e.target.value)} style={inputStyle} />
                <input placeholder="Secondary CTA link" value={homepageForm.about.secondaryCtaLink} onChange={(e) => updateAboutField("secondaryCtaLink", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>Badges</h4>
                {homepageForm.about.badges.map((badge, index) => (
                  <div key={`about-badge-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                      <input placeholder="Badge title" value={badge.title} onChange={(e) => updateAboutArrayField("badges", index, "title", e.target.value)} style={inputStyle} />
                      <input placeholder="Badge icon" value={badge.icon} onChange={(e) => updateAboutArrayField("badges", index, "icon", e.target.value)} style={inputStyle} />
                    </div>
                    <button type="button" onClick={() => removeAboutArrayItem("badges", index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove badge</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAboutArrayItem("badges", { title: "New badge", icon: "📌" })} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add badge</button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>Mission & Vision</h4>
                {homepageForm.about.missionVision.map((item, index) => (
                  <div key={`about-mv-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <input placeholder="Title" value={item.title} onChange={(e) => updateAboutArrayField("missionVision", index, "title", e.target.value)} style={inputStyle} />
                    <textarea placeholder="Text" value={item.text} onChange={(e) => updateAboutArrayField("missionVision", index, "text", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <input placeholder="Icon" value={item.icon} onChange={(e) => updateAboutArrayField("missionVision", index, "icon", e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => removeAboutArrayItem("missionVision", index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove item</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAboutArrayItem("missionVision", { title: "New item", text: "", icon: "✨" })} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add mission item</button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>Features</h4>
                {homepageForm.about.features.map((item, index) => (
                  <div key={`about-feature-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <input placeholder="Title" value={item.title} onChange={(e) => updateAboutArrayField("features", index, "title", e.target.value)} style={inputStyle} />
                    <textarea placeholder="Detail" value={item.detail} onChange={(e) => updateAboutArrayField("features", index, "detail", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <input placeholder="Icon" value={item.icon} onChange={(e) => updateAboutArrayField("features", index, "icon", e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => removeAboutArrayItem("features", index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove feature</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAboutArrayItem("features", { title: "New feature", detail: "", icon: "✨" })} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add feature</button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>About stats</h4>
                {homepageForm.about.stats.map((stat, index) => (
                  <div key={`about-stat-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                      <input placeholder="Value" value={stat.value} onChange={(e) => updateAboutArrayField("stats", index, "value", e.target.value)} style={inputStyle} />
                      <input placeholder="Label" value={stat.label} onChange={(e) => updateAboutArrayField("stats", index, "label", e.target.value)} style={inputStyle} />
                    </div>
                    <button type="button" onClick={() => removeAboutArrayItem("stats", index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove stat</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAboutArrayItem("stats", { value: "0", label: "New stat" })} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add about stat</button>
              </div>
            </div>

            <div id="contact-section" style={sectionCardStyle}>
              <h3 style={sectionHeadingStyle}>Contact section</h3>
              <input placeholder="Contact hero title" value={homepageForm.contact.heroTitle} onChange={(e) => updateContactField("heroTitle", e.target.value)} style={inputStyle} />
              <textarea placeholder="Contact hero subtitle" value={homepageForm.contact.heroSubtitle} onChange={(e) => updateContactField("heroSubtitle", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                <input placeholder="Email" value={homepageForm.contact.email} onChange={(e) => updateContactField("email", e.target.value)} style={inputStyle} />
                <input placeholder="Phone" value={homepageForm.contact.phone} onChange={(e) => updateContactField("phone", e.target.value)} style={inputStyle} />
                <input placeholder="WhatsApp" value={homepageForm.contact.whatsapp} onChange={(e) => updateContactField("whatsapp", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
                <input placeholder="Location" value={homepageForm.contact.location} onChange={(e) => updateContactField("location", e.target.value)} style={inputStyle} />
                <input placeholder="Support hours" value={homepageForm.contact.supportHours} onChange={(e) => updateContactField("supportHours", e.target.value)} style={inputStyle} />
              </div>
              <input placeholder="Map search query" value={homepageForm.contact.mapQuery} onChange={(e) => updateContactField("mapQuery", e.target.value)} style={inputStyle} />
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>Contact cards</h4>
                {homepageForm.contact.cards.map((item, index) => (
                  <div key={`contact-card-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <input placeholder="Title" value={item.title} onChange={(e) => updateContactCardField(index, "title", e.target.value)} style={inputStyle} />
                    <textarea placeholder="Detail" value={item.detail} onChange={(e) => updateContactCardField(index, "detail", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                      <input placeholder="Icon" value={item.icon} onChange={(e) => updateContactCardField(index, "icon", e.target.value)} style={inputStyle} />
                      <input placeholder="Action URL" value={item.action} onChange={(e) => updateContactCardField(index, "action", e.target.value)} style={inputStyle} />
                    </div>
                    <button type="button" onClick={() => removeContactCard(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove card</button>
                  </div>
                ))}
                <button type="button" onClick={addContactCard} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add contact card</button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h4 style={{ margin: 0, color: "#cbd5e1" }}>Contact FAQ</h4>
                {homepageForm.contact.faqs.map((item, index) => (
                  <div key={`contact-faq-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                    <input placeholder="Question" value={item.question} onChange={(e) => updateContactFaqField(index, "question", e.target.value)} style={inputStyle} />
                    <textarea placeholder="Answer" value={item.answer} onChange={(e) => updateContactFaqField(index, "answer", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                      <input type="checkbox" checked={item.visible} onChange={(e) => updateContactFaqField(index, "visible", e.target.checked)} />
                      Show FAQ item
                    </label>
                    <button type="button" onClick={() => removeContactFaq(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove FAQ</button>
                  </div>
                ))}
                <button type="button" onClick={addContactFaq} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add contact FAQ</button>
              </div>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                <input placeholder="Facebook URL" value={homepageForm.contact.social.facebook} onChange={(e) => updateContactSocialField("facebook", e.target.value)} style={inputStyle} />
                <input placeholder="TikTok URL" value={homepageForm.contact.social.tiktok} onChange={(e) => updateContactSocialField("tiktok", e.target.value)} style={inputStyle} />
                <input placeholder="Instagram URL" value={homepageForm.contact.social.instagram} onChange={(e) => updateContactSocialField("instagram", e.target.value)} style={inputStyle} />
                <input placeholder="YouTube URL" value={homepageForm.contact.social.youtube} onChange={(e) => updateContactSocialField("youtube", e.target.value)} style={inputStyle} />
                <input placeholder="LinkedIn URL" value={homepageForm.contact.social.linkedin} onChange={(e) => updateContactSocialField("linkedin", e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Stats section</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                <input type="checkbox" checked={homepageForm.statsVisible} onChange={(e) => setHomepageForm((current) => ({ ...current, statsVisible: e.target.checked }))} />
                Show stats section
              </label>
              {homepageForm.stats.map((stat, index) => (
                <div key={`stat-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Stat label" value={stat.label} onChange={(e) => updateStatsField(index, "label", e.target.value)} style={inputStyle} />
                    <input placeholder="Stat value" value={stat.value} onChange={(e) => updateStatsField(index, "value", e.target.value)} style={inputStyle} />
                  </div>
                  <input placeholder="Icon" value={stat.icon} onChange={(e) => updateStatsField(index, "icon", e.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => removeStat(index)} style={{ ...buttonStyle, backgroundColor: "#ef4444", width: "fit-content" }}>Remove stat</button>
                </div>
              ))}
              <button type="button" onClick={addStat} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add stat</button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Popular Courses section</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                <input type="checkbox" checked={homepageForm.popularCoursesVisible} onChange={(e) => setHomepageForm((current) => ({ ...current, popularCoursesVisible: e.target.checked }))} />
                Show popular courses section
              </label>
              {homepageForm.popularCourses.map((course, index) => (
                <div key={`course-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
                    <input placeholder="Badge" value={course.label} onChange={(e) => updatePopularCourseField(index, "label", e.target.value)} style={inputStyle} />
                    <input placeholder="Title" value={course.title} onChange={(e) => updatePopularCourseField(index, "title", e.target.value)} style={inputStyle} />
                  </div>
                  <textarea placeholder="Short description" value={course.description} onChange={(e) => updatePopularCourseField(index, "description", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                    <input placeholder="Rating" value={course.rating} onChange={(e) => updatePopularCourseField(index, "rating", e.target.value)} style={inputStyle} />
                    <input placeholder="Learners" value={course.learners} onChange={(e) => updatePopularCourseField(index, "learners", e.target.value)} style={inputStyle} />
                    <input placeholder="Duration" value={course.duration} onChange={(e) => updatePopularCourseField(index, "duration", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                    <input placeholder="Level" value={course.level} onChange={(e) => updatePopularCourseField(index, "level", e.target.value)} style={inputStyle} />
                    <input placeholder="Price" value={course.price} onChange={(e) => updatePopularCourseField(index, "price", e.target.value)} style={inputStyle} />
                    <input placeholder="Discount %" value={course.discount} onChange={(e) => updatePopularCourseField(index, "discount", e.target.value)} style={inputStyle} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                    <input type="checkbox" checked={course.featured} onChange={(e) => updatePopularCourseField(index, "featured", e.target.checked)} />
                    Feature this course
                  </label>
                  <input type="file" accept="image/*" onChange={(e) => handleCourseImageChange(index, e)} style={inputStyle} />
                  <input placeholder="Thumbnail URL" value={course.imageUrl} onChange={(e) => updatePopularCourseField(index, "imageUrl", e.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => removePopularCourse(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove course</button>
                </div>
              ))}
              <button type="button" onClick={addPopularCourse} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add course card</button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Testimonials</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                <input type="checkbox" checked={homepageForm.testimonialsVisible} onChange={(e) => setHomepageForm((current) => ({ ...current, testimonialsVisible: e.target.checked }))} />
                Show testimonials section
              </label>
              {homepageForm.testimonials.map((item, index) => (
                <div key={`testimonial-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <input placeholder="Quote" value={item.quote} onChange={(e) => updateTestimonialField(index, "quote", e.target.value)} style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                    <input placeholder="Name" value={item.name} onChange={(e) => updateTestimonialField(index, "name", e.target.value)} style={inputStyle} />
                    <input placeholder="Position / title" value={item.role} onChange={(e) => updateTestimonialField(index, "role", e.target.value)} style={inputStyle} />
                  </div>
                  <input placeholder="Photo URL" value={item.photoUrl} onChange={(e) => updateTestimonialField(index, "photoUrl", e.target.value)} style={inputStyle} />
                  <input type="file" accept="image/*" onChange={(e) => handleTestimonialPhotoChange(index, e)} style={inputStyle} />
                  <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                    <input type="checkbox" checked={item.approved ?? true} onChange={(e) => updateTestimonialField(index, "approved", e.target.checked)} />
                    Approve testimonial for homepage
                  </label>
                  <button type="button" onClick={() => removeTestimonial(index)} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#ef4444" }}>Remove testimonial</button>
                </div>
              ))}
              <button type="button" onClick={addTestimonial} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add testimonial</button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>FAQ section</h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#e2e8f0" }}>
                <input type="checkbox" checked={homepageForm.faqVisible} onChange={(e) => setHomepageForm((current) => ({ ...current, faqVisible: e.target.checked }))} />
                Show FAQ section
              </label>
              {homepageForm.faq.map((item, index) => (
                <div key={`faq-${index}`} style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <input placeholder="Question" value={item.question} onChange={(e) => updateFaqField(index, "question", e.target.value)} style={inputStyle} />
                  <textarea placeholder="Answer" value={item.answer} onChange={(e) => updateFaqField(index, "answer", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => moveFaq(index, -1)} disabled={index === 0} style={{ ...buttonStyle, backgroundColor: "#2563eb" }}>Move up</button>
                    <button type="button" onClick={() => moveFaq(index, 1)} disabled={index === homepageForm.faq.length - 1} style={{ ...buttonStyle, backgroundColor: "#2563eb" }}>Move down</button>
                    <button type="button" onClick={() => removeFaq(index)} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>Delete FAQ</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addFaq} style={{ ...buttonStyle, width: "fit-content", backgroundColor: "#2563eb" }}>Add FAQ</button>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Footer settings</h3>
              <input placeholder="Contact info" value={homepageForm.footer.contactInfo} onChange={(e) => updateFooterField("contactInfo", e.target.value)} style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
                <input placeholder="Email" value={homepageForm.footer.email} onChange={(e) => updateFooterField("email", e.target.value)} style={inputStyle} />
                <input placeholder="Phone" value={homepageForm.footer.phone} onChange={(e) => updateFooterField("phone", e.target.value)} style={inputStyle} />
                <input placeholder="Address" value={homepageForm.footer.address} onChange={(e) => updateFooterField("address", e.target.value)} style={inputStyle} />
              </div>
              <input placeholder="Footer text" value={homepageForm.footer.text} onChange={(e) => updateFooterField("text", e.target.value)} style={inputStyle} />
              <input placeholder="Logo URL" value={homepageForm.footer.logoUrl} onChange={(e) => updateFooterField("logoUrl", e.target.value)} style={inputStyle} />
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                <input placeholder="Facebook URL" value={homepageForm.footer.social.facebook} onChange={(e) => updateFooterSocialField("facebook", e.target.value)} style={inputStyle} />
                <input placeholder="TikTok URL" value={homepageForm.footer.social.tiktok} onChange={(e) => updateFooterSocialField("tiktok", e.target.value)} style={inputStyle} />
                <input placeholder="Instagram URL" value={homepageForm.footer.social.instagram} onChange={(e) => updateFooterSocialField("instagram", e.target.value)} style={inputStyle} />
                <input placeholder="YouTube URL" value={homepageForm.footer.social.youtube} onChange={(e) => updateFooterSocialField("youtube", e.target.value)} style={inputStyle} />
                <input placeholder="LinkedIn URL" value={homepageForm.footer.social.linkedin} onChange={(e) => updateFooterSocialField("linkedin", e.target.value)} style={inputStyle} />
              </div>
            </div>

            {message && (
              <div style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "1rem", padding: "1rem", color: "#22c55e" }}>{message}</div>
            )}

            <button type="submit" style={buttonStyle}>Save homepage settings</button>
          </form>
        )}
      </div>
    </div>
  );
}
