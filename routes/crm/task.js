const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { validateBody, Joi } = require("../../utils/validate");
const { parseObjectId } = require("../../utils/parseHelpers");
const { createNotification } = require("./notification");

const router = express.Router();

const createTaskSchema = Joi.object({
  title: Joi.string().required(),
  progress: Joi.number().required(),
  status: Joi.string().required(),
  dueDate: Joi.string().required(),
  mentorId: Joi.string().length(24).hex().optional(),
  memberId: Joi.array().items(Joi.string().length(24).hex()).optional(),
  createdBy: Joi.string().length(24).hex().required(),
});

const editTaskSchema = Joi.object({
  title: Joi.string(),
  progress: Joi.number(),
  status: Joi.string(),
  dueDate: Joi.string(),
  mentorId: Joi.string().length(24).hex().optional(),
  memberId: Joi.array().items(Joi.string().length(24).hex()).optional(),
});

// Create task endpoint (JSON only, no file upload)
router.post(
  "/create",
  authenticateJWT,
  validateBody(createTaskSchema),
  async (req, res) => {
    try {
      const db = await getCrmDb();
      const tasksCollection = db.collection("tasks");
      // Do not set _id manually; let MongoDB assign ObjectId
      let mentorId, memberId, createdBy;
      try {
        mentorId = req.body.mentorId
          ? parseObjectId(req.body.mentorId, "mentorId")
          : undefined;
        memberId = req.body.memberId
          ? req.body.memberId.map((id) => parseObjectId(id, "memberId"))
          : undefined;
        createdBy = parseObjectId(req.body.createdBy, "createdBy");
      } catch (e) {
        return res.status(400).json({ message: e.message });
      }
      // Set progress based on status
      let progress;
      let memberProgress = undefined;
      if (Array.isArray(req.body.memberId) && req.body.memberId.length > 0) {
        memberProgress = req.body.memberId.map((id) => ({
          memberId: id,
          progress: 0,
        }));
        progress = 0; // All members start at 0
      } else {
        switch (req.body.status) {
          case "pending":
            progress = 0;
            break;
          case "in progress":
            progress = 50;
            break;
          case "completed":
            progress = 100;
            break;
          default:
            progress = Number(req.body.progress) || 0;
        }
      }
      const newTask = {
        title: req.body.title,
        progress,
        status: req.body.status,
        dueDate: req.body.dueDate,
        mentorId,
        memberId,
        createdBy,
        createdAt: new Date().toISOString(),
        ...(memberProgress ? { memberProgress } : {}),
      };
      // Remove undefined fields
      Object.keys(newTask).forEach(
        (key) => newTask[key] === undefined && delete newTask[key]
      );
      const result = await tasksCollection.insertOne(newTask);

      // Create notifications for assigned members and mentor
      const notificationPromises = [];

      // Check if the creator is a mentor (if they're assigning themselves as mentor)
      const isCreatorMentor =
        mentorId && mentorId.toString() === createdBy.toString();

      // Create notification for mentor if assigned (and not the creator)
      if (mentorId && !isCreatorMentor) {
        notificationPromises.push(
          createNotification(
            mentorId.toString(),
            result.insertedId.toString(),
            req.body.title,
            req.body.status,
            "Admin Assigned Task to Mentor!"
          )
        );
      }

      // Create notifications for assigned members
      if (memberId && Array.isArray(memberId)) {
        memberId.forEach((member) => {
          const message = isCreatorMentor
            ? "Mentor Assigned Task to Member!"
            : "Admin Assigned Task to Member!";

          notificationPromises.push(
            createNotification(
              member.toString(),
              result.insertedId.toString(),
              req.body.title,
              req.body.status,
              message
            )
          );
        });
      }

      // Wait for all notifications to be created (don't fail the task creation if notifications fail)
      try {
        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error("Error creating notifications:", notificationError);
        // Don't fail the task creation if notifications fail
      }

      res.status(201).json({
        message: "Task created successfully.",
        taskId: result.insertedId,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create task.", error: err.message });
    }
  }
);

// Get all tasks endpoint (protected)
router.post("/list", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");
    const { mentorId, memberId } = req.body;
    let filter = {};
    try {
      if (mentorId) filter.mentorId = parseObjectId(mentorId, "mentorId");
      if (memberId) filter.memberId = parseObjectId(memberId, "memberId");
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    const tasks = await tasksCollection.find(filter).toArray();
    tasks.forEach((task) => {
      if (task.photo) {
        const filename = task.photo.split(/[\\/]/).pop();
        task.photo = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
      }
    });
    res.json({ tasks });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch tasks.", error: err.message });
  }
});

// Edit task endpoint (JSON only, no file upload)
router.put(
  "/edit/:id",
  authenticateJWT,
  validateBody(editTaskSchema),
  async (req, res) => {
    const { id } = req.params;
    let taskId;
    try {
      taskId = parseObjectId(id, "task id");
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    // Use req.body (already validated)
    const updateFields = {};
    const { title, progress, status, dueDate, mentorId, memberId } = req.body;
    try {
      if (mentorId !== undefined)
        updateFields.mentorId = parseObjectId(mentorId, "mentorId");
      if (memberId !== undefined)
        updateFields.memberId = memberId.map((id) =>
          parseObjectId(id, "memberId")
        );
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    if (title !== undefined) updateFields.title = title;
    if (status !== undefined) {
      updateFields.status = status;
      // Set progress based on status
      switch (status) {
        case "pending":
          updateFields.progress = 0;
          break;
        case "in progress":
          updateFields.progress = 50;
          break;
        case "completed":
          updateFields.progress = 100;
          break;
        default:
          if (progress !== undefined) updateFields.progress = Number(progress);
      }
    } else if (progress !== undefined) {
      updateFields.progress = Number(progress);
    }
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields provided to update." });
    }
    try {
      const db = await getCrmDb();
      const tasksCollection = db.collection("tasks");
      // Get the current task to compare with updates
      const currentTask = await tasksCollection.findOne({ _id: taskId });
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found." });
      }

      const result = await tasksCollection.findOneAndUpdate(
        { _id: taskId },
        { $set: updateFields },
        { returnDocument: "after", returnOriginal: false }
      );

      if (!result) {
        return res.status(404).json({ message: "Task not found." });
      }

      const updatedTask = result;

      // Create notifications for changes
      const notificationPromises = [];

      // Check if new members are assigned
      if (memberId && Array.isArray(memberId)) {
        const currentMemberIds = currentTask.memberId
          ? currentTask.memberId.map((id) => id.toString())
          : [];
        const newMemberIds = memberId.map((id) => id.toString());

        // Find newly assigned members
        const newlyAssignedMembers = newMemberIds.filter(
          (id) => !currentMemberIds.includes(id)
        );

        // Check if current user is the mentor of this task
        const isCurrentUserMentor =
          currentTask.mentorId &&
          currentTask.mentorId.toString() === req.user?.id?.toString();

        newlyAssignedMembers.forEach((memberId) => {
          const message = isCurrentUserMentor
            ? "Mentor Assigned Task to Member!"
            : "Admin Assigned Task to Member!";

          notificationPromises.push(
            createNotification(
              memberId,
              taskId.toString(),
              updatedTask.title || currentTask.title,
              updatedTask.status || currentTask.status,
              message
            )
          );
        });
      }

      // Check if new mentor is assigned
      if (
        mentorId &&
        (!currentTask.mentorId ||
          currentTask.mentorId.toString() !== mentorId.toString())
      ) {
        notificationPromises.push(
          createNotification(
            mentorId.toString(),
            taskId.toString(),
            updatedTask.title || currentTask.title,
            updatedTask.status || currentTask.status,
            "Admin Assigned Task to Mentor!"
          )
        );
      }

      // Check if status changed
      if (status && currentTask.status !== status) {
        // Get current user's ID from their email since JWT doesn't contain ID
        const profileCollection = db.collection("profile");
        const currentUserProfile = await profileCollection.findOne({
          email: req.user.email,
        });

        // Check if current user is the mentor of this task
        const isCurrentUserMentor =
          currentTask.mentorId &&
          currentUserProfile &&
          currentTask.mentorId.toString() === currentUserProfile._id.toString();

        // Create user name for notification message
        let userName = "Someone";
        if (
          currentUserProfile &&
          currentUserProfile.firstName &&
          currentUserProfile.lastName
        ) {
          userName = `${currentUserProfile.firstName} ${currentUserProfile.lastName}`;
        } else if (currentUserProfile && currentUserProfile.firstName) {
          userName = currentUserProfile.firstName;
        }

        // Determine the notification message based on who is updating
        const roleText = isCurrentUserMentor ? "Mentor" : "Admin";
        const notificationMessage = `${userName} (${roleText}) updated task status to "${status}"`;

        const allAssignedUsers = [];
        if (updatedTask.mentorId)
          allAssignedUsers.push(updatedTask.mentorId.toString());
        if (updatedTask.memberId && Array.isArray(updatedTask.memberId)) {
          updatedTask.memberId.forEach((id) =>
            allAssignedUsers.push(id.toString())
          );
        }

        allAssignedUsers.forEach((userId) => {
          notificationPromises.push(
            createNotification(
              userId,
              taskId.toString(),
              updatedTask.title || currentTask.title,
              status,
              notificationMessage
            )
          );
        });
      }

      // Wait for all notifications to be created (don't fail the task update if notifications fail)
      try {
        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error("Error creating notifications:", notificationError);
        // Don't fail the task update if notifications fail
      }

      res.json({ message: "Task updated successfully.", ...updatedTask });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to update task.", error: err.message });
    }
  }
);

// Delete task endpoint (protected)
router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  let taskId;
  try {
    taskId = parseObjectId(id, "task id");
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  try {
    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");
    const result = await tasksCollection.findOneAndDelete({ _id: taskId });
    if (!result) {
      return res.status(404).json({ message: "Task not found." });
    }
    res.json({ message: "Task deleted successfully.", _id: id });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete task.", error: err.message });
  }
});

// Update a specific member's progress and recalculate task progress
router.put("/updateStatus", authenticateJWT, async (req, res) => {
  try {
    const { taskId, memberId, status } = req.body;

    if (!taskId || !memberId || !status) {
      return res.status(400).json({
        message: "taskId, memberId, and status are required.",
      });
    }

    let parsedTaskId, parsedMemberId;
    try {
      parsedTaskId = parseObjectId(taskId, "taskId");
      parsedMemberId = parseObjectId(memberId, "memberId");
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");

    // Find the task and verify the member is assigned to it
    const task = await tasksCollection.findOne({
      _id: parsedTaskId,
      memberId: parsedMemberId,
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found or member is not assigned to this task.",
      });
    }

    // Calculate progress based on status
    let memberProgress;
    switch (status) {
      case "pending":
        memberProgress = 0;
        break;
      case "in progress":
        memberProgress = 50;
        break;
      case "completed":
        memberProgress = 100;
        break;
      default:
        memberProgress = 0;
    }

    // Prepare update operations
    const updateOperations = {
      $set: {},
    };

    // If the task has memberProgress structure, update the specific member's progress
    if (task.memberProgress && Array.isArray(task.memberProgress)) {
      const memberProgressIndex = task.memberProgress.findIndex(
        (mp) => mp.memberId === memberId
      );

      if (memberProgressIndex !== -1) {
        // Update existing member progress
        updateOperations.$set[
          `memberProgress.${memberProgressIndex}.progress`
        ] = memberProgress;
        updateOperations.$set[`memberProgress.${memberProgressIndex}.status`] =
          status;
      } else {
        // Add new member progress entry
        updateOperations.$push = {
          memberProgress: {
            memberId: memberId,
            progress: memberProgress,
            status: status,
          },
        };
      }

      // Calculate overall progress based on all assigned members
      const memberProgressMap = new Map();

      // Initialize all assigned members with 0 progress
      if (task.memberId && Array.isArray(task.memberId)) {
        task.memberId.forEach((member) => {
          memberProgressMap.set(member.toString(), 0);
        });
      }

      // Update with existing member progress
      if (task.memberProgress && Array.isArray(task.memberProgress)) {
        task.memberProgress.forEach((mp) => {
          memberProgressMap.set(mp.memberId, mp.progress);
        });
      }

      // Update the current member's progress
      memberProgressMap.set(memberId, memberProgress);

      // Calculate total progress and average
      const totalProgress = Array.from(memberProgressMap.values()).reduce(
        (sum, progress) => sum + progress,
        0
      );
      const totalMembers = memberProgressMap.size;
      const averageProgress =
        totalMembers > 0 ? Math.round(totalProgress / totalMembers) : 0;

      // Determine overall status based on average progress
      let overallStatus;
      if (averageProgress === 0) {
        overallStatus = "pending";
      } else if (averageProgress === 100) {
        overallStatus = "completed";
      } else {
        overallStatus = "in progress";
      }

      updateOperations.$set.progress = averageProgress;
      updateOperations.$set.status = overallStatus;
    } else {
      // If no memberProgress structure, just update the main task
      updateOperations.$set.progress = memberProgress;
      updateOperations.$set.status = status;
    }

    const result = await tasksCollection.findOneAndUpdate(
      { _id: parsedTaskId },
      updateOperations,
      { returnDocument: "after", returnOriginal: false }
    );

    if (!result) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Create notifications for all related members and mentor except the one who made the change
    try {
      // Fetch the profile of the person who made the status change
      const profileCollection = db.collection("profile");
      const userProfile = await profileCollection.findOne({
        _id: parsedMemberId,
      });

      // Create user name for notification message
      let userName = "Someone";
      if (userProfile && userProfile.firstName && userProfile.lastName) {
        userName = `${userProfile.firstName} ${userProfile.lastName}`;
      } else if (userProfile && userProfile.firstName) {
        userName = userProfile.firstName;
      }

      const notificationPromises = [];
      const notificationMessage = `${userName} updated task status to "${status}"`;

      // Notify the mentor if assigned and not the one making the change
      if (result.mentorId && result.mentorId.toString() !== memberId) {
        notificationPromises.push(
          createNotification(
            result.mentorId.toString(),
            taskId,
            result.title,
            status,
            notificationMessage
          )
        );
      }

      // Notify all assigned members except the one making the change
      if (result.memberId && Array.isArray(result.memberId)) {
        result.memberId.forEach((assignedMemberId) => {
          if (assignedMemberId.toString() !== memberId) {
            notificationPromises.push(
              createNotification(
                assignedMemberId.toString(),
                taskId,
                result.title,
                status,
                notificationMessage
              )
            );
          }
        });
      }

      // Send all notifications
      if (notificationPromises.length > 0) {
        await Promise.all(notificationPromises);
      }
    } catch (notificationError) {
      console.error("Error creating notifications:", notificationError);
      // Don't fail the update if notifications fail
    }

    res.json({
      message: "Task status updated successfully.",
      task: result,
    });
  } catch (err) {
    console.error("Error in updateStatus:", err);
    res.status(500).json({
      message: "Failed to update task status.",
      error: err.message,
    });
  }
});

// Member-specific task list
router.post("/memberTask", authenticateJWT, async (req, res) => {
  const { memberId, taskId } = req.body;
  if (!memberId) {
    return res.status(400).json({ message: "memberId is required." });
  }

  try {
    let parsedMemberId, parsedTaskId;
    try {
      parsedMemberId = parseObjectId(memberId, "memberId");
      if (taskId) {
        parsedTaskId = parseObjectId(taskId, "taskId");
      }
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");

    // Build query filter
    // Check both the main memberId array (ObjectIds) and memberProgress array (strings)
    let filter = {
      $or: [
        { memberId: parsedMemberId }, // Check if member is in the main memberId array
        { "memberProgress.memberId": memberId }, // Check if member has progress entry
      ],
    };
    if (parsedTaskId) {
      filter._id = parsedTaskId;
    }

    // Find tasks where member is assigned (either in memberId array or has progress entry)
    const tasks = await tasksCollection.find(filter).toArray();

    // For each task, extract the member's own progress/status and include additional fields
    const memberTasks = tasks.map((task) => {
      const memberEntry = (task.memberProgress || []).find(
        (mp) => mp.memberId === memberId
      );

      // Handle photo URL if it exists
      let photoUrl = null;
      if (task.photo) {
        const filename = task.photo.split(/[\\/]/).pop();
        photoUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
      }

      return {
        taskId: task._id,
        title: task.title,
        dueDate: task.dueDate,
        status: task.status,
        memberStatus: memberEntry?.status ?? "pending",
        memberProgress: memberEntry?.progress ?? 0,
        memberId: task.memberId,
        mentorId: task.mentorId,
        photo: photoUrl,
      };
    });
    res.json(memberTasks);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch member tasks.", error: err.message });
  }
});

module.exports = router;
