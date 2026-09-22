/**
 * Subscription Helper Utilities
 * Handles subscription expiry calculations and status checks
 */

export const getSubscriptionStatus = (expiryDate) => {
  if (!expiryDate) {
    return { isValid: true, remainingDays: null, status: "lifetime" };
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const timeDiff = expiry - now;
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return { isValid: false, remainingDays: 0, status: "expired" };
  }

  if (daysDiff === 0) {
    return { isValid: true, remainingDays: 0, status: "expiring-today" };
  }

  if (daysDiff <= 7) {
    return { isValid: true, remainingDays: daysDiff, status: "expiring-soon" };
  }

  return { isValid: true, remainingDays: daysDiff, status: "active" };
};

export const getSubscriptionMessage = (subscriptionStatus, remainingDays, expiryDate) => {
  if (subscriptionStatus.status === "lifetime") {
    return "✓ Lifetime access - No expiry";
  }

  if (subscriptionStatus.status === "expired") {
    const expiry = new Date(expiryDate);
    return `✗ Subscription expired on ${expiry.toLocaleDateString()} - Renew to continue`;
  }

  if (subscriptionStatus.status === "expiring-today") {
    return "⚠️ Subscription expires today - Renew to maintain access";
  }

  if (subscriptionStatus.status === "expiring-soon") {
    return `⚠️ Subscription expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"} - Renew soon`;
  }

  // Active status
  return `✓ Subscription active - ${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining`;
};

export const formatExpiryDate = (expiryDate) => {
  if (!expiryDate) return "Lifetime";
  const date = new Date(expiryDate);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getRenewalLink = (assessmentId) => {
  return `/payment/${assessmentId}?action=renew`;
};
