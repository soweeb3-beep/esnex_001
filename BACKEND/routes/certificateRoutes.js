const express = require("express");
const router = express.Router();
const {
  listCertificates,
  getCertificateById,
  issueCertificate,
  revokeCertificate,
  getEligibleIssuance,
  verifyCertificate,
  getMyCertificates,
} = require("../controllers/certificateController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/eligible", protect, adminOnly, getEligibleIssuance);
router.get("/my", protect, getMyCertificates);
router.post("/", protect, adminOnly, issueCertificate);
router.patch("/:id/revoke", protect, adminOnly, revokeCertificate);
router.get("/verify/:certificateId", verifyCertificate);
router.get("/:id", protect, adminOnly, getCertificateById);
router.get("/", protect, adminOnly, listCertificates);

module.exports = router;
