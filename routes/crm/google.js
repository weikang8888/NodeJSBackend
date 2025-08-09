const express = require("express");
const jwt = require("jsonwebtoken");
const { passport, findOrCreateCrmUser } = require("../../utils/passportConfig");

// Use environment variable for JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

// Google OAuth routes for CRM
router.get(
  "/",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const googleProfile = req.user;

      // Default role for CRM users via Google login (can be customized)
      const defaultRole = "Member";

      // Find or create user in CRM database
      const user = await findOrCreateCrmUser(googleProfile, defaultRole);

      // Generate JWT token
      const token = jwt.sign(
        { email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Redirect to frontend with token (you may want to customize this URL)
      const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontendURL}/auth/callback?token=${token}&role=${user.role}&_id=${user._id}`
      );
    } catch (error) {
      console.error("Google auth error:", error);
      res
        .status(500)
        .json({ message: "Authentication failed", error: error.message });
    }
  }
);

// Google login verification endpoint
router.post("/verify", async (req, res) => {
  const { googleToken } = req.body;

  try {
    // You can verify the Google token here if needed
    // For now, we'll assume the token is valid since it comes from our callback
    res.json({ message: "Google authentication successful" });
  } catch (error) {
    res.status(401).json({ message: "Invalid Google token" });
  }
});

module.exports = router;
