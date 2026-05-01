class ForgotPassword {
  constructor() {
    this.currentStep = 1;
    this.studentId = "";
    this.email = "";
    this.otp = "";
    this.timerInterval = null;

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Student ID form
    document
      .getElementById("studentIdForm")
      .addEventListener("submit", (e) => this.handleStudentIdSubmit(e));

    // OTP form
    document
      .getElementById("otpForm")
      .addEventListener("submit", (e) => this.handleOtpSubmit(e));

    // Password form
    document
      .getElementById("passwordForm")
      .addEventListener("submit", (e) => this.handlePasswordSubmit(e));

    // Resend OTP
    document
      .getElementById("resendOtpLink")
      .addEventListener("click", (e) => this.handleResendOtp(e));

    // Back buttons
    document
      .getElementById("backToStudentId")
      .addEventListener("click", (e) => this.goBackToStep(1));
    document
      .getElementById("backToOtp")
      .addEventListener("click", (e) => this.goBackToStep(2));

    // Real-time validation
    document
      .getElementById("studentId")
      .addEventListener("input", (e) => this.validateStudentId(e.target.value));
    document
      .getElementById("otp")
      .addEventListener("input", (e) => this.validateOtp(e.target.value));
    document
      .getElementById("confirmPassword")
      .addEventListener("input", (e) => this.validatePassword());
  }

  async handleStudentIdSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById("studentId").value.trim();

    if (!this.validateStudentId(studentId)) {
      return;
    }

    this.showLoading("emailSpinner", "sendOtpBtn");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      const data = await response.json();

      if (response.ok) {
        this.studentId = studentId;
        this.email = data.email; // Store the email for display
        this.showStep(2);
        this.startTimer();
        this.updateEmailInfo();
      } else {
        this.showError(
          "studentIdError",
          data.message || "Student ID not found"
        );
      }
    } catch (error) {
      this.showError("studentIdError", "Network error. Please try again.");
    } finally {
      this.hideLoading("emailSpinner", "sendOtpBtn");
    }
  }

  async handleOtpSubmit(e) {
    e.preventDefault();
    const otp = document.getElementById("otp").value.trim();

    if (!this.validateOtp(otp)) {
      return;
    }

    this.showLoading("otpSpinner", "verifyOtpBtn");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: this.studentId,
          otp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        this.otp = otp;
        this.showStep(3);
        this.stopTimer();
      } else {
        this.showError("otpError", data.message || "Invalid OTP");
      }
    } catch (error) {
      this.showError("otpError", "Network error. Please try again.");
    } finally {
      this.hideLoading("otpSpinner", "verifyOtpBtn");
    }
  }

  async handlePasswordSubmit(e) {
    e.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!this.validatePassword()) {
      return;
    }

    this.showLoading("passwordSpinner", "resetPasswordBtn");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: this.studentId,
          otp: this.otp,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showSuccess();
      } else {
        this.showError(
          "passwordError",
          data.message || "Password reset failed"
        );
      }
    } catch (error) {
      this.showError("passwordError", "Network error. Please try again.");
    } finally {
      this.hideLoading("passwordSpinner", "resetPasswordBtn");
    }
  }

  async handleResendOtp(e) {
    e.preventDefault();

    this.showLoading("otpSpinner", "verifyOtpBtn");

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId: this.studentId }),
      });

      const data = await response.json();

      if (response.ok) {
        this.startTimer();
        alert("OTP has been resent to your email");
      } else {
        alert(data.message || "Failed to resend OTP");
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      this.hideLoading("otpSpinner", "verifyOtpBtn");
    }
  }

  validateStudentId(studentId) {
    // Clear any previous errors first
    this.clearError("studentIdError");

    // Only check if it's empty
    if (!studentId || studentId.trim() === "") {
      this.showError("studentIdError", "Student ID is required");
      return false;
    }

    // Accept any non-empty input
    return true;
  }
  validateOtp(otp) {
    const pattern = /^[0-9]{6}$/;

    if (!pattern.test(otp)) {
      this.showError("otpError", "Please enter a valid 6-digit OTP");
      return false;
    }

    this.clearError("otpError");
    return true;
  }

  validatePassword() {
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const errorElement = document.getElementById("passwordError");

    if (newPassword.length < 6) {
      this.showError(
        "passwordError",
        "Password must be at least 6 characters long"
      );
      return false;
    }

    if (newPassword !== confirmPassword) {
      this.showError("passwordError", "Passwords do not match");
      return false;
    }

    this.clearError("passwordError");
    return true;
  }

  showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll(".step").forEach((step) => {
      step.classList.add("hidden");
    });

    // Show current step
    document.getElementById(`step${stepNumber}`).classList.remove("hidden");
    this.currentStep = stepNumber;
  }

  goBackToStep(stepNumber) {
    this.showStep(stepNumber);
  }

  updateEmailInfo() {
    const emailInfo = document.getElementById("emailInfo");
    if (this.email) {
      const maskedEmail = this.maskEmail(this.email);
      emailInfo.textContent = `OTP sent to ${maskedEmail}`;
    }
  }

  maskEmail(email) {
    const [localPart, domain] = email.split("@");
    const maskedLocal =
      localPart.substring(0, 2) +
      "***" +
      localPart.substring(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  startTimer() {
    let timeLeft = 300; // 5 minutes in seconds
    const countdownElement = document.getElementById("countdown");
    const resendLink = document.getElementById("resendOtpLink");

    resendLink.style.pointerEvents = "none";
    resendLink.style.color = "#6c757d";

    this.stopTimer(); // Clear any existing timer

    this.timerInterval = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;

      countdownElement.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      if (timeLeft <= 0) {
        this.stopTimer();
        countdownElement.textContent = "00:00";
        resendLink.style.pointerEvents = "auto";
        resendLink.style.color = "#667eea";
      }

      timeLeft--;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  showLoading(spinnerId, buttonId) {
    document.getElementById(spinnerId).classList.remove("hidden");
    document.getElementById(buttonId).disabled = true;
  }

  hideLoading(spinnerId, buttonId) {
    document.getElementById(spinnerId).classList.add("hidden");
    document.getElementById(buttonId).disabled = false;
  }

  showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = "block";
  }

  clearError(elementId) {
    const element = document.getElementById(elementId);
    element.textContent = "";
    element.style.display = "none";
  }

  showSuccess() {
    document.querySelectorAll(".step").forEach((step) => {
      step.classList.add("hidden");
    });
    document.getElementById("successMessage").classList.remove("hidden");
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ForgotPassword();
});
