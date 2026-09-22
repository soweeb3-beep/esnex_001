const path = require("path");
const { getModel } = require("../config/adapter");

const HomepageSettings = getModel("HomepageSettings");

const parseJsonField = (value, fallback) => {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getHomepage = async (req, res) => {
  try {
    let homepage = await HomepageSettings.findOne();

    if (!homepage) {
      homepage = await HomepageSettings.create({
        hero: {
          badge: "Professional exam preparation",
          title: "Learn. Assess. Succeed.",
          subtitle: "ESNEX is an all-in-one learning and assessment platform designed to help learners and organizations achieve excellence through innovative technology.",
          primaryCtaText: "Get Started Free",
          primaryCtaLink: "/register",
          secondaryCtaText: "Explore Courses",
          secondaryCtaLink: "/courses",
          imageUrl: "",
          backgroundType: "image",
          backgroundUrl: "",
        },
        statsVisible: true,
        stats: [
          { label: "Active Learners", value: "10K+" },
          { label: "Courses", value: "500+" },
          { label: "Assessments Taken", value: "50K+" },
          { label: "Success Rate", value: "95%" },
        ],
        popularCoursesVisible: true,
        popularCourses: [
          { label: "Bestseller", title: "Mastering WASSCE", rating: "4.8", learners: "2.1k learners", level: "Beginner", lessons: "12 Lessons", duration: "8h 45m", price: "", discount: "", featured: false, imageUrl: "" },
          { label: "Popular", title: "The Complete Guide", rating: "4.7", learners: "1.8k learners", level: "Intermediate", lessons: "18 Lessons", duration: "12h 30m", price: "", discount: "", featured: false, imageUrl: "" },
          { label: "New", title: "Script Essentials", rating: "4.6", learners: "1.2k learners", level: "Beginner", lessons: "10 Lessons", duration: "5h 15m", price: "", discount: "", featured: false, imageUrl: "" },
          { label: "Popular", title: "Fundamentals", rating: "4.7", learners: "980 learners", level: "Intermediate", lessons: "14 Lessons", duration: "7h 20m", price: "", discount: "", featured: false, imageUrl: "" },
        ],
        testimonialsVisible: true,
        testimonials: [
          { quote: "ESNEX has completely transformed the way I learn. The courses are well-structured and the assessments help me track my progress effectively.", name: "Priya S.", role: "Data Analyst", photoUrl: "", approved: true, visible: true },
          { quote: "The platform is intuitive, the content is top-notch, and the certificates helped me land my dream job.", name: "Rahul K.", role: "Software Developer", photoUrl: "", approved: true, visible: true },
          { quote: "I love the real-time analytics and the quality of assessments. Highly recommended for serious learners!", name: "Anita M.", role: "Student", photoUrl: "", approved: true, visible: true },
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
          social: { facebook: "", twitter: "", linkedin: "" },
        },
        footer: {
          contactInfo: "Support Center",
          email: "support@esnex.com",
          phone: "+232 76 123 456",
          address: "Freetown, Sierra Leone",
          social: { facebook: "", twitter: "", linkedin: "" },
          text: "© 2026 ESNEX. All rights reserved.",
          logoUrl: "",
        },
      });
    }

    // Ensure about and contact fields exist
    if (!homepage.about) {
      homepage.about = {
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
          { title: "Our Vision", text: "To become Africa's leading digital education platform, setting the standard for online learning and examination preparation.", icon: "👁️" },
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
      };
    }

    if (!homepage.contact) {
      homepage.contact = {
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
        social: { facebook: "", twitter: "", linkedin: "" },
      };
    }

    res.json({ homepage });
  } catch (error) {
    console.error("Homepage load error", error);
    res.status(500).json({ message: "Unable to load homepage settings." });
  }
};

const updateHomepage = async (req, res) => {
  try {
    const homepagePayload = parseJsonField(req.body.homepage, {});

    const files = req.files || [];
    const imageMap = {};

    files.forEach((file) => {
      imageMap[file.fieldname] = `/uploads/homepage/${file.filename}`;
    });

    const mergedData = {
      ...(homepagePayload || {}),
      hero: {
        ...(homepagePayload.hero || {}),
        ...(imageMap.heroImage ? { imageUrl: imageMap.heroImage } : {}),
      },
    };

    if (Array.isArray(homepagePayload.popularCourses)) {
      mergedData.popularCourses = homepagePayload.popularCourses.map((course, index) => ({
        ...course,
        imageUrl: imageMap[`courseImage-${index}`] || course.imageUrl || "",
      }));
    }

    if (Array.isArray(homepagePayload.testimonials)) {
      mergedData.testimonials = homepagePayload.testimonials.map((testimonial, index) => ({
        ...testimonial,
        photoUrl: imageMap[`testimonialPhoto-${index}`] || testimonial.photoUrl || "",
      }));
    }

    const homepage = await HomepageSettings.findOneAndUpdate({}, mergedData, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    res.json({ homepage });
  } catch (error) {
    console.error("Homepage update error", error);
    res.status(500).json({ message: "Unable to update homepage settings." });
  }
};

module.exports = {
  getHomepage,
  updateHomepage,
};
