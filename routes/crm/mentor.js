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

const createMentorSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  position: Joi.string().required(),
});

const editMentorSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  position: Joi.string(),
});

// Create mentor endpoint (protected)
router.post(
  "/create",
  authenticateJWT,
  validateBody(createMentorSchema),
  async (req, res) => {
    const { email, firstName, lastName, position } = req.body;
    try {
      const db = await getCrmDb();
      const usersCollection = db.collection("users");
      const mentorsCollection = db.collection("mentors");
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
        role: "Mentor",
        hasRandomPassword: true, // Flag to track if user has random password
      });
      const userId = userInsertResult.insertedId;
      await mentorsCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        email,
        position,
        createdAt: new Date().toISOString(),
      });
      await profileCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        email,
        role: "Mentor",
        position,
      });
      res.status(201).json({
        message: "Mentor created successfully.",
        mentorId: userId,
        generatedPassword,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create mentor.", error: err.message });
    }
  }
);

// Get all mentors endpoint (protected)
router.get("/list", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const mentorsCollection = db.collection("mentors");
    const tasksCollection = db.collection("tasks");
    const mentors = await mentorsCollection.find({}).toArray();
    for (const mentor of mentors) {
      if (mentor.avatar) {
        const filename = mentor.avatar.split(/[\\/]/).pop();
        mentor.avatar = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
      }
      // Count tasks assigned to this mentor
      mentor.task = await tasksCollection.countDocuments({
        mentorId: mentor._id,
      });
    }
    res.json({ mentors });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch mentors.", error: err.message });
  }
});

// Edit mentor endpoint (protected)
router.put(
  "/edit/:id",
  authenticateJWT,
  validateBody(editMentorSchema),
  async (req, res) => {
    const { id } = req.params;
    let mentorId;
    try {
      mentorId = parseObjectId(id, "mentor id");
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    const updateFields = {};
    const { firstName, lastName, position } = req.body;
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (position !== undefined) updateFields.position = position;
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields provided to update." });
    }
    try {
      const db = await getCrmDb();
      const mentorsCollection = db.collection("mentors");
      const result = await mentorsCollection.findOneAndUpdate(
        { _id: mentorId },
        { $set: updateFields },
        { returnDocument: "after", returnOriginal: false }
      );
      if (!result) {
        return res.status(404).json({ message: "Mentor not found." });
      }
      const updatedMentor = result;
      res.json({ message: "Mentor updated successfully.", ...updatedMentor });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to update mentor.", error: err.message });
    }
  }
);

// Delete mentor endpoint (protected)
router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  let mentorId;
  try {
    mentorId = parseObjectId(id, "mentor id");
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  try {
    const db = await getCrmDb();
    const mentorsCollection = db.collection("mentors");
    const usersCollection = db.collection("users");
    const profileCollection = db.collection("profile");
    const tasksCollection = db.collection("tasks"); // Add this line to get the tasks collection
    // Delete from mentors, users, and profile collections
    const mentorResult = await mentorsCollection.findOneAndDelete({
      _id: mentorId,
    });
    const userResult = await usersCollection.findOneAndDelete({
      _id: mentorId,
    });
    const profileResult = await profileCollection.findOneAndDelete({
      _id: mentorId,
    });
    // Remove mentorId from all tasks that reference this mentor
    await tasksCollection.updateMany(
      { mentorId: mentorId },
      { $unset: { mentorId: "" } }
    );
    if (!mentorResult) {
      return res.status(404).json({ message: "Mentor not found." });
    }
    res.json({ message: "Mentor deleted successfully." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete mentor.", error: err.message });
  }
});

module.exports = router;
