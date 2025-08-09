const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { validateBody, Joi } = require("../../utils/validate");
const { parseObjectId } = require("../../utils/parseHelpers");

const router = express.Router();

// Create notification schema
const createNotificationSchema = Joi.object({
  userId: Joi.string().length(24).hex().required(),
  taskId: Joi.string().length(24).hex().required(),
  title: Joi.string().required(),
  status: Joi.string().required(),
  message: Joi.string().optional(),
});

// Get notifications schema
const getNotificationsSchema = Joi.object({
  userId: Joi.string().length(24).hex().optional(),
});

// Create notification function (to be called from task endpoints)
async function createNotification(userId, taskId, title, status, message = "") {
  try {
    const db = await getCrmDb();
    const notificationsCollection = db.collection("notifications");

    const notification = {
      userId: parseObjectId(userId, "userId"),
      taskId: parseObjectId(taskId, "taskId"),
      title,
      status,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    await notificationsCollection.insertOne(notification);
    return true;
  } catch (error) {
    console.error("Error creating notification:", error);
    return false;
  }
}

// Create notification endpoint (for manual creation if needed)
router.post(
  "/create",
  authenticateJWT,
  validateBody(createNotificationSchema),
  async (req, res) => {
    try {
      const { userId, taskId, title, status, message } = req.body;

      const success = await createNotification(userId, taskId, title, status, message);

      if (success) {
        res.status(201).json({ message: "Notification created successfully." });
      } else {
        res.status(500).json({ message: "Failed to create notification." });
      }
    } catch (err) {
      res.status(500).json({
        message: "Failed to create notification.",
        error: err.message,
      });
    }
  }
);

// Get notifications list for a user (or all notifications for admin)
router.post(
  "/list",
  authenticateJWT,
  validateBody(getNotificationsSchema),
  async (req, res) => {
    try {
      const userId = req.body?.userId;
      const db = await getCrmDb();
      const notificationsCollection = db.collection("notifications");

      let filter = {};
      let unreadFilter = {};

      // If userId is provided, filter by user; otherwise get all notifications (for admin)
      if (userId) {
        filter.userId = parseObjectId(userId, "userId");
        unreadFilter.userId = parseObjectId(userId, "userId");
      }

      const notifications = await notificationsCollection
        .find(filter)
        .sort({ createdAt: -1 }) // Most recent first
        .toArray();

      // Format the response to include required fields
      const formattedNotifications = notifications.map((notification) => ({
        _id: notification._id,
        userId: notification.userId,
        title: notification.title,
        status: notification.status,
        message: notification.message || "",
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      }));

      // Count unread notifications
      unreadFilter.isRead = false;
      const unreadCount = await notificationsCollection.countDocuments(unreadFilter);

      res.json({ 
        notifications: formattedNotifications,
        unreadCount 
      });
    } catch (err) {
      res.status(500).json({
        message: "Failed to fetch notifications.",
        error: err.message,
      });
    }
  }
);

// Mark notification as read
router.put("/mark-read/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const notificationId = parseObjectId(id, "notification id");

    const db = await getCrmDb();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.findOneAndUpdate(
      { _id: notificationId },
      { $set: { isRead: true } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.json({ message: "Notification marked as read." });
  } catch (err) {
    res.status(500).json({
      message: "Failed to mark notification as read.",
      error: err.message,
    });
  }
});

// Get unread count for a user (or all users for admin)
router.post(
  "/unread-count",
  authenticateJWT,
  validateBody(getNotificationsSchema),
  async (req, res) => {
    try {
      const userId = req.body?.userId;
      const db = await getCrmDb();
      const notificationsCollection = db.collection("notifications");

      let filter = { isRead: false };

      // If userId is provided, filter by user; otherwise get all unread (for admin)
      if (userId) {
        filter.userId = parseObjectId(userId, "userId");
      }

      const unreadCount = await notificationsCollection.countDocuments(filter);

      res.json({ unreadCount });
    } catch (err) {
      res.status(500).json({
        message: "Failed to get unread count.",
        error: err.message,
      });
    }
  }
);

// Mark all notifications as read for a user (or all users for admin)
router.put(
  "/mark-all-read",
  authenticateJWT,
  validateBody(getNotificationsSchema),
  async (req, res) => {
    try {
      const userId = req.body?.userId;
      const db = await getCrmDb();
      const notificationsCollection = db.collection("notifications");

      let filter = { isRead: false };

      // If userId is provided, filter by user; otherwise mark all unread as read (for admin)
      if (userId) {
        filter.userId = parseObjectId(userId, "userId");
      }

      const result = await notificationsCollection.updateMany(
        filter,
        { $set: { isRead: true } }
      );

      res.json({
        message: "All notifications marked as read.",
        updatedCount: result.modifiedCount,
      });
    } catch (err) {
      res.status(500).json({
        message: "Failed to mark notifications as read.",
        error: err.message,
      });
    }
  }
);

// Delete notification
router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const notificationId = parseObjectId(id, "notification id");

    const db = await getCrmDb();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.findOneAndDelete({
      _id: notificationId,
    });

    if (!result) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.json({ message: "Notification deleted successfully." });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete notification.",
      error: err.message,
    });
  }
});

// Export the createNotification function so it can be used in task.js
module.exports = { router, createNotification };
