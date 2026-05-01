const express = require("express");
const router = express.Router();
const forgotPasswordController = require("../../controllers/forgotPasswordController");

router.post("/forgot-password", forgotPasswordController.sendOtp);
router.post("/verify-otp", forgotPasswordController.verifyOtp);
router.post("/reset-password", forgotPasswordController.resetPassword);
router.post("/resend-otp", forgotPasswordController.resendOtp);

module.exports = router;
