import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import "../styles/payment-page.css";

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const [course, setCourse] = useState(null);
  const [accessType, setAccessType] = useState("full");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [formData, setFormData] = useState({ fullName: "", email: "" });
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [paymentSession, setPaymentSession] = useState(null);

  useEffect(() => {
    const courseData = location.state?.course;
    const access = location.state?.accessType;
    const email = location.state?.email || "";
    const routeAccessType = location.pathname.startsWith("/assessment-payment") ? "assessment" : "full";

    if (courseData) {
      setCourse(courseData);
      setAccessType(access || routeAccessType);
      setFormData((prev) => ({ ...prev, email }));
      return;
    }

    if (!productId) {
      toast.error("Payment product not found.");
      navigate("/courses");
      return;
    }

    const loadProduct = async () => {
      setLoadingProduct(true);
      let foundProduct = null;
      let inferredAccess = "full";

      const extractProduct = (response) => {
        const payload = response?.data;
        return payload?.data || payload?.assessment || payload?.course || payload || null;
      };

      try {
        const res = await API.get(`/courses/${productId}`);
        const product = extractProduct(res);
        if (product) {
          foundProduct = product;
          inferredAccess = "full";
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("Course fetch error:", err);
        }
      }

      if (!foundProduct) {
        try {
          const res = await API.get(`/assessments/${productId}`);
          const product = extractProduct(res);
          if (product) {
            foundProduct = product;
            inferredAccess = "assessment";
          }
        } catch (err) {
          if (err.response?.status !== 404) {
            console.error("Assessment fetch error:", err);
          }
        }
      }

      if (!foundProduct) {
        toast.error("Payment product not found.");
        navigate("/courses");
      } else {
        setCourse(foundProduct);
        setAccessType(location.state?.accessType || inferredAccess);
        setFormData((prev) => ({ ...prev, email }));
      }
      setLoadingProduct(false);
    };

    loadProduct();
  }, [location, navigate, productId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    return true;
  };

  const handlePayment = async (e) => {
    e.preventDefault();

    const token = sessionStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to complete payment");
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    if (!validatePayment()) return;

    setLoading(true);
    try {
      const resolvedProductId = course?._id || course?.id;
      const payload = {
        productType: accessType === "assessment" ? "assessment" : "course",
        productId: resolvedProductId,
        amount: Number((course?.price ?? basePrice ?? 0) + transactionFee),
        currency: course?.currency || "GMD",
        email: formData.email,
        firstName: formData.fullName.split(" ")[0] || "",
        lastName: formData.fullName.split(" ").slice(1).join(" ") || "",
        paymentSource: "Modem Pay",
        paymentMethod: paymentMethod === "card" ? "Modem Pay" : paymentMethod === "bank" ? "Bank Transfer" : "Other",
      };
      const endpoint = "/payments/initiate";
      const token = sessionStorage.getItem("token");

      console.debug("[Payment] initiating payment", {
        endpoint,
        baseURL: API.defaults.baseURL,
        tokenPresent: Boolean(token),
        tokenPreview: token ? `${token.slice(0, 8)}...` : null,
        payload,
      });

      const res = await API.post(endpoint, payload);
      const session = res.data?.data;

      if (!session?.paymentId) {
        throw new Error("Unable to initiate payment session");
      }


      // If the initiate response contains a hosted payment URL, redirect the browser there.
      if (session?.paymentUrl) {
        // Persist a little state so we can show a friendly message if user returns
        try {
          window.localStorage.setItem('lastPaymentSession', JSON.stringify({
            ...session,
            productType: payload.productType,
            productId: resolvedProductId,
          }));
        } catch (e) {}
        window.location.href = session.paymentUrl;
        return;
      }

      if (!session?.paymentUrl) {
        throw new Error('Payment provider did not return a redirect URL');
      }

      // Wait for backend enrollment to be queryable, polling a few times before navigating
      try {
        if (accessType === "assessment") {
          const expectedId = course?._id || course?.id || null;
          const maxAttempts = 10; // ~5s total with 500ms interval
          let attempt = 0;
          let matched = false;
          while (attempt < maxAttempts && !matched) {
            try {
              const enrolledRes = await API.get("/assessments/enrolled");
              const enrolled = enrolledRes.data?.assessments || enrolledRes.data || [];
              try { window.localStorage.setItem("assessmentEnrollments", JSON.stringify(enrolled)); } catch (e) {}
              if (expectedId) {
                matched = enrolled.some((item) => {
                  const idCandidate = item._id || item.assessmentId || item.id || null;
                  return idCandidate && String(idCandidate) === String(expectedId);
                });
              } else {
                matched = enrolled.length > 0;
              }
              if (matched) break;
            } catch (e) {
              console.warn("enrolled check failed", e);
            }
            await new Promise((r) => setTimeout(r, 500));
            attempt += 1;
          }
          navigate(successRedirectPath);
          return;
        }
      } catch (e) {
        console.warn("Post-payment enrollment polling failed", e);
      }
    } catch (err) {
      console.error("[Payment] initiate error", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      toast.error(err.response?.data?.message || err.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return <div className="payment-loading">Loading payment details...</div>;
  }

  if (!course) {
    return <div className="payment-loading">Payment product not found.</div>;
  }

  const accessLabel = accessType === "assessment" ? "Assessment Access" : "Course Enrollment";
  const basePrice = Number(course?.price ?? 0);
  const transactionFee = Math.max(1, Math.ceil(basePrice * 0.01));
  const total = basePrice + transactionFee;
  const successRedirectPath = accessType === "assessment" && (course?._id || course?.id)
    ? `/assessment/${course._id || course.id}`
    : "/dashboard";
  const successButtonLabel = successRedirectPath.startsWith("/assessment/") ? "Go to Assessment" : "Go to Dashboard";

  if (paymentProcessed) {
    return (
      <div className="payment-success-page">
        <div className="payment-success-container">
          <div className="success-icon">✓</div>
          <h1>Payment Successful!</h1>
          <p className="payment-success-subtitle">{accessType === "assessment" ? "Assessment unlocked" : "Enrollment completed"}</p>
          <p>You have been successfully enrolled in</p>
          <p><strong>{course.title}</strong></p>
          <div className="success-details">
            <div className="success-detail-row">
              <span>Access Type:</span>
              <strong>{accessLabel}</strong>
            </div>
            <div className="success-detail-row">
              <span>Amount:</span>
              <strong>D{total.toLocaleString()}</strong>
            </div>
            {paymentSession?.paymentId && (
              <div className="success-detail-row">
                <span>Payment ID:</span>
                <strong>{paymentSession.paymentId}</strong>
              </div>
            )}
            {paymentSession?.paymentUrl && (
              <div className="success-detail-row">
                <span>Gateway:</span>
                <a href={paymentSession.paymentUrl} target="_blank" rel="noreferrer" className="payment-link">
                  Complete payment
                </a>
              </div>
            )}
          </div>
          <button
            className="payment-success-btn"
            onClick={() => navigate(successRedirectPath)}
          >
            {successButtonLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        {/* Header */}
        <div className="payment-header">
          {/* Modem Pay Illustration - Feature 1 */}
          <div className="payment-wave-illustration">💳</div>
          
          <div className="payment-header-content">
            {/* Feature 3: Improved Top Header */}
            <h1>Secure Checkout</h1>
<p>Complete your payment securely with Modem Pay</p>
            
            {/* Trust Badges */}
            <div className="payment-trust-badges">
              <div className="trust-badge">Encrypted Payment</div>
              <div className="trust-badge">Instant Activation</div>
              <div className="trust-badge">Secure Access</div>
            </div>
          </div>
        </div>

        {/* Feature 2: 2-Column Layout */}
        <div className="payment-content">
          {/* LEFT SIDE - PAYMENT FORM */}
          <div className="payment-form-section">
            <div className="form-header">
              <div className="form-icon">💳</div>
              <div>
                <h2>Payment Details</h2>
                <p>Enter your information to complete the enrollment</p>
              </div>
            </div>

            <form onSubmit={handlePayment} className="payment-form">
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

              {/* Simplified: Hosted checkout will collect card details. Only collect full name and email here. */}

              {/* Feature 4: Improved amount display */}
              <div className="payment-amount">
                <label>Total Amount (Dalasis)</label>
                <input type="text" value={`D${total.toLocaleString()}`} disabled />
              </div>

              {/* Feature 5: Premium Payment Button */}
              <button
                type="submit"
                disabled={loading}
                className="payment-btn-primary"
              >
                <span>🔒</span>
                {loading ? "Processing..." : `Pay Securely → D${total}`}
              </button>

              {/* Feature 6: Payment Trust Section */}
              <div className="payment-trust-section">
                <div className="trust-item">
                  <div className="trust-item-icon">✓</div>
                  <div className="trust-item-text">Modem Pay Accepted</div>
                </div>
                <div className="trust-item">
                  <div className="trust-item-icon">⚡</div>
                  <div className="trust-item-text">Instant Verification</div>
                </div>
                <div className="trust-item">
                  <div className="trust-item-icon">🔐</div>
                  <div className="trust-item-text">Secure Transaction</div>
                </div>
                <div className="trust-item">
                  <div className="trust-item-icon">📞</div>
                  <div className="trust-item-text">24/7 Support</div>
                </div>
              </div>

              <p className="payment-security-text">
                Your payment information is encrypted and secure
              </p>

              <div className="payment-support">
                <p>Need help? <a href="mailto:esnexhelpdesk@gmail.com?subject=Payment%20support">Contact support</a></p>
              </div>
            </form>
          </div>

          {/* RIGHT SIDE - PAYMENT SUMMARY (Sticky) */}
          <div className="payment-summary-section">
            <div className="summary-header">
              <div className="summary-icon">📋</div>
              <h2>Order Summary</h2>
            </div>

            {/* Feature 2: Premium Summary Card with Sticky positioning */}
            <div className="payment-summary-card">
              <div className="summary-details">
                <div className="summary-row">
                  <span>Product</span>
                  <strong>{course.title || course.name || course.subject || "Product"}</strong>
                </div>

                <div className="summary-row">
                  <span>Price</span>
                  <strong>D{basePrice.toLocaleString()}</strong>
                </div>

                <div className="summary-row">
                  <span>Transaction Fee (1%)</span>
                  <strong>D{transactionFee.toLocaleString()}</strong>
                </div>

                <div className="summary-row total">
                  <span>Total Amount</span>
                  <strong>D{total.toLocaleString()}</strong>
                </div>
              </div>

              {/* Feature 2: Order Details */}
              <div className="summary-details-box">
                <div className="detail-item">
                  <div className="detail-icon">🔑</div>
                  <div>
                    <strong>Access Type</strong>
                    <p>{accessLabel}</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">🎯</div>
                  <div>
                    <strong>Payment Provider</strong>
                    <p>Modem Pay</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">📅</div>
                  <div>
                    <strong>Access Duration</strong>
                    <p>Monthly Access</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">✓</div>
                  <div>
                    <strong>What You Get</strong>
                    <p>Full course access • Assessments • Certificate • Progress tracking</p>
                  </div>
                </div>
              </div>

              {/* Feature 7: Payment Status */}
              <div className="payment-status">
                <div className="status-waiting">
                  <p>Ready for Payment</p>
                  <small>Complete the form to finalize your enrollment</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
