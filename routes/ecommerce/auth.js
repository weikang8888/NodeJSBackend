const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const getEcommerceDb = require("./index");
const { validateBody, Joi } = require("../../utils/validate");

// Use environment variable for JWT secret, fallback for development
const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

const loginSchema = Joi.object({
  userName: Joi.string().required(),
  password: Joi.string().required(),
});
router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { userName, password } = req.body;
  try {
    const db = await getEcommerceDb();
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ userName });
    if (!user) {
      return res.status(401).json({ message: "Username not registered." });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Password is incorrect." });
    }
    const token = jwt.sign(
      { _id: user._id, userName: user.userName },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    res.json({
      message: "Login successful.",
      token,
      _id: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

module.exports = router;

const registerSchema = Joi.object({
  userName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
router.post("/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, userName } = req.body;
  try {
    const db = await getEcommerceDb();
    const usersCollection = db.collection("users");

    // Check for duplicate userName
    const existingUserName = await usersCollection.findOne({ userName });
    if (existingUserName) {
      return res.status(409).json({ message: "Username already taken." });
    }
    // Check for duplicate email
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = new ObjectId();
    await usersCollection.insertOne({
      _id: userId,
      email,
      userName: userName,
      password: hashedPassword,
    });

    // Store profile info
    const profileCollection = db.collection("profile");
    await profileCollection.insertOne({
      _id: userId,
      userName: userName,
      email: email,
    });

    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Registration failed.", error: err.message });
  }
});

module.exports = router;