const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { ObjectId } = require("mongodb");

const router = express.Router();

// Profile endpoint (protected)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const profileCollection = db.collection("profile");
    const profile = await profileCollection.findOne({
      _id: new ObjectId(req.user._id),
    });
    if (!profile) {
      return res.status(404).json({ message: "ID not found." });
    }
    res.json(profile);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch profile.", error: err.message });
  }
});

// Create or update billing details for current user
router.post("/billing/create", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const profileCollection = db.collection("profile");
    const billing = req.body;
    // You may want to validate billing fields here
    const result = await profileCollection.updateOne(
      { _id: new ObjectId(req.user._id) },
      { $set: { billing } },
      { upsert: true }
    );
    res.json({ message: "Billing details saved." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to save billing details.", error: err.message });
  }
});

module.exports = router;
