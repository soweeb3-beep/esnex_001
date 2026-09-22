import API from "./axios";

const messageAPI = {
  // Get unread message count
  getUnreadCount: () => API.get("/messages/unread-count"),

  // Get all messages (inbox)
  getMessages: (page = 1, limit = 20, filters = {}) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    return API.get(`/messages?${params}`);
  },

  // Get a single message
  getMessage: (messageId) => API.get(`/messages/${messageId}`),

  // Send a message
  sendMessage: (recipientId, subject, message, type = "message", priority = "normal", category = "other") =>
    API.post("/messages", {
      recipientId,
      subject,
      message,
      type,
      priority,
      category,
    }),

  // Mark message as read
  markAsRead: (messageId) => API.patch(`/messages/${messageId}/mark-read`),

  // Mark all messages as read
  markAllAsRead: () => API.patch("/messages/mark-all-read"),

  // Delete message
  deleteMessage: (messageId) => API.delete(`/messages/${messageId}`),

  // Admin: Send notification to users
  sendNotification: (recipientIds, subject, message, type = "notification", priority = "normal", category = "system") =>
    API.post("/messages/admin/send-notification", {
      recipientIds,
      subject,
      message,
      type,
      priority,
      category,
    }),

  // Admin: Get message statistics
  getStats: () => API.get("/messages/admin/stats"),
};

export default messageAPI;
