const { getModel } = require("../config/adapter");

const getUser = () => getModel("User");
const getMessage = () => getModel("Message");

// Get all unread messages for the logged-in user
const getUnreadMessages = async (req, res) => {
  try {
    console.log("🎯🎯 getUnreadMessages called!");
    const userId = req.user.id;
    const Message = getMessage();

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false,
    });

    console.log("✅ Returning unread count:", unreadCount);
    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unread messages",
      error: error.message,
    });
  }
};

// Get all messages for the logged-in user (inbox)
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, isRead, category, type } = req.query;
    const skip = (page - 1) * limit;

    const Message = getMessage();
    const User = getUser();

    // Build filter
    const filter = { recipient: userId };
    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }
    if (category) {
      filter.category = category;
    }
    if (type) {
      filter.type = type;
    }

    // Get messages with sender details
    const messages = await Message.find(filter)
      .populate("sender", "name email profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Message.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: error.message,
    });
  }
};

// Get a single message by ID
const getMessageById = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const Message = getMessage();

    const message = await Message.findById(messageId).populate(
      "sender",
      "name email profileImage"
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is the recipient
    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this message",
      });
    }

    // Mark as read if not already
    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await message.save();
    }

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching message",
      error: error.message,
    });
  }
};

// Send a message (Admin to Student or Student to Student)
const sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, message, type, priority, category } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient ID and message are required",
      });
    }

    const Message = getMessage();
    const User = getUser();

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found",
      });
    }

    // Create message
    const newMessage = await Message.create({
      sender: senderId,
      recipient: recipientId,
      subject: subject || "New Message",
      message,
      type: type || "message",
      priority: priority || "normal",
      category: category || "other",
    });

    // Populate sender details
    const populatedMessage = await newMessage.populate(
      "sender",
      "name email profileImage"
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

// Mark message as read
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const Message = getMessage();

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this message",
      });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.status(200).json({
      success: true,
      message: "Message marked as read",
      data: message,
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking message as read",
      error: error.message,
    });
  }
};

// Mark all messages as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const Message = getMessage();

    const result = await Message.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All messages marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all messages as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all messages as read",
      error: error.message,
    });
  }
};

// Delete a message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const Message = getMessage();

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this message",
      });
    }

    await Message.deleteOne({ _id: messageId });

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting message",
      error: error.message,
    });
  }
};

// Admin: Send notification to user(s)
const sendNotification = async (req, res) => {
  try {
    const { recipientIds, subject, message, type, priority, category } = req.body;

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Recipient IDs array is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const Message = getMessage();
    const senderId = req.user.id;

    // Create messages for each recipient
    const messages = recipientIds.map((recipientId) => ({
      sender: senderId,
      recipient: recipientId,
      subject: subject || "System Notification",
      message,
      type: type || "notification",
      priority: priority || "normal",
      category: category || "system",
    }));

    const result = await Message.insertMany(messages);

    res.status(201).json({
      success: true,
      message: `Notification sent to ${result.length} recipient(s)`,
      data: result,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notification",
      error: error.message,
    });
  }
};

// Get message statistics for admin
const getMessageStats = async (req, res) => {
  try {
    const Message = getMessage();

    const stats = {
      totalMessages: await Message.countDocuments(),
      unreadMessages: await Message.countDocuments({ isRead: false }),
      readMessages: await Message.countDocuments({ isRead: true }),
      byType: await Message.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      byPriority: await Message.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      byCategory: await Message.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching message stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching message stats",
      error: error.message,
    });
  }
};

module.exports = {
  getUnreadMessages,
  getMessages,
  getMessageById,
  sendMessage,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  sendNotification,
  getMessageStats,
};
