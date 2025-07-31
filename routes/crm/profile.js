const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { validateBody, Joi } = require("../../utils/validate");

const router = express.Router();

// Profile endpoint (protected)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const profileCollection = db.collection("profile");
    const profile = await profileCollection.findOne({ email: req.user.email });
    if (!profile) {
      return res.status(404).json({ message: "User not found." });
    }
    const { password, ...profileData } = profile;
    // Convert avatar path to full URL if present
    if (profileData.avatar) {
      const filename = profileData.avatar.split(/[\\/]/).pop();
      profileData.avatar = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${filename}`;
    }
    res.json(profileData);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch profile.", error: err.message });
  }
});

const editProfileSchema = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  dateOfBirth: Joi.string(),
  phone: Joi.string(),
  country: Joi.string(),
  city: Joi.string(),
  postalCode: Joi.string(),
  avatar: Joi.string(),
  position: Joi.string(),
});

// Edit profile endpoint (protected)
router.put(
  "/edit",
  authenticateJWT,
  validateBody(editProfileSchema),
  async (req, res) => {
    const {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      country,
      city,
      postalCode,
      avatar,
      position,
    } = req.body;

    // Build update object only with provided fields (role and email cannot be updated)
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (phone !== undefined) updateFields.phone = phone;
    if (country !== undefined) updateFields.country = country;
    if (city !== undefined) updateFields.city = city;
    if (postalCode !== undefined) updateFields.postalCode = postalCode;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (position !== undefined) updateFields.position = position;

    try {
      const db = await getCrmDb();
      const profileCollection = db.collection("profile");
      const mentorsCollection = db.collection("mentors");
      const membersCollection = db.collection("members");

      // Update profile
      const result = await profileCollection.findOneAndUpdate(
        { email: req.user.email },
        { $set: updateFields },
        { returnDocument: "after" }
      );

      // If role is Mentor or Member and position is being updated, update respective collection as well
      if (updateFields.position !== undefined) {
        const profileDoc = await profileCollection.findOne({
          email: req.user.email,
        });
        if (profileDoc && profileDoc.role === "Mentor") {
          await mentorsCollection.updateOne(
            { email: req.user.email },
            { $set: updateFields }
          );
        } else if (profileDoc && profileDoc.role === "Member") {
          await membersCollection.updateOne(
            { email: req.user.email },
            { $set: updateFields }
          );
        }
      }

      if (!result) {
        return res.status(404).json({ message: "Profile not found." });
      }
      const { password, ...profile } = result;
      // Convert avatar path to full URL if present
      if (profile.avatar) {
        const filename = profile.avatar.split(/[\\/]/).pop();
        profile.avatar = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
      }
      res.json({ message: "Profile updated successfully.", ...profile });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Profile update failed.", error: err.message });
    }
  }
);

router.get("/positions", authenticateJWT, (req, res) => {
  const positions = [
    "Front End Developer",
    "Back End Developer",
    "UI/UX Designer",
    "Data Scientist",
    "QA Engineer",
  ];
  res.json({ positions });
});

module.exports = router;
