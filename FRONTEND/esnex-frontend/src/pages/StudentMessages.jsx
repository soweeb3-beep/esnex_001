import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import messageAPI from "../api/messageAPI";
import toast from "react-hot-toast";
import "../styles/StudentMessages.css";

export default function StudentMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMessages();
  }, [filter, currentPage]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const filterObj = {};
      if (filter === "unread") filterObj.isRead = "false";
      if (filter === "read") filterObj.isRead = "true";

      const { data } = await messageAPI.getMessages(currentPage, 20, filterObj);

      setMessages(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId) => {
    try {
      await messageAPI.markAsRead(messageId);
      // Refresh messages
      fetchMessages();
      // If viewing the message, mark it as read
      if (selectedMessage?._id === messageId) {
        setSelectedMessage({ ...selectedMessage, isRead: true });
      }
      toast.success("Message marked as read");
    } catch (error) {
      console.error("Error marking message as read:", error);
      toast.error("Failed to mark message as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await messageAPI.markAllAsRead();
      fetchMessages();
      toast.success("All messages marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    try {
      await messageAPI.deleteMessage(messageId);
      setMessages(messages.filter((m) => m._id !== messageId));
      setSelectedMessage(null);
      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const handleSelectMessage = async (message) => {
    setSelectedMessage(message);
    // Mark as read when selected
    if (!message.isRead) {
      handleMarkAsRead(message._id);
    }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className="student-messages">
      <div className="messages-header">
        <h1>📬 My Messages</h1>
        <div className="messages-stats">
          <span className="stat">Total: {messages.length}</span>
          {unreadCount > 0 && <span className="stat unread">Unread: {unreadCount}</span>}
        </div>
      </div>

      <div className="messages-container">
        {/* Messages List Sidebar */}
        <div className="messages-list-section">
          <div className="messages-list-header">
            <h2>Messages</h2>
            <div className="messages-filters">
              <button
                className={`filter-btn ${filter === "all" ? "active" : ""}`}
                onClick={() => {
                  setFilter("all");
                  setCurrentPage(1);
                }}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === "unread" ? "active" : ""}`}
                onClick={() => {
                  setFilter("unread");
                  setCurrentPage(1);
                }}
              >
                Unread ({unreadCount})
              </button>
              <button
                className={`filter-btn ${filter === "read" ? "active" : ""}`}
                onClick={() => {
                  setFilter("read");
                  setCurrentPage(1);
                }}
              >
                Read
              </button>
            </div>

            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                Mark All as Read
              </button>
            )}
          </div>

          {loading ? (
            <div className="messages-loading">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="messages-empty">
              <p>📭 No messages yet</p>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message-item ${selectedMessage?._id === message._id ? "selected" : ""} ${
                    !message.isRead ? "unread" : ""
                  }`}
                  onClick={() => handleSelectMessage(message)}
                >
                  <div className="message-item-header">
                    <div className="message-sender-name">
                      {message.sender?.name || "System"}
                    </div>
                    {!message.isRead && <span className="unread-dot">●</span>}
                  </div>
                  <div className="message-item-subject">{message.subject}</div>
                  <div className="message-item-preview">
                    {message.message.substring(0, 50)}
                    {message.message.length > 50 ? "..." : ""}
                  </div>
                  <div className="message-item-footer">
                    <span className="message-type">{message.type}</span>
                    <span className="message-date">
                      {new Date(message.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="messages-pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                ← Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Message Detail View */}
        <div className="message-detail-section">
          {selectedMessage ? (
            <div className="message-detail">
              <div className="message-detail-header">
                <div className="message-detail-title">{selectedMessage.subject}</div>
                <div className="message-detail-meta">
                  <div>
                    <strong>From:</strong> {selectedMessage.sender?.name || "System"}
                  </div>
                  <div>
                    <strong>Email:</strong> {selectedMessage.sender?.email || "N/A"}
                  </div>
                  <div>
                    <strong>Date:</strong>{" "}
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Type:</strong>{" "}
                    <span className="type-badge">{selectedMessage.type}</span>
                  </div>
                  {selectedMessage.priority !== "normal" && (
                    <div>
                      <strong>Priority:</strong>{" "}
                      <span className={`priority-badge ${selectedMessage.priority}`}>
                        {selectedMessage.priority.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="message-detail-content">
                <p>{selectedMessage.message}</p>
              </div>

              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div className="message-attachments">
                  <h4>📎 Attachments</h4>
                  {selectedMessage.attachments.map((attachment, idx) => (
                    <a
                      key={idx}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-link"
                    >
                      📄 {attachment.filename}
                    </a>
                  ))}
                </div>
              )}

              <div className="message-detail-actions">
                {!selectedMessage.isRead && (
                  <button
                    className="action-btn mark-read"
                    onClick={() => handleMarkAsRead(selectedMessage._id)}
                  >
                    ✓ Mark as Read
                  </button>
                )}
                <button
                  className="action-btn delete"
                  onClick={() => handleDeleteMessage(selectedMessage._id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="message-detail-empty">
              <p>📖 Select a message to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
