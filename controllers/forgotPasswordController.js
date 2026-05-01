const User = require("../model/User");
const emailService = require("../services/emailService");
const bcrypt = require("bcrypt");

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

const forgotPasswordController = {
  // Send OTP to student's email
  async sendOtp(req, res) {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }

      console.log("Looking for student ID:", studentId); // Debug log

      // Find user by student ID
      const user = await User.findOne({ id: studentId });

      if (!user) {
        console.log("User not found for ID:", studentId); // Debug log
        return res.status(404).json({ message: "Student ID not found" });
      }

      console.log("User found:", user.email); // Debug log

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Store OTP with expiration
      otpStore.set(studentId, {
        otp,
        expiresAt,
        email: user.email,
        verified: false,
      });

      console.log("OTP generated for:", user.email); // Debug log

      // Send OTP via email
      try {
        await emailService.sendOtpEmail(user.email, otp, user.name);
        console.log("OTP email sent successfully to:", user.email); // Debug log

        res.json({
          message: "OTP sent successfully",
          email: user.email, // Return email for frontend display
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        return res.status(500).json({ message: "Failed to send OTP email" });
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  // Verify OTP
  async verifyOtp(req, res) {
    try {
      const { studentId, otp } = req.body;

      if (!studentId || !otp) {
        return res
          .status(400)
          .json({ message: "Student ID and OTP are required" });
      }

      const storedData = otpStore.get(studentId);

      if (!storedData) {
        return res.status(400).json({
          message: "OTP not found or expired. Please request a new OTP.",
        });
      }

      if (Date.now() > storedData.expiresAt) {
        otpStore.delete(studentId);
        return res
          .status(400)
          .json({ message: "OTP has expired. Please request a new OTP." });
      }

      if (storedData.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Mark OTP as verified
      storedData.verified = true;
      otpStore.set(studentId, storedData);

      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  // Reset password after OTP verification
  async resetPassword(req, res) {
    try {
      const { studentId, otp, newPassword } = req.body;

      if (!studentId || !otp || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters long" });
      }

      const storedData = otpStore.get(studentId);

      if (!storedData) {
        return res
          .status(400)
          .json({ message: "Session expired. Please start over." });
      }

      if (!storedData.verified || storedData.otp !== otp) {
        return res.status(400).json({ message: "OTP verification failed" });
      }

      if (Date.now() > storedData.expiresAt) {
        otpStore.delete(studentId);
        return res.status(400).json({ message: "OTP has expired" });
      }

      // Find user and update password
      const user = await User.findOne({ id: studentId });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      await user.save();

      // Clear OTP after successful password reset
      otpStore.delete(studentId);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  // Resend OTP
  async resendOtp(req, res) {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }

      // Find user
      const user = await User.findOne({ id: studentId });

      if (!user) {
        return res.status(404).json({ message: "Student ID not found" });
      }

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Update stored OTP
      otpStore.set(studentId, {
        otp,
        expiresAt,
        email: user.email,
        verified: false,
      });

      // Send new OTP via email
      try {
        await emailService.sendOtpEmail(user.email, otp, user.name);

        res.json({
          message: "OTP resent successfully",
          email: user.email,
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        return res.status(500).json({ message: "Failed to send OTP email" });
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

// Clean up expired OTPs every hour
setInterval(() => {
  const now = Date.now();
  for (const [studentId, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(studentId);
    }
  }
}, 60 * 60 * 1000);

module.exports = forgotPasswordController;
