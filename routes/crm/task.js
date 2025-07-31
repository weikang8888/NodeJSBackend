const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { validateBody, Joi } = require("../../utils/validate");
const { parseObjectId } = require("../../utils/parseHelpers");

const router = express.Router();

const createTaskSchema = Joi.object({
  title: Joi.string().required(),
  progress: Joi.number().required(),
  status: Joi.string().required(),
  dueDate: Joi.string().required(),
  mentorId: Joi.string().length(24).hex().optional(),
  memberId: Joi.array().items(Joi.string().length(24).hex()).optional(),
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
      let mentorId, memberId;
      try {
        mentorId = req.body.mentorId
          ? parseObjectId(req.body.mentorId, "mentorId")
          : undefined;
        memberId = req.body.memberId
          ? req.body.memberId.map((id) => parseObjectId(id, "memberId"))
          : undefined;
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
        createdAt: new Date().toISOString(),
        ...(memberProgress ? { memberProgress } : {}),
      };
      // Remove undefined fields
      Object.keys(newTask).forEach(
        (key) => newTask[key] === undefined && delete newTask[key]
      );
      const result = await tasksCollection.insertOne(newTask);
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
      const result = await tasksCollection.findOneAndUpdate(
        { _id: taskId },
        { $set: updateFields },
        { returnDocument: "after", returnOriginal: false }
      );
      if (!result) {
        return res.status(404).json({ message: "Task not found." });
      }
      const updatedTask = result;
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
  const { taskId, memberId, status } = req.body;
  let progress;
  switch (status) {
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
      return res.status(400).json({
        message:
          "Invalid status. Must be 'pending', 'in progress', or 'completed'.",
      });
  }
  let taskObjectId;
  try {
    taskObjectId = parseObjectId(taskId, "task id");
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  try {
    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");
    // Find the task
    const task = await tasksCollection.findOne({ _id: taskObjectId });
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }
    if (!Array.isArray(task.memberProgress)) {
      return res
        .status(400)
        .json({ message: "Task does not have memberProgress tracking." });
    }
    // Update the member's status and progress
    let found = false;
    const updatedMemberProgress = task.memberProgress.map((mp) => {
      if (mp.memberId === memberId) {
        found = true;
        return { ...mp, status, progress };
      }
      // If status/progress not present, keep old or default to pending/0
      return {
        ...mp,
        status: mp.status || "pending",
        progress: typeof mp.progress === "number" ? mp.progress : 0,
      };
    });
    if (!found) {
      return res
        .status(404)
        .json({ message: "Member not assigned to this task." });
    }
    // Calculate new average progress
    const avgProgress =
      updatedMemberProgress.reduce((sum, mp) => sum + mp.progress, 0) /
      updatedMemberProgress.length;
    // Calculate new overall status
    const statuses = updatedMemberProgress.map((mp) => mp.status);
    let overallStatus;
    if (statuses.includes("in progress")) {
      overallStatus = "in progress";
    } else if (statuses.every((s) => s === "pending")) {
      overallStatus = "pending";
    } else if (statuses.every((s) => s === "completed")) {
      overallStatus = "completed";
    } else {
      overallStatus = "pending";
    }
    // Update the task
    const result = await tasksCollection.findOneAndUpdate(
      { _id: taskObjectId },
      {
        $set: {
          memberProgress: updatedMemberProgress,
          progress: avgProgress,
          status: overallStatus,
        },
      },
      { returnDocument: "after", returnOriginal: false }
    );
    res.json({
      message: "Member status updated.",
      progress: avgProgress,
      status: overallStatus,
      memberProgress: updatedMemberProgress,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update member status.", error: err.message });
  }
});

// Member-specific task list
router.post("/memberTask", authenticateJWT, async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) {
    return res.status(400).json({ message: "memberId is required." });
  }
  try {
    const db = await getCrmDb();
    const tasksCollection = db.collection("tasks");
    // Find tasks where memberProgress contains this memberId
    const tasks = await tasksCollection
      .find({ "memberProgress.memberId": memberId })
      .toArray();
    // For each task, extract the member's own progress/status
    const memberTasks = tasks.map((task) => {
      const memberEntry = (task.memberProgress || []).find(
        (mp) => mp.memberId === memberId
      );
      return {
        taskId: task._id,
        title: task.title,
        dueDate: task.dueDate,
        status: task.status, // overall status
        memberStatus: memberEntry?.status ?? "pending",
        memberProgress: memberEntry?.progress ?? 0,
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
