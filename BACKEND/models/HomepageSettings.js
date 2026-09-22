const mongoose = require("mongoose");

const homepageSettingsSchema = new mongoose.Schema(
  {
    hero: {
      badge: { type: String, default: "Professional exam preparation" },
      title: { type: String, default: "Learn. Assess. Succeed." },
      subtitle: { type: String, default: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology." },
      primaryCtaText: { type: String, default: "Get Started Free" },
      primaryCtaLink: { type: String, default: "/register" },
      secondaryCtaText: { type: String, default: "Explore Courses" },
      secondaryCtaLink: { type: String, default: "/courses" },
      imageUrl: { type: String, default: "" },
      backgroundType: { type: String, default: "image" },
      backgroundUrl: { type: String, default: "" },
    },
    statsVisible: { type: Boolean, default: true },
    stats: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    popularCoursesVisible: { type: Boolean, default: true },
    popularCourses: [
      {
        label: { type: String, default: "Popular" },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        rating: { type: String, default: "4.8" },
        learners: { type: String, default: "1.2k learners" },
        level: { type: String, default: "Beginner" },
        lessons: { type: String, default: "10 Lessons" },
        duration: { type: String, default: "8h 45m" },
        price: { type: String, default: "" },
        discount: { type: String, default: "" },
        featured: { type: Boolean, default: false },
        imageUrl: { type: String, default: "" },
      },
    ],
    testimonialsVisible: { type: Boolean, default: true },
    testimonials: [
      {
        quote: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, default: "Student" },
        photoUrl: { type: String, default: "" },
        approved: { type: Boolean, default: true },
        visible: { type: Boolean, default: true },
      },
    ],
    faqVisible: { type: Boolean, default: true },
    faq: [
      {
        question: { type: String, default: "" },
        answer: { type: String, default: "" },
        visible: { type: Boolean, default: true },
      },
    ],
    about: {
      badge: { type: String, default: "ABOUT ESNEX" },
      title: { type: String, default: "Empowering Students. Transforming Education." },
      subtitle: { type: String, default: "ESNEX Technologies is a modern online learning and assessment platform built to help students prepare for WAEC/WASSCE and other examinations." },
      primaryCtaText: { type: String, default: "Explore Courses" },
      primaryCtaLink: { type: String, default: "/courses" },
      secondaryCtaText: { type: String, default: "Start Assessment" },
      secondaryCtaLink: { type: String, default: "/assessments" },
      badges: [
        {
          title: { type: String, default: "WAEC Standard CBT Platform" },
          icon: { type: String, default: "🛡️" },
        },
      ],
      missionVision: [
        {
          title: { type: String, default: "Our Mission" },
          text: { type: String, default: "To make quality education accessible and effective for every student through technology-driven learning and assessment solutions." },
          icon: { type: String, default: "🎯" },
        },
      ],
      features: [
        {
          title: { type: String, default: "CBT Assessments" },
          detail: { type: String, default: "WAEC/WASSCE style assessments with real exam simulation." },
          icon: { type: String, default: "📝" },
        },
      ],
      stats: [
        {
          value: { type: String, default: "2,350+" },
          label: { type: String, default: "Students" },
        },
      ],
    },
    contact: {
      heroTitle: { type: String, default: "We Would Love To Hear From You" },
      heroSubtitle: { type: String, default: "Have questions or need help? Reach out to us anytime, and our team will respond with fast, friendly support." },
      email: { type: String, default: "support@esnex.com" },
      phone: { type: String, default: "+220 123 4567" },
      whatsapp: { type: String, default: "+220 123 4567" },
      location: { type: String, default: "Brikama, West Coast Region, The Gambia" },
      supportHours: { type: String, default: "Monday – Saturday\n8:00 AM – 8:00 PM" },
      mapQuery: { type: String, default: "Brikama, The Gambia" },
      cards: [
        {
          title: { type: String, default: "Email Us" },
          detail: { type: String, default: "support@esnex.com\ninfo@esnex.com" },
          icon: { type: String, default: "✉️" },
          action: { type: String, default: "mailto:support@esnex.com" },
        },
      ],
      faqs: [
        {
          question: { type: String, default: "How do I enroll in a course?" },
          answer: { type: String, default: "Choose the course you want, click enroll, and complete the registration process. You can start learning immediately after enrollment." },
          visible: { type: Boolean, default: true },
        },
      ],
      social: {
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" },
        linkedin: { type: String, default: "" },
      },
    },
    footer: {
      contactInfo: { type: String, default: "Support Center" },
      email: { type: String, default: "support@esnex.com" },
      phone: { type: String, default: "+232 76 123 456" },
      address: { type: String, default: "Freetown, Sierra Leone" },
      social: {
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" },
        linkedin: { type: String, default: "" },
      },
      text: { type: String, default: "© 2026 ESNEX. All rights reserved." },
      logoUrl: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomepageSettings", homepageSettingsSchema);
