import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import heroLogo from "../../assets/hero.png";
import {
  useWindowSize,
  buttonStyle,
  tableHeader,
  tableCell,
  deleteButtonStyle,
  sectionCardStyle,
  sectionHeadingStyle,
} from "./adminUtils";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const getQrCodeUrl = (text) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${encodeURIComponent(text)}`;

export default function AdminCertificates() {
  const { width: windowWidth } = useWindowSize();
  const [eligible, setEligible] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedManualStudentId, setSelectedManualStudentId] = useState("");
  const [selectedManualCourseId, setSelectedManualCourseId] = useState("");
  const [certificateForm, setCertificateForm] = useState({
    studentName: "Student Name",
    courseName: "Course Name",
    issuedDate: new Date().toISOString().slice(0, 10),
    studentEmail: "",
    qrDetails: "Scan the QR code to verify this certificate.",
  });
  const [loading, setLoading] = useState(false);
  const [qrEnabled, setQrEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 768;

  const loadCertificates = async () => {
    setLoading(true);
    setError("");
    try {
      const [certRes, eligibleRes, usersRes, coursesRes] = await Promise.all([
        API.get("/certificates"),
        API.get("/certificates/eligible"),
        API.get("/auth/users"),
        API.get("/courses"),
      ]);
      setCertificates(certRes.data.certificates || []);
      setEligible(eligibleRes.data.eligible || []);
      setUsers((usersRes.data.users || []).filter((user) => user.roleString !== "admin"));
      setCourses(coursesRes.data.courses || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load certificate data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const filteredEligible = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return eligible;

    return eligible.filter((item) => {
      return (
        item.studentName.toLowerCase().includes(q) ||
        item.studentEmail.toLowerCase().includes(q) ||
        item.courseName.toLowerCase().includes(q)
      );
    });
  }, [eligible, searchTerm]);

  const filteredCertificates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return certificates;

    return certificates.filter((item) => {
      return (
        item.certificateId?.toLowerCase().includes(q) ||
        item.studentName?.toLowerCase().includes(q) ||
        item.courseName?.toLowerCase().includes(q) ||
        item.status?.toLowerCase().includes(q)
      );
    });
  }, [certificates, searchTerm]);

  const selectedManualStudent = users.find((user) => String(user._id) === String(selectedManualStudentId));
  const selectedManualCourse = courses.find((course) => String(course._id) === String(selectedManualCourseId));
  const canCreateCertificate = Boolean(selectedCandidate || (selectedManualStudent && selectedManualCourse));

  const issueCertificate = async (candidate, manualIssuance = false) => {
    if (!candidate) return;
    setMessage("");
    setError("");

    const payload = {
      studentId: String(candidate.studentId || candidate._id || ""),
      courseId: String(candidate.courseId || candidate._id || ""),
      qrDetails: certificateForm.qrDetails,
      qrEnabled,
      studentName: certificateForm.studentName,
      courseName: certificateForm.courseName,
      studentEmail: certificateForm.studentEmail,
      issuedDate: certificateForm.issuedDate,
      manualIssuance: Boolean(manualIssuance),
    };

    console.log("Issuing certificate payload:", payload);

    try {
      const res = await API.post("/certificates", payload);
      setSelectedCertificate(res.data.certificate);
      setCertificateForm((prev) => ({
        ...prev,
        studentName: res.data.certificate.studentName,
        courseName: res.data.certificate.courseName,
        issuedDate: new Date(res.data.certificate.issuedDate).toISOString().slice(0, 10),
        studentEmail: res.data.certificate.studentEmail,
        qrDetails: res.data.certificate.verificationData?.qrDetails || prev.qrDetails,
      }));
      setMessage(`Certificate issued: ${res.data.certificate.certificateId}. Available in the student's account.`);
      await loadCertificates();
      setSelectedCandidate(null);
      setSelectedManualStudentId("");
      setSelectedManualCourseId("");
    } catch (err) {
      console.error("issueCertificate error:", err?.response?.data || err.message || err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to issue certificate"
      );
    }
  };

  const revokeCertificate = async (certificateId) => {
    setMessage("");
    setError("");

    try {
      await API.patch(`/certificates/${certificateId}/revoke`);
      setMessage("Certificate has been revoked.");
      await loadCertificates();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to revoke certificate");
    }
  };

  const verificationUrl = `${window.location.origin}/verify-certificate/${selectedCertificate?.certificateId || "CERT-2026-0001"}`;

  const previewData = {
    studentName: certificateForm.studentName,
    courseName: certificateForm.courseName,
    studentEmail: certificateForm.studentEmail,
    certificateId: selectedCertificate?.certificateId || "CERT-2026-0001",
    issuedDate: certificateForm.issuedDate || new Date().toISOString(),
    status: selectedCertificate?.status || "Valid",
    qrDetails: certificateForm.qrDetails,
    verificationUrl,
  };

  const updateCertificateForm = (field, value) => {
    setCertificateForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const source = selectedCertificate || selectedCandidate;
    if (!source) return;

    setCertificateForm({
      studentName: source.studentName || "Student Name",
      courseName: source.courseName || "Course Name",
      issuedDate: source.issuedDate ? new Date(source.issuedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      studentEmail: source.studentEmail || "",
      qrDetails: source.verificationData?.qrDetails || "Scan the QR code to verify this certificate.",
    });
  }, [selectedCertificate, selectedCandidate]);

  const qrPayloadText = [
    "ESNEX TECHNOLOGIES CERTIFICATE",
    "",
    `Certificate ID: ${previewData.certificateId}`,
    `Student: ${previewData.studentName}`,
    `Course: ${previewData.courseName}`,
    `Issued Date: ${formatDate(previewData.issuedDate)}`,
    `Status: ${previewData.status === "Revoked" ? "Revoked" : "Valid"}`,
    "",
    `Verification: ${previewData.verificationUrl}`,
    "",
    previewData.qrDetails || "Scan this QR code to verify this certificate.",
  ].join("\n");

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem", display: "grid", gap: "1rem" }}>
      <div style={{ ...sectionCardStyle }}>
        <h2 style={{ margin: 0, ...sectionHeadingStyle }}>Admin Certificate Management</h2>
        <p style={{ margin: 0, color: "#94a3b8" }}>
          Issue and verify completion certificates with premium branding, QR verification, and admin-only controls.
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(248, 113, 113, 0.12)", color: "#fee2e2" }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: "1rem", borderRadius: "1rem", backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#dcfce7" }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr" }}>
        <div style={{ ...sectionCardStyle }}>
          <h3 style={sectionHeadingStyle}>Completed Student Course Completions</h3>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            Students who have completed their courses and are ready to be added to the certificate issuance list.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
            <div style={{ padding: "0.85rem 1rem", borderRadius: "1rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }}>
              {eligible.length} completed student{eligible.length === 1 ? "" : "s"}
            </div>
            <div style={{ padding: "0.85rem 1rem", borderRadius: "1rem", background: "#ecfccb", color: "#4d7c0f", fontWeight: 600 }}>
              {certificates.length} issued certificate{certificates.length === 1 ? "" : "s"}
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                  <th style={{ ...tableHeader }}>Student</th>
                  <th style={{ ...tableHeader }}>Course</th>
                  {!isMobile && <th style={{ ...tableHeader }}>Email</th>}
                  <th style={{ ...tableHeader }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ ...tableCell }}>Loading eligible certificates…</td>
                  </tr>
                ) : filteredEligible.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...tableCell }}>No eligible course completions found.</td>
                  </tr>
                ) : (
                  filteredEligible.map((candidate) => (
                    <tr key={`${candidate.studentId}-${candidate.courseId}`} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                      <td style={tableCell}>{candidate.studentName}</td>
                      <td style={tableCell}>{candidate.courseName}</td>
                      {!isMobile && <td style={tableCell}>{candidate.studentEmail}</td>}
                      <td style={tableCell}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setCertificateForm((prev) => ({
                              ...prev,
                              studentName: candidate.studentName,
                              courseName: candidate.courseName,
                              issuedDate: candidate.issuedDate ? new Date(candidate.issuedDate).toISOString().slice(0, 10) : prev.issuedDate,
                              studentEmail: candidate.studentEmail,
                            }));
                            setMessage("Candidate selected. Edit details and click Create Certificate.");
                            setError("");
                          }}
                          style={{ ...buttonStyle, backgroundColor: "#2563eb", padding: "0.65rem 1rem" }}
                        >
                          Select Candidate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...sectionCardStyle, padding: "1.5rem" }}>
          <h3 style={sectionHeadingStyle}>Certificate Preview</h3>
          <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem", padding: "1rem", borderRadius: "1.5rem", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
              Enter or edit the certificate details here to update the preview before issuing.
            </p>
            {selectedCandidate && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.75rem 1rem", borderRadius: "1rem", background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd" }}>
                <strong>Selected Candidate</strong>
                <span>{selectedCandidate.studentName} • {selectedCandidate.courseName}</span>
                <span>{selectedCandidate.studentEmail}</span>
              </div>
            )}
            {!selectedCandidate && (
              <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.85rem 1rem", borderRadius: "1rem", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155" }}>
                  <strong style={{ display: "block", marginBottom: "0.25rem", color: "#0f172a" }}>Admin manual issuance</strong>
                  Use this section when the student and course are already known but the candidate does not appear in the eligible completion list yet. This is an admin-only fallback for exceptional issuance.
                </div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", color: "#475569" }}>Select student for manual issuance</label>
                  <select
                    value={selectedManualStudentId}
                    onChange={(event) => {
                      const studentId = event.target.value;
                      setSelectedCandidate(null);
                      setSelectedManualStudentId(studentId);
                      const student = users.find((user) => user._id === studentId);
                      if (student) {
                        setCertificateForm((prev) => ({
                          ...prev,
                          studentName: student.name || prev.studentName,
                          studentEmail: student.email || prev.studentEmail,
                        }));
                      }
                    }}
                    style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                  >
                    <option value="">Choose a student...</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} {user.email ? `(${user.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", color: "#475569" }}>Select course for manual issuance</label>
                  <select
                    value={selectedManualCourseId}
                    onChange={(event) => {
                      const courseId = event.target.value;
                      setSelectedCandidate(null);
                      setSelectedManualCourseId(courseId);
                      const course = courses.find((courseItem) => courseItem._id === courseId);
                      if (course) {
                        setCertificateForm((prev) => ({
                          ...prev,
                          courseName: course.title || prev.courseName,
                        }));
                      }
                    }}
                    style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                  >
                    <option value="">Choose a course...</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#475569" }}>
                Student Name
                <input
                  type="text"
                  value={certificateForm.studentName}
                  onChange={(event) => updateCertificateForm("studentName", event.target.value)}
                  style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#475569" }}>
                Course Name
                <input
                  type="text"
                  value={certificateForm.courseName}
                  onChange={(event) => updateCertificateForm("courseName", event.target.value)}
                  style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#475569" }}>
                Issued Date
                <input
                  type="date"
                  value={certificateForm.issuedDate}
                  onChange={(event) => updateCertificateForm("issuedDate", event.target.value)}
                  style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#475569" }}>
                Student Email
                <input
                  type="email"
                  value={certificateForm.studentEmail}
                  onChange={(event) => updateCertificateForm("studentEmail", event.target.value)}
                  style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#475569" }}>
                QR Verification Details
                <textarea
                  rows={3}
                  value={certificateForm.qrDetails}
                  onChange={(event) => updateCertificateForm("qrDetails", event.target.value)}
                  style={{ width: "100%", borderRadius: "0.85rem", border: "1px solid #cbd5e1", padding: "0.85rem", fontSize: "0.95rem", resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.85rem 1rem", borderRadius: "1rem", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div>
                  <strong style={{ display: "block", color: "#0f172a" }}>QR Code on Certificate</strong>
                  <span style={{ color: "#475569", fontSize: "0.9rem" }}>Turn this on to show the QR verification code on the issued certificate.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQrEnabled((prev) => !prev)}
                  style={{ border: "none", borderRadius: "999px", padding: "0.45rem 0.75rem", background: qrEnabled ? "#0f172a" : "#cbd5e1", color: qrEnabled ? "#fff" : "#334155", fontWeight: 700, cursor: "pointer" }}
                >
                  {qrEnabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              {!selectedCandidate ? (
                <div style={{ padding: "0.85rem 1rem", borderRadius: "1rem", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155" }}>
                  {eligible.length > 0
                    ? "Select a completed student from the list above or use the manual issuance fields below."
                    : "No eligible course completions found yet. Use manual issuance below if the student and course are already available."}
                </div>
              ) : (
                <div style={{ padding: "0.85rem 1rem", borderRadius: "1rem", backgroundColor: "#e0f2fe", border: "1px solid #bae6fd", color: "#0c4a6e" }}>
                  Selected candidate: {selectedCandidate.studentName} for {selectedCandidate.courseName}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.25rem" }}>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  if (!canCreateCertificate) {
                    setError("Choose a completed candidate or both a student and course for manual issuance.");
                    return;
                  }
                  const requestPayload = selectedCandidate
                    ? selectedCandidate
                    : {
                        studentId: selectedManualStudent?._id || selectedManualStudentId,
                        courseId: selectedManualCourse?._id || selectedManualCourseId,
                        studentName: certificateForm.studentName,
                        courseName: certificateForm.courseName,
                        studentEmail: certificateForm.studentEmail,
                      };
                  issueCertificate(requestPayload, !selectedCandidate);
                }}
                disabled={!canCreateCertificate}
                title={
                  canCreateCertificate
                    ? "Create the certificate for the selected candidate or manual student/course pair."
                    : "Select a candidate or choose a student and course to enable certificate creation."
                }
                style={{
                  ...buttonStyle,
                  backgroundColor: "#0f172a",
                  padding: "0.85rem 1.25rem",
                  opacity: canCreateCertificate ? 1 : 0.6,
                  cursor: canCreateCertificate ? "pointer" : "not-allowed",
                }}
              >
                Create Certificate
              </button>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f8fbff 50%, #eef2ff 100%)", borderRadius: "2rem", padding: "1.25rem", position: "relative", minHeight: "780px", overflow: "hidden", border: "2px solid #0f172a", boxShadow: "0 26px 60px rgba(15, 23, 42, 0.16)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "2rem", padding: "1.5rem", boxSizing: "border-box", background: "linear-gradient(180deg, rgba(15, 23, 42, 0.08), transparent 30%, transparent 70%, rgba(15, 23, 42, 0.08))" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "10px", background: "linear-gradient(90deg, #1e3a8a, #2563eb, #1e3a8a)" }} />
            <div style={{ position: "relative", zIndex: 1, background: "#ffffff", borderRadius: "1.75rem", padding: "2rem", minHeight: "730px", boxShadow: "0 30px 80px rgba(15, 23, 42, 0.12)", border: "8px solid #0b2e83", outline: "2px solid #d4af37", outlineOffset: "4px" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #1e40af, #2563eb)", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 18px 40px rgba(37, 99, 235, 0.28)" }}>
                  <img src={heroLogo} alt="ESNEX logo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.25em", fontSize: "0.8rem", fontFamily: '"Playfair Display", Georgia, serif' }}>ESNEX TECHNOLOGIES</p>
                  <p style={{ margin: "0.65rem 0 0", color: "#334155", fontSize: "0.85rem", fontFamily: '"Poppins", Arial, sans-serif' }}>INNOVATE • DEVELOP • TRANSFORM</p>
                </div>
              </div>

              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: '"Poppins", Arial, sans-serif' }}>OF COMPLETION</p>
                <h2 style={{ margin: "0.5rem 0 0", fontSize: "3rem", letterSpacing: "0.15em", color: "#0f172a", fontFamily: '"Playfair Display", Georgia, serif' }}>CERTIFICATE</h2>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                  <span style={{ padding: "0.35rem 0.6rem", borderRadius: "999px", background: "linear-gradient(135deg, #0b2e83, #1e73e8)", color: "#fff", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 800 }}>Official ESNEX Training</span>
                </div>
              </div>

              <div style={{ marginTop: "2rem", textAlign: "center", padding: "0 1rem" }}>
                <p style={{ margin: 0, color: "#475569", fontSize: "1rem" }}>This is to certify that</p>
                <p style={{ margin: "0.85rem 0 0", color: "#0b2e83", fontSize: "2.35rem", fontWeight: 700, fontFamily: '"Cormorant Garamond", Georgia, serif', textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}>{previewData.studentName}</p>
                {previewData.studentEmail && (
                  <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>{previewData.studentEmail}</p>
                )}
                <p style={{ margin: "1rem 0 0", color: "#475569", fontSize: "1rem" }}>has successfully completed</p>
                <p style={{ margin: "0.85rem 0 0", color: "#1e73e8", fontSize: "1.75rem", fontWeight: 700, fontFamily: '"Poppins", Arial, sans-serif' }}>{previewData.courseName}</p>
                <p style={{ margin: "1rem 0 0", color: "#475569", fontSize: "0.95rem" }}>under the training program conducted by</p>
                <p style={{ margin: "0.45rem 0 0", color: "#0f172a", fontSize: "1rem", fontWeight: 700 }}>ESNEX TECHNOLOGIES</p>
                <div style={{ display: "grid", justifyItems: "center", gap: "0.35rem", marginTop: "1rem" }}>
                  <div style={{ width: "96px", height: "96px", borderRadius: "999px", border: "4px solid #d4af37", background: "radial-gradient(circle at 30% 30%, #fff9e6 0%, #f5d97a 45%, #d4af37 100%)", color: "#0b2e83", display: "grid", placeItems: "center", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "0 18px 40px rgba(212,175,55,0.25)" }}>
                    <strong style={{ display: "block", fontSize: "0.72rem" }}>Verified</strong>
                    Certificate
                  </div>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.18em" }}>Gold Verification Seal</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: "1.5rem", alignItems: "flex-end", marginTop: "2rem" }}>
                <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "center" }}>
                    <div style={{ width: "68px", height: "68px", borderRadius: "1rem", background: "#e0e7ff", display: "grid", placeItems: "center", color: "#1d4ed8" }}>
                      📅
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Date Issued</p>
                      <p style={{ margin: "0.3rem 0 0", color: "#0f172a", fontWeight: 700 }}>{formatDate(previewData.issuedDate)}</p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "center" }}>
                    <div style={{ width: "68px", height: "68px", borderRadius: "1rem", background: "#e0e7ff", display: "grid", placeItems: "center", color: "#1d4ed8" }}>
                      🆔
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Certificate ID</p>
                      <p style={{ margin: "0.3rem 0 0", color: "#0f172a", fontWeight: 700 }}>{previewData.certificateId}</p>
                    </div>
                  </div>
                </div>
                {qrEnabled && (
                  <div style={{ display: "grid", placeItems: "center", padding: "1rem", background: "#f8fafc", borderRadius: "1.5rem", border: "1px solid #c7d2fe" }}>
                    <img src={getQrCodeUrl(qrPayloadText)} alt="Certificate QR Code" style={{ width: "110px", height: "110px", borderRadius: "1rem" }} />
                    <p style={{ margin: "0.75rem 0 0", color: "#475569", fontSize: "0.85rem", fontWeight: 700 }}>Scan to verify</p>
                    <p style={{ margin: "0.5rem 0 0", color: "#475569", fontSize: "0.8rem", textAlign: "center" }}>{previewData.qrDetails}</p>
                    <p style={{ margin: "0.5rem 0 0", color: "#0f172a", fontSize: "0.75rem", textAlign: "center", wordBreak: "break-all" }}>{previewData.verificationUrl}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...sectionCardStyle }}>
        <h3 style={sectionHeadingStyle}>Issued Certificates</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <th style={tableHeader}>Certificate ID</th>
                <th style={tableHeader}>Student</th>
                <th style={tableHeader}>Course</th>
                <th style={tableHeader}>Issued</th>
                <th style={tableHeader}>Status</th>
                <th style={tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={tableCell}>Loading certificates…</td>
                </tr>
              ) : filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={6} style={tableCell}>No certificates issued yet.</td>
                </tr>
              ) : (
                filteredCertificates.map((certificate) => (
                  <tr key={certificate._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                    <td style={tableCell}>{certificate.certificateId}</td>
                    <td style={tableCell}>{certificate.studentName}</td>
                    <td style={tableCell}>{certificate.courseName}</td>
                    <td style={tableCell}>{formatDate(certificate.issuedDate)}</td>
                    <td style={tableCell}>{certificate.status}</td>
                    <td style={tableCell}>
                      <button
                        type="button"
                        onClick={() => setSelectedCertificate(certificate)}
                        style={{ ...buttonStyle, padding: "0.55rem 0.9rem", backgroundColor: "#2563eb" }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeCertificate(certificate._id)}
                        style={{ ...deleteButtonStyle, marginLeft: "0.75rem" }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
