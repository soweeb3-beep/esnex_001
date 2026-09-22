import { useEffect, useState } from "react";

export default function BackToTop({ threshold = 200 }) {
  const [visible, setVisible] = useState(false);
  const [isNearFooter, setIsNearFooter] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);

      // Calculate distance from footer
      const footer = document.querySelector("footer");
      if (footer) {
        const footerTop = footer.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        // If footer is within 150px from bottom of screen, move button above it
        setIsNearFooter(footerTop < windowHeight + 150);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      className={`back-to-top ${visible ? "visible" : ""} ${isNearFooter ? "near-footer" : ""}`}
      onClick={handleClick}
    >
      ↑
    </button>
  );
}
