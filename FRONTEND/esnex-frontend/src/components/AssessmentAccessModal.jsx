import { useState, useEffect } from "react";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function AssessmentAccessModal({ quiz, assessment, assessmentId, isOpen, onClose, onSuccess, onPaymentSuccess }) {
  // Only render modal if isOpen is true
  if (!isOpen) return null;

  const onComplete = onPaymentSuccess || onSuccess;
  const entity = quiz || assessment;
  const price = entity?.price ?? 10;
  const subscription = entity?.subscription || "monthly";
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "cardNumber") {
      const cleaned = value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
      setFormData((prev) => ({ ...prev, [name]: cleaned }));
    } else if (name === "expiryDate") {
      const cleaned = value.replace(/\D/g, "").replace(/(\d{2})(?=\d)/, "$1/");
      setFormData((prev) => ({ ...prev, [name]: cleaned }));
    } else if (name === "cvv") {
      const cleaned = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [name]: cleaned }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validatePayment = () => {
    if (!formData.fullName.trim()) {
      toast.error("Full name is required");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    }

    if (paymentMethod === "card") {
      const cleanCardNumber = formData.cardNumber.replace(/\s/g, "");
      if (!cleanCardNumber || cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
        toast.error("Please enter a valid card number");
        return false;
      }

      if (!formData.expiryDate || formData.expiryDate.length !== 5) {
        toast.error("Please enter a valid expiry date (MM/YY)");
        return false;
      }

      if (!formData.cvv || formData.cvv.length < 3 || formData.cvv.length > 4) {
        toast.error("Please enter a valid CVV");
        return false;
      }
    }

    return true;
  };

  const handlePayment = async (e) => {
    e.preventDefault();

    const token = sessionStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to make payment and access assessments");
      // Redirect to login page
      window.location.href = "/login";
      return;
    }

    if (!validatePayment()) return;

    setLoading(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const productId = assessmentId || entity?._id || entity?.id;
      let productType = "assessment";
      if (entity?.type === "course") {
        productType = "course";
      } else if (quiz || assessment) {
        productType = "assessment";
      }

      if (!productId) {
        throw new Error("Product ID missing for payment");
      }

      const payload = {
        productType,
        productId,
        amount: price,
        currency: "USD",
        email: formData.email,
        firstName: formData.fullName.split(" ")[0] || "",
        lastName: formData.fullName.split(" ").slice(1).join(" ") || "",
        paymentSource: "Modem Pay",
        paymentMethod: paymentMethod === "card" ? "Modem Pay" : paymentMethod === "bank" ? "Bank Transfer" : "Mobile Money",
      };
      const endpoint = "/payments/initiate";
      const token = sessionStorage.getItem("token");
      console.debug("[AssessmentAccessModal] initiating payment", {
        endpoint,
        baseURL: API.defaults.baseURL,
        tokenPresent: Boolean(token),
        tokenPreview: token ? `${token.slice(0, 8)}...` : null,
        payload,
      });

      const initRes = await API.post(endpoint, payload);
      const session = initRes.data?.data;

      if (!session?.paymentId) {
        throw new Error("Unable to initiate payment session");
      }

      if (!session?.paymentUrl) {
        throw new Error("Payment provider did not return a redirect URL");
      }

      // PaymentReturn uses this only to restore the correct product route; the
      // backend remains the source of truth for whether access was granted.
      try {
        window.localStorage.setItem("lastPaymentSession", JSON.stringify({
          ...session,
          productType,
          productId,
        }));
      } catch (storageError) {
        console.warn("Unable to save payment return context", storageError);
      }
      window.location.href = session.paymentUrl;
      return;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-access-overlay" onClick={onClose}>
      <div className="assessment-access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="assessment-access-header">
          <h2>Assessment Access Required</h2>
          <button
            type="button"
            className="assessment-access-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="assessment-access-content">
          <div className="access-info">
            <div className="info-icon">🔐</div>
            <h3>{entity?.title || entity?.name || "Assessment Access"}</h3>
            <p>You need assessment access to take this quiz.</p>
            <p className="info-highlight">Get <strong>D{price}/{subscription}</strong> assessment access</p>

            <div className="access-benefits">
              <div className="benefit-item">✓ Access to all course assessments</div>
              <div className="benefit-item">✓ Valid for 30 days</div>
              <div className="benefit-item">✓ Unlimited attempts</div>
              <div className="benefit-item">✓ Monthly subscription</div>
            </div>
              <div className="subscription-info" style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "12px",
                marginTop: "16px",
                fontSize: "13px",
                color: "#1e40af"
              }}>
                <strong>📅 Subscription Details:</strong>
                <div>• Valid from today until {new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                <div>• Take assessments unlimited times during this period</div>
                <div>• After 30 days, renew to maintain access</div>
              </div>
          </div>

          <form onSubmit={handlePayment} className="assessment-payment-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="form-select"
              >
                <option value="card">💳 Card Payment</option>
                <option value="bank">🏦 Bank Transfer</option>
                <option value="mobile">📱 Mobile Money</option>
              </select>
            </div>

            {paymentMethod === "card" && (
              <>
                <div className="form-group">
                  <label>Card Number</label>
                  <input
                    type="text"
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    placeholder="1234 5678 9012 3456"
                    maxLength="19"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      type="text"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      placeholder="MM/YY"
                      maxLength="5"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      placeholder="123"
                      maxLength="4"
                      required
                    />
                  </div>
                </div>

                <div className="test-card-info">
                  <p>Test card: <strong>4111 1111 1111 1111</strong></p>
                  <p>Expiry: <strong>12/30</strong> | CVV: <strong>123</strong></p>
                </div>
              </>
            )}

            <div className="amount-summary">
              <div className="amount-row">
                <span>{subscription === "monthly" ? "Monthly Assessment Access" : "Assessment Access"}</span>
                <strong>D{price}</strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="assessment-pay-btn"
            >
              {loading ? "🔄 Processing..." : `✓ Enroll for D${price}/${subscription}`}
            </button>

            <p className="security-note">
              ✓ Your payment information is secure and encrypted.
            </p>
          </form>
        </div>
      </div>

      <style>{`
        .assessment-access-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .assessment-access-modal {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .assessment-access-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem;
          background: linear-gradient(135deg, #001f5c 0%, #003da5 100%);
          color: white;
          border-radius: 1rem 1rem 0 0;
        }

        .assessment-access-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .assessment-access-close {
          background: none;
          border: none;
          color: white;
          font-size: 2rem;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .assessment-access-content {
          padding: 2rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 768px) {
          .assessment-access-content {
            grid-template-columns: 1fr;
          }
        }

        .access-info {
          text-align: center;
        }

        .info-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .access-info h3 {
          margin: 1rem 0 0.5rem 0;
          color: #001f5c;
          font-size: 1.3rem;
        }

        .access-info p {
          color: #666;
          margin: 0.5rem 0;
          font-size: 0.95rem;
        }

        .info-highlight {
          background: #f0f4ff;
          padding: 1rem;
          border-radius: 0.75rem;
          border-left: 4px solid #001f5c;
          font-weight: 600;
          margin: 1.5rem 0;
        }

        .access-benefits {
          text-align: left;
          background: #f9f9f9;
          padding: 1rem;
          border-radius: 0.75rem;
          margin-top: 1rem;
        }

        .benefit-item {
          padding: 0.5rem 0;
          color: #333;
          font-size: 0.9rem;
        }

        .assessment-payment-form {
          display: grid;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-select {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 0.5rem;
          font-size: 0.95rem;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-select:focus {
          outline: none;
          border-color: #001f5c;
          box-shadow: 0 0 0 3px rgba(0, 31, 92, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .test-card-info {
          background: #fff3cd;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border-left: 3px solid #ffc107;
          font-size: 0.85rem;
          margin: 0.5rem 0;
        }

        .test-card-info p {
          margin: 0.25rem 0;
          color: #856404;
        }

        .amount-summary {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 0.5rem;
          text-align: center;
        }

        .amount-row {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          color: #333;
        }

        .amount-row strong {
          color: #001f5c;
          font-size: 1.2rem;
        }

        .assessment-pay-btn {
          background: linear-gradient(135deg, #001f5c 0%, #003da5 100%);
          color: white;
          padding: 1rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .assessment-pay-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 31, 92, 0.2);
        }

        .assessment-pay-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .security-note {
          text-align: center;
          font-size: 0.85rem;
          color: #666;
          margin: 0.5rem 0 0 0;
        }
      `}</style>
    </div>
  );
}
