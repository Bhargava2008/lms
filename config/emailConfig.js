const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test connection
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ EMAIL CONFIG: Configuration error:", error);
  } else {
    console.log("✅ EMAIL CONFIG: Email server is ready to send messages");
  }
});

module.exports = transporter;
