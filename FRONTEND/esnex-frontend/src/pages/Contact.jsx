import { useEffect, useState } from "react";
import API from "../api/axios";

const contactCards = [
  { title: "Email Us", detail: "esnexhelpdesk@gmail.com", icon: "✉️" },
  { title: "Call Us", detail: "+220 123 4567\n+220 987 6543", icon: "📞" },
  { title: "WhatsApp", detail: "+220 123 4567", icon: "💬", action: "https://wa.me/2201234567" },
  { title: "Our Location", detail: "Brikama, West Coast Region\nThe Gambia", icon: "📍" },
  { title: "Support Hours", detail: "Monday – Saturday\n8:00 AM – 8:00 PM", icon: "⏰" },
];

const faqs = [
  { question: "How do I enroll in a course?", answer: "Choose the course you want, click enroll, and complete the registration process. You can start learning immediately after enrollment." },
  { question: "How do assessments work?", answer: "Each assessment is designed to simulate exam conditions. Review your score and analytics after each attempt to improve faster." },
  { question: "Are the questions WAEC/WASSCE standard?", answer: "Yes. Our content is built to match WAEC/WASSCE standards, with realistic question formats and grading models." },
  { question: "How do payments work?", answer: "You can pay securely via the payment gateway after selecting a course or assessment. Receipts are issued immediately after payment." },
  { question: "Can I access quizzes on mobile?", answer: "Absolutely. Our platform is responsive and works across desktop, tablet, and mobile devices." },
  { question: "How do I get help if I have an issue?", answer: "Reach out using email, phone, WhatsApp, or the contact form. Our support team is available during support hours." },
];

const DEFAULT_CONTACT = {
  heroTitle: "We Would Love To Hear From You",
  heroSubtitle: "Have questions or need help? Reach out to us anytime, and our team will respond with fast, friendly support.",
  email: "esnexhelpdesk@gmail.com",
  phone: "+220 123 4567",
  whatsapp: "+220 123 4567",
  location: "Brikama, West Coast Region\nThe Gambia",
  supportHours: "Monday – Saturday\n8:00 AM – 8:00 PM",
  mapQuery: "Brikama, The Gambia",
  cards: [
    { title: "Email Us", detail: "esnexhelpdesk@gmail.com", icon: "✉️", action: "mailto:esnexhelpdesk@gmail.com" },
    { title: "Call Us", detail: "+220 123 4567\n+220 987 6543", icon: "📞", action: "tel:+2201234567" },
    { title: "WhatsApp", detail: "+220 123 4567", icon: "💬", action: "https://wa.me/2201234567" },
    { title: "Our Location", detail: "Brikama, West Coast Region\nThe Gambia", icon: "📍" },
    { title: "Support Hours", detail: "Monday – Saturday\n8:00 AM – 8:00 PM", icon: "⏰" },
  ],
  faqs: [
    { question: "How do I enroll in a course?", answer: "Choose the course you want, click enroll, and complete the registration process. You can start learning immediately after enrollment." },
    { question: "How do assessments work?", answer: "Each assessment is designed to simulate exam conditions. Review your score and analytics after each attempt to improve faster." },
    { question: "Are the questions WAEC/WASSCE standard?", answer: "Yes. Our content is built to match WAEC/WASSCE standards, with realistic question formats and grading models." },
    { question: "How do payments work?", answer: "You can pay securely via the payment gateway after selecting a course or assessment. Receipts are issued immediately after payment." },
    { question: "Can I access quizzes on mobile?", answer: "Absolutely. Our platform is responsive and works across desktop, tablet, and mobile devices." },
    { question: "How do I get help if I have an issue?", answer: "Reach out using email, phone, WhatsApp, or the contact form. Our support team is available during support hours." },
  ],
  social: { facebook: "", tiktok: "", instagram: "", youtube: "", linkedin: "" },
};

export default function Contact() {
  const [activeFaq, setActiveFaq] = useState(0);
  const [contactData, setContactData] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  useEffect(() => {
    const loadHomepage = async () => {
      try {
        const res = await API.get("/homepage");
        setContactData(res.data.homepage?.contact || null);
      } catch (err) {
        console.error("Failed to load contact content", err);
      }
    };

    loadHomepage();
  }, []);

  const content = contactData || DEFAULT_CONTACT;
  const cards = content.cards || contactCards;
  const faqItems = content.faqs || faqs;

  const socialLinks = [
    {
      name: "Facebook",
      href: content.social.facebook || "#",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9v-2.89h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.89h-2.34v6.99C18.34 21.12 22 16.99 22 12z" />
        </svg>
      ),
    },
    {
      name: "TikTok",
      href: content.social.tiktok || "#",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.75 2.5v10.8c0 1.14-.9 2.05-2.05 2.05-1.14 0-2.05-.91-2.05-2.05s.91-2.05 2.05-2.05c.24 0 .48.04.7.12V8.71a4.42 4.42 0 0 1-.7-.06 4.35 4.35 0 0 1-1.9-.48V14.4c0 1.27 1.03 2.3 2.3 2.3 1.27 0 2.3-1.03 2.3-2.3V4.45h3.15c.12 1.47.86 2.82 2.05 3.64.78.54 1.69.84 2.64.84v-3.1a4.98 4.98 0 0 1-2.05-.42c-1.31-.58-2.24-1.74-2.59-3.15H9.75Z" />
        </svg>
      ),
    },
    {
      name: "Instagram",
      href: content.social.instagram || "#",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5Zm9.5 1.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        </svg>
      ),
    },
    {
      name: "YouTube",
      href: content.social.youtube || "#",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.8 7.1a2.5 2.5 0 0 0-1.76-1.76C18.8 5 12 5 12 5s-6.8 0-8.05.34A2.5 2.5 0 0 0 2.2 7.1 26.7 26.7 0 0 0 2 12a26.7 26.7 0 0 0 .2 4.9 2.5 2.5 0 0 0 1.75 1.76C5.2 19 12 19 12 19s6.8 0 8.05-.34a2.5 2.5 0 0 0 1.76-1.76A26.7 26.7 0 0 0 22 12a26.7 26.7 0 0 0-.2-4.9Zm-12.5 8.3V8.6l6 3.4-6 3.4Z" />
        </svg>
      ),
    },
    {
      name: "LinkedIn",
      href: content.social.linkedin || "#",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm.02 7.5H2v11h3V11Zm5 0H7v11h3v-5.9c0-1.8 2.2-1.9 2.2 0V22h3v-6.5c0-4.4-4.8-4.2-5.2-2.1V11Z" />
        </svg>
      ),
    },
  ].filter((item) => item.href && item.href !== "#");

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = (event) => {
    event.preventDefault();
    setForm({ name: "", email: "", subject: "", message: "" });
    window.alert("Thank you! Your message has been sent.");
  };

  return (
    <main className="contact-page">
      <section className="page-hero page-hero-contact">
        <div className="container page-hero-grid contact-hero-grid">
          <div className="hero-copy">
            <span className="section-label">CONTACT US</span>
            <h1>{content.heroTitle}</h1>
            <p>{content.heroSubtitle}</p>
          </div>
          <div className="contact-hero-actions">
            <a className="btn btn-primary large" href={`mailto:${content.email}`}>
              Email Support
            </a>
            <a className="btn btn-secondary large" href={`https://wa.me/${(content.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="section-block contact-grid">
        <div className="contact-info-panel">
          {cards.map((item) => (
            <article key={item.title} className="contact-card">
              <div className="contact-card-icon">{item.icon}</div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail.split("\n").map((line, index) => (<span key={index}>{line}<br /></span>))}</p>
                {item.action && (
                  <a className="whatsapp-link" href={item.action} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="contact-form-panel">
          <form className="contact-form" onSubmit={submitForm}>
            <label>
              Your Name
              <input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Enter your name" required />
            </label>
            <label>
              Your Email
              <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="Enter your email" required />
            </label>
            <label>
              Subject
              <input type="text" value={form.subject} onChange={(e) => updateForm("subject", e.target.value)} placeholder="Subject" required />
            </label>
            <label>
              Your Message
              <textarea value={form.message} onChange={(e) => updateForm("message", e.target.value)} placeholder="Write your message" rows="5" required />
            </label>
            <button type="submit" className="btn btn-primary large submit-button">
              Send Message
            </button>
          </form>
        </div>

        <div className="contact-map-panel">
          <div className="map-card">
            <div className="map-card-title">Find Us</div>
            <iframe
              title="ESNEX location map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(content.mapQuery)}&output=embed`}
              allowFullScreen
              loading="lazy"
            />
          </div>
          <div className="social-card">
            <div className="map-card-title">Follow Us</div>
            <div className="social-links">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block faq-section">
        <div className="section-intro">
          <p>Frequently Asked Questions</p>
          <h2>Answers to common questions about ESNEX.</h2>
        </div>
        <div className="faq-grid">
          {faqItems.map((item, index) => (
            <div
              key={item.question}
              className={`faq-item ${activeFaq === index ? "active" : ""}`}
              onClick={() => setActiveFaq(index)}
            >
              <button type="button" className="faq-question">
                <span>{item.question}</span>
                <span>{activeFaq === index ? "-" : "+"}</span>
              </button>
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="contact-footer">
        <div className="footer-brand">
          <span className="brand-icon">E</span>
          <div>
            <strong>ESNEX</strong>
            <p>Helping students achieve exam success with structured learning and secure assessments.</p>
          </div>
        </div>
        <div className="footer-links-grid">
          <div>
            <strong>Explore</strong>
            <nav>
              <a href="/">Home</a>
              <a href="/courses">Courses</a>
              <a href="/assessments">Assessments</a>
            </nav>
          </div>
          <div>
            <strong>Support</strong>
            <nav>
              <a href="mailto:esnexhelpdesk@gmail.com">esnexhelpdesk@gmail.com</a>
              <a href="#">Help Center</a>
              <a href="#">Refund Policy</a>
            </nav>
          </div>
          <div>
            <strong>Legal</strong>
            <nav>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </nav>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ESNEX Technologies. All rights reserved.</span>
          <span>Made with <span className="heart">❤</span> for Students</span>
        </div>
      </footer>
    </main>
  );
}
