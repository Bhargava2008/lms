const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const forgotPasswordController = require("../controllers/forgotPasswordController");

router.post("/forgot-password", forgotPasswordController.sendOtp);
router.post("/verify-otp", forgotPasswordController.verifyOtp);
router.post("/reset-password", forgotPasswordController.resetPassword);
router.post("/resend-otp", forgotPasswordController.resendOtp);
router.post("/", authController.handleLogin);

module.exports = router;
