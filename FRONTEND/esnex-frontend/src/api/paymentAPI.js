import API from "./axios";

/**
 * Payment API Functions
 */

export const paymentAPI = {
  /**
   * Initiate a payment for course enrollment
   */
  initiatePayment: async (courseId, amount, email, firstName, lastName) => {
    try {
      const response = await API.post("/payments/initiate", {
        courseId,
        amount,
        email,
        firstName,
        lastName,
      });
      return response.data;
    } catch (error) {
      console.error("Payment initiation error:", error);
      throw error.response?.data || error;
    }
  },

  /**
   * Verify payment and complete enrollment
   */
  verifyPayment: async (paymentRef, enrollmentId) => {
    try {
      const response = await API.post("/payments/verify", {
        paymentRef,
        enrollmentId,
      });
      return response.data;
    } catch (error) {
      console.error("Payment verification error:", error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get user's payment history
   */
  getPaymentHistory: async () => {
    try {
      const response = await API.get("/payments/history");
      return response.data;
    } catch (error) {
      console.error("Payment history error:", error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get payment status for specific enrollment
   */
  getPaymentStatus: async (enrollmentId) => {
    try {
      const response = await API.get(`/payments/status/${enrollmentId}`);
      return response.data;
    } catch (error) {
      console.error("Payment status error:", error);
      throw error.response?.data || error;
    }
  },

  /**
   * Check if user has paid for a course
   */
  hasAccessToCourse: async (courseId) => {
    try {
      const response = await API.get(`/enrollments/status/${courseId}`);
      return response.data?.success && response.data?.data?.paymentStatus === "paid";
    } catch (error) {
      console.error("Access check error:", error);
      return false;
    }
  },
};

export default paymentAPI;
