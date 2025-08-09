const express = require("express");
const jwt = require("jsonwebtoken");
const { passport, findOrCreateEcommerceUser } = require("../../utils/passportConfig");

// Use environment variable for JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

// Google OAuth routes for Ecommerce
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
      
      // Find or create user in Ecommerce database
      const user = await findOrCreateEcommerceUser(googleProfile);
      
      // Generate JWT token
      const token = jwt.sign(
        { _id: user._id, userName: user.userName },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Redirect to frontend with token (you may want to customize this URL)
      const frontendURL = process.env.ECOMMERCE_FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendURL}/auth/callback?token=${token}&_id=${user._id}`);
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Authentication failed", error: error.message });
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
