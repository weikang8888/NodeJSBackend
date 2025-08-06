const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { validateBody, Joi } = require("../../utils/validate");

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER_EMAIL = process.env.GMAIL_USER;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const express = require("express");
const router = express.Router();

// Email validation schema
const emailSchema = Joi.object({
  firstName: Joi.string().required().messages({
    "string.empty": "First name is required",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().required().messages({
    "string.empty": "Last name is required",
    "any.required": "Last name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  phone: Joi.string().required().messages({
    "string.empty": "Phone number is required",
    "any.required": "Phone number is required",
  }),
  message: Joi.string().required().messages({
    "string.empty": "Message is required",
    "any.required": "Message is required",
  }),
  subject: Joi.string().optional(),
});

router.post("/send", validateBody(emailSchema), async (req, res) => {
  const { firstName, lastName, email, message, phone, subject } = req.body;

  try {
    const accessToken = await oAuth2Client.getAccessToken();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: USER_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    await transporter.sendMail({
      from: `"${firstName} ${lastName}" <${USER_EMAIL}>`,
      to: USER_EMAIL,
      subject: subject || "New Contact Form Message",
      text: `From: ${firstName} ${lastName} (${email})\nPhone: ${phone}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>New Contact Form Message</h3>
          <p><strong>From:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Subject:</strong> ${
            subject || "New Contact Form Message"
          }</p>
          <hr>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>
      `,
    });

    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ message: "Error sending email" });
  }
});

module.exports = router;
