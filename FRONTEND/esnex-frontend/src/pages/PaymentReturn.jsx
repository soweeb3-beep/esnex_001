import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function PaymentReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentId = params.get("paymentId") || params.get("reference");
    const transactionId = params.get("transaction_id") || params.get("transactionId") || params.get("gateway_reference") || paymentId;
    const paymentStatus = params.get("status") || "completed";
    const lastSessionRaw = window.localStorage.getItem("lastPaymentSession");
    const lastSession = lastSessionRaw ? JSON.parse(lastSessionRaw) : null;

    if (!paymentId && !transactionId) {
      toast.error("Invalid payment return URL");
      navigate("/dashboard");
      return;
    }

    let cancelled = false;

    const completeAccess = async (verifiedPayment) => {
      setStatus("completed");
      toast.success("Payment verified. Access granted.");
      try {
        const payment = verifiedPayment?.data || verifiedPayment || {};
        const productType = payment.productType || lastSession?.productType || lastSession?.data?.productType;
        const productId = payment.productId || lastSession?.productId || lastSession?.data?.productId;

        if (productType === "assessment") {
          // Refresh the authoritative enrollment state before presenting the
          // assessment. This also updates other open assessment pages.
          const enrolledResponse = await API.get("/assessments/enrolled");
          const enrolled = enrolledResponse.data?.assessments || [];
          window.localStorage.setItem("assessmentEnrollments", JSON.stringify(enrolled));
          const hasAccess = enrolled.some((item) => String(item?._id || item?.assessmentId || item?.id || "") === String(productId || ""));
          if (!hasAccess) {
            throw new Error("Payment was verified but assessment access is not active yet.");
          }
          navigate(`/assessment/${productId}`);
        } else if (productType === "course") {
          navigate("/dashboard");
        } else {
          navigate("/dashboard");
        }
      } catch (e) {
        navigate("/dashboard");
      }
    };

    const poll = async () => {
      setStatus("polling");
      const maxAttempts = 20;
      let attempt = 0;
      while (attempt < maxAttempts && !cancelled) {
        try {
          const histRes = await API.get("/payments/history");
          const payments = histRes.data?.data || histRes.data || [];
          const match = payments.find((p) => p.paymentId === paymentId || p.paymentId === transactionId || p.transactionId === transactionId || p.paymentReference === paymentId);

          if (match && match.status === "completed" && match.verificationStatus === "verified") {
            await completeAccess(match);
            return;
          }

          const verifyRes = await API.post("/payments/verify", {
            paymentId: paymentId || undefined,
            transactionId: transactionId || paymentId || undefined,
            gatewayReference: params.get("gateway_reference") || transactionId || paymentId || undefined,
            status: paymentStatus,
            paymentSource: "Modem Pay",
            paymentMethod: "Modem Pay",
          });

          if (verifyRes?.data?.success) {
            await completeAccess(verifyRes.data?.data || verifyRes.data);
            return;
          }
        } catch (err) {
          console.warn("PaymentReturn poll error", err.message || err);
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempt += 1;
      }
      if (!cancelled) {
        setStatus("timeout");
        toast.error("Unable to confirm payment yet. Please check your payments page later.");
        navigate("/payments");
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Processing Payment Return</h2>
      <p>Status: {status}</p>
      <p>Please wait while we confirm your payment. You will be redirected automatically.</p>
    </div>
  );
}
