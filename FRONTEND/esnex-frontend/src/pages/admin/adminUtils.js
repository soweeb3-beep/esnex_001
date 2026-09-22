import { useEffect, useState } from "react";

export const useWindowSize = () => {
  const [size, setSize] = useState({ width: typeof window !== "undefined" ? window.innerWidth : 1024 });

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
};

export const inputStyle = {
  width: "100%",
  borderRadius: "1rem",
  border: "1px solid #334155",
  backgroundColor: "#020617",
  color: "#f1f5f9",
  padding: "0.9rem 1rem",
  outline: "none",
};

export const buttonStyle = {
  width: "fit-content",
  borderRadius: "1rem",
  border: "none",
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  padding: "0.95rem 1.25rem",
  cursor: "pointer",
  fontWeight: 700,
};

export const tableHeader = {
  padding: "1rem",
  fontSize: "0.9rem",
  fontWeight: 600,
};

export const tableCell = {
  padding: "1rem",
  color: "#e2e8f0",
  verticalAlign: "middle",
};

export const deleteButtonStyle = {
  borderRadius: "999px",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  backgroundColor: "rgba(239, 68, 68, 0.08)",
  color: "#ef4444",
  padding: "0.55rem 0.85rem",
  cursor: "pointer",
};

export const sectionCardStyle = {
  backgroundColor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "1.5rem",
  padding: "1.5rem",
  display: "grid",
  gap: "1rem",
  marginTop: "1.5rem",
};

export const sectionHeadingStyle = {
  color: "#e2e8f0",
  fontSize: "1.1rem",
  fontWeight: 600,
  margin: "0 0 1rem 0",
};
