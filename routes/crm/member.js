const express = require("express");
const getCrmDb = require("./index");
const {
  authenticateJWT,
  generateRandomPassword,
} = require("../../utils/authMiddleware");
const { validateBody, Joi } = require("../../utils/validate");
const { parseObjectId } = require("../../utils/parseHelpers");
const bcrypt = require("bcrypt");

const router = express.Router();

// Validation schema for creating a member
const createMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  position: Joi.string().required(),
});

const editMemberSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  position: Joi.string(),
});

// Create member endpoint (protected)
router.post(
  "/create",
  authenticateJWT,
  validateBody(createMemberSchema),
  async (req, res) => {
    const { email, firstName, lastName, position } = req.body;
    try {
      const db = await getCrmDb();
      const usersCollection = db.collection("users");
      const membersCollection = db.collection("members");
      const profileCollection = db.collection("profile");
      // Check for duplicate email
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered." });
      }
      // Auto-generate password
      const generatedPassword = generateRandomPassword(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      // Insert user and get insertedId
      const userInsertResult = await usersCollection.insertOne({
        email,
        password: hashedPassword,
        role: "Member",
        hasRandomPassword: true, // Flag to track if user has random password
      });
      const userId = userInsertResult.insertedId;
      // Insert member with same _id as user
      await membersCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        email,
        position,
        avatar: req.file ? req.file.path : "",
        createdAt: new Date().toISOString(),
      });
      // Insert into profile collection with same _id
      await profileCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        email,
        role: "Member",
        position,
      });
      res.status(201).json({
        message: "Member created successfully.",
        memberId: userId,
        generatedPassword,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create member.", error: err.message });
    }
  }
);

// Get all mentors endpoint (protected)
router.get("/list", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const membersCollection = db.collection("members");
    const tasksCollection = db.collection("tasks");
    const members = await membersCollection.find({}).toArray();
    for (const member of members) {
      if (member.avatar) {
        const filename = member.avatar.split(/[\\/]/).pop();
        member.avatar = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
      }
      // Count tasks assigned to this mentor
      member.task = await tasksCollection.countDocuments({
        memberId: member._id,
      });
    }
    res.json({ members });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch mentors.", error: err.message });
  }
});

// Edit member endpoint (protected)
router.put(
  "/edit/:id",
  authenticateJWT,
  validateBody(editMemberSchema),
  async (req, res) => {
    const { id } = req.params;
    let memberId;
    try {
      memberId = parseObjectId(id, "member id");
    } catch (e) {
      return res.status(400).json({ message: "Invalid member id format." });
    }
    const updateFields = {};
    const { firstName, lastName, position } = req.body;
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (position !== undefined) updateFields.position = position;
    if (req.file) updateFields.avatar = req.file.path;
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields provided to update." });
    }
    try {
      const db = await getCrmDb();
      const membersCollection = db.collection("members");
      const result = await membersCollection.findOneAndUpdate(
        { _id: memberId },
        { $set: updateFields },
        { returnDocument: "after", returnOriginal: false }
      );
      if (!result) {
        return res.status(404).json({ message: "Member not found." });
      }
      const updatedMember = result;
      // Convert avatar path to full URL if present
      if (updatedMember.avatar) {
        const filename = updatedMember.avatar.split(/[\\/]/).pop();
        updatedMember.avatar = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
      }
      res.json({ message: "Member updated successfully.", ...updatedMember });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to update member.", error: err.message });
    }
  }
);

// Delete member endpoint (protected)
router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  let memberId;
  try {
    memberId = parseObjectId(id, "member id");
  } catch (e) {
    return res.status(400).json({ message: "Invalid member id format." });
  }
  try {
    const db = await getCrmDb();
    const membersCollection = db.collection("members");
    const usersCollection = db.collection("users");
    const profileCollection = db.collection("profile");
    const tasksCollection = db.collection("tasks");
    // Delete from members, users, and profile collections
    const memberResult = await membersCollection.findOneAndDelete({
      _id: memberId,
    });
    const userResult = await usersCollection.findOneAndDelete({
      _id: memberId,
    });
    const profileResult = await profileCollection.findOneAndDelete({
      _id: memberId,
    });
    // Remove memberId and memberProgress for this member from all tasks
    await tasksCollection.updateMany(
      {
        $or: [{ memberId: memberId }, { "memberProgress.memberId": memberId }],
      },
      {
        $pull: {
          memberId: memberId,
          memberProgress: { memberId: memberId },
        },
      }
    );
    if (!memberResult) {
      return res.status(404).json({ message: "Member not found." });
    }
    res.json({ message: "Member deleted successfully." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete member.", error: err.message });
  }
});

module.exports = router;
