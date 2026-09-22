const { getModel } = require("../config/adapter");

const getUser = () => getModel("User");
const getCourse = () => getModel("Course");
const getEnrollment = () => getModel("Enrollment");
const getCertificate = () => getModel("Certificate");

const getFrontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

const isValidIdentifier = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const generateCertificateId = async () => {
  const Certificate = getCertificate();
  const base = `CERT-${new Date().getFullYear()}-`;
  let sequence = (await Certificate.countDocuments()) + 1;
  let certificateId = `${base}${String(sequence).padStart(4, "0")}`;

  while (await Certificate.findOne({ certificateId })) {
    sequence += 1;
    certificateId = `${base}${String(sequence).padStart(4, "0")}`;
  }

  return certificateId;
};

exports.issueCertificate = async (req, res) => {
  try {
    const {
      studentId,
      courseId,
      note,
      qrDetails,
      studentName: providedStudentName,
      courseName: providedCourseName,
      issuedDate: providedIssuedDate,
      studentEmail: providedStudentEmail,
      manualIssuance: manualIssuanceRaw,
    } = req.body;

    const manualIssuance =
      manualIssuanceRaw === true ||
      manualIssuanceRaw === "true" ||
      manualIssuanceRaw === 1 ||
      manualIssuanceRaw === "1" ||
      (req.user && (req.user.roleString === "admin" || (req.user.role && String(req.user.role).toLowerCase().includes("admin"))));

    console.log("Certificate issue request:", {
      studentId,
      courseId,
      manualIssuance,
      studentName: providedStudentName,
      courseName: providedCourseName,
      studentEmail: providedStudentEmail,
    });

    if (!studentId || !courseId) {
      return res.status(400).json({ message: "Student and course are required" });
    }

    if (!isValidIdentifier(studentId) || !isValidIdentifier(courseId)) {
      return res.status(400).json({ message: "Invalid student or course ID" });
    }

    const User = getUser();
    const Course = getCourse();
    const Enrollment = getEnrollment();
    const Certificate = getCertificate();

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.certificateEnabled === false && !manualIssuance) {
      return res.status(400).json({ message: "Certificates are not enabled for this course" });
    }

    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });

    if (!enrollment && !manualIssuance) {
      return res.status(404).json({ message: "Course enrollment not found for this student" });
    }

    if (enrollment) {
      const progress = enrollment.progress && typeof enrollment.progress.percentage === "number" ? enrollment.progress.percentage : 0;
      if (progress < 100 && !manualIssuance) {
        return res.status(400).json({ message: "Student has not yet completed the course" });
      }
    }

    const existingCertificate = await Certificate.findOne({ student: studentId, course: courseId });
    if (existingCertificate) {
      return res.status(409).json({ message: "Certificate already issued for this student and course" });
    }

    const issuedByUser = await User.findById(req.user.id);
    const issuedByName = issuedByUser?.name || "ESNEX Admin";
    const certificateId = await generateCertificateId();
    const issuedDate = new Date();
    const verificationUrl = `${getFrontendUrl()}/verify-certificate/${certificateId}`;
    const finalStudentName = providedStudentName || student.name;
    const finalCourseName = providedCourseName || course.title;
    const finalIssuedDate = providedIssuedDate ? new Date(providedIssuedDate) : issuedDate;
    const finalStudentEmail = providedStudentEmail || student.email;

    const generatedQrDetails = [
      "ESNEX TECHNOLOGIES CERTIFICATE",
      "",
      `Certificate ID: ${certificateId}`,
      `Student: ${finalStudentName}`,
      `Course: ${finalCourseName}`,
      `Issued Date: ${finalIssuedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      "Status: Valid",
      "",
      `Verification: ${verificationUrl}`,
    ].join("\n");

    const verificationData = {
      certificateId,
      studentName: finalStudentName,
      course: finalCourseName,
      issueDate: finalIssuedDate.toISOString().split("T")[0],
      status: "Valid",
      verificationUrl,
      qrDetails: qrDetails || generatedQrDetails,
    };

    const certificate = await Certificate.create({
      certificateId,
      student: student._id,
      studentName: finalStudentName,
      studentEmail: finalStudentEmail,
      course: course._id,
      courseName: finalCourseName,
      issuedBy: issuedByUser?._id || null,
      issuedByName,
      issuedDate: finalIssuedDate,
      status: "Valid",
      template: "Premium Corporate",
      verificationData,
      note: note || "",
    });

    res.status(201).json({ certificate });
  } catch (err) {
    console.error("Issue certificate error:", err);
    res.status(500).json({ message: "Server error issuing certificate" });
  }
};

exports.listCertificates = async (req, res) => {
  try {
    const Certificate = getCertificate();
    const certificates = await Certificate.find().sort({ issuedDate: -1 });
    res.json({ certificates });
  } catch (err) {
    console.error("List certificates error:", err);
    res.status(500).json({ message: "Server error listing certificates" });
  }
};

exports.getCertificateById = async (req, res) => {
  try {
    const Certificate = getCertificate();
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    res.json({ certificate });
  } catch (err) {
    console.error("Get certificate error:", err);
    res.status(500).json({ message: "Server error fetching certificate" });
  }
};

exports.revokeCertificate = async (req, res) => {
  try {
    const Certificate = getCertificate();
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    certificate.status = "Revoked";
    certificate.verificationData = {
      ...certificate.verificationData,
      status: "Revoked",
    };
    await certificate.save();
    res.json({ certificate });
  } catch (err) {
    console.error("Revoke certificate error:", err);
    res.status(500).json({ message: "Server error revoking certificate" });
  }
};

exports.getEligibleIssuance = async (req, res) => {
  try {
    const Enrollment = getEnrollment();
    const Certificate = getCertificate();

    const enrollments = await Enrollment.find({ "progress.percentage": { $gte: 100 } })
      .populate("student", "name email")
      .populate("course", "title certificateEnabled");

    const eligible = [];
    for (const enrollment of enrollments) {
      if (!enrollment.course) {
        continue;
      }
      const alreadyIssued = await Certificate.findOne({ student: enrollment.student._id, course: enrollment.course._id });
      if (alreadyIssued) {
        continue;
      }
      eligible.push({
        enrollmentId: enrollment._id,
        studentId: enrollment.student._id,
        studentName: enrollment.student.name,
        studentEmail: enrollment.student.email,
        courseId: enrollment.course._id,
        courseName: enrollment.course.title,
        issuedDate: enrollment.updatedAt || enrollment.createdAt,
      });
    }

    res.json({ eligible });
  } catch (err) {
    console.error("Eligible certificates error:", err);
    res.status(500).json({ message: "Server error checking eligible certificates" });
  }
};

exports.verifyCertificate = async (req, res) => {
  try {
    const Certificate = getCertificate();
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId });
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    res.json({ certificate });
  } catch (err) {
    console.error("Verify certificate error:", err);
    res.status(500).json({ message: "Server error verifying certificate" });
  }
};

exports.getMyCertificates = async (req, res) => {
  try {
    const Certificate = getCertificate();
    const certificates = await Certificate.find({ student: req.user.id }).sort({ issuedDate: -1 });
    res.json({ certificates });
  } catch (err) {
    console.error("Get my certificates error:", err);
    res.status(500).json({ message: "Server error fetching your certificates" });
  }
};
