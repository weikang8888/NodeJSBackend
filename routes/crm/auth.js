const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const getCrmDb = require("./index");
const { validateBody, Joi } = require("../../utils/validate");
const { authenticateJWT } = require("../../utils/authMiddleware");

// Use environment variable for JWT secret, fallback for development
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

const router = express.Router();

// Register endpoint
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  role: Joi.string().valid("Admin", "Mentor", "Member").required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
});
router.post("/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, role, firstName, lastName } = req.body;
  try {
    const db = await getCrmDb();
    const usersCollection = db.collection("users");
    const profileCollection = db.collection("profile");
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Generate a new ObjectId to use for all related documents
    const userId = new ObjectId();
    // Insert user with the generated _id
    await usersCollection.insertOne({
      _id: userId,
      email,
      password: hashedPassword,
      role,
      hasRandomPassword: false, // Manually registered users don't have random passwords
    });
    // Insert profile with the same _id
    await profileCollection.insertOne({
      _id: userId,
      email,
      firstName,
      lastName,
      role,
    });
    // Also insert into mentors or members collection if applicable, using the same _id
    if (role === "Mentor") {
      const mentorsCollection = db.collection("mentors");
      await mentorsCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        avatar: "",
        position: "",
        createdAt: new Date().toISOString(),
        email,
      });
    } else if (role === "Member") {
      const membersCollection = db.collection("members");
      await membersCollection.insertOne({
        _id: userId,
        firstName: firstName,
        lastName: lastName,
        avatar: "",
        position: "",
        createdAt: new Date().toISOString(),
        email,
      });
    }
    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Registration failed.", error: err.message });
  }
});

// Login endpoint
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const db = await getCrmDb();
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Email not registered." });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Password is incorrect." });
    }
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Check if user has random password and needs to change it
    const needsPasswordChange = user.hasRandomPassword === true;

    res.json({
      message: "Login successful.",
      token,
      role: user.role,
      _id: user._id,
      needsPasswordChange,
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

// Change password endpoint (protected)
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

router.post(
  "/change-password",
  authenticateJWT,
  validateBody(changePasswordSchema),
  async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { email } = req.user;

    try {
      const db = await getCrmDb();
      const usersCollection = db.collection("users");

      // Find user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password and remove random password flag
      await usersCollection.updateOne(
        { email },
        {
          $set: {
            password: hashedNewPassword,
            hasRandomPassword: false,
          },
        }
      );

      res.json({ message: "Password changed successfully." });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to change password.", error: err.message });
    }
  }
);

module.exports = router;
