const transporter = require("../config/emailConfig");

// Approval Email Function
const sendApprovalEmail = async (
  userEmail,
  userName,
  bookName,
  authorName,
  dueDate
) => {
  try {
    console.log(
      "📧 EMAIL SERVICE: Starting to send approval email to:",
      userEmail
    );

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "📚 Book Request Approved - Library Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">🎉 Book Request Approved!</h2>
          <p>Dear <strong>${userName}</strong>,</p>
          
          <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333;">Book Details:</h3>
            <p><strong>Book Title:</strong> ${bookName}</p>
            <p><strong>Author:</strong> ${authorName}</p>
            <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(
              dueDate
            ).toLocaleDateString()}</p>
            <p><strong>Borrowing Period:</strong> 15 days</p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #856404;">📋 Important Notes:</h4>
            <ul>
              <li>Please return the book on or before the due date</li>
              <li>Late returns will incur fines of $1 per day</li>
              <li>You can currently borrow up to 3 books at a time</li>
              <li>Take good care of the book</li>
            </ul>
          </div>

          <p>Thank you for using our library services!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
              Library Management System<br>
              This is an automated email - please do not reply
            </p>
          </div>
        </div>
      `,
    };

    console.log("📧 EMAIL SERVICE: Mail options prepared");
    console.log("📧 EMAIL SERVICE: From:", process.env.EMAIL_USER);
    console.log("📧 EMAIL SERVICE: To:", userEmail);

    // Test if transporter is working
    console.log("📧 EMAIL SERVICE: Testing transporter...");
    await transporter.verify();
    console.log("📧 EMAIL SERVICE: Transporter verified successfully");

    console.log("📧 EMAIL SERVICE: Attempting to send email...");
    const result = await transporter.sendMail(mailOptions);

    console.log("📧 EMAIL SERVICE: Email sent successfully!");
    console.log("📧 EMAIL SERVICE: Message ID:", result.messageId);
    console.log("📧 EMAIL SERVICE: Response:", result.response);

    return result;
  } catch (error) {
    console.error("❌ EMAIL SERVICE: Error sending approval email:", error);
    console.error("❌ EMAIL SERVICE: Error details:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    throw error;
  }
};

//Rejection Email function
const sendRejectionEmail = async (userEmail, userName, bookTitle) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "Book Request Rejected - EduLibrary",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">📚 EduLibrary - Book Request Update</h2>
          <p>Dear <strong>${userName}</strong>,</p>
          <p>We regret to inform you that your book request has been <strong>rejected</strong>.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
            <p><strong>Book:</strong> ${bookTitle}</p>
            <p><strong>Reason:</strong> Book unavailable or issued to another user</p>
          </div>
          <p>You can request other available books from our library.</p>
          <p>Thank you for using EduLibrary!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">EduLibrary Management System</p>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Rejection email sent to:", userEmail);
    return result;
  } catch (error) {
    console.error("❌ Error sending rejection email:", error);
    return null;
  }
};

// Due Today Reminder Email
const sendDueTodayReminder = async (userEmail, userName, bookName, dueDate) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "📚 REMINDER: Book Due Today - Return Immediately",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">⏰ Book Due Today!</h2>
          <p>Dear <strong>${userName}</strong>,</p>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404;">Urgent Reminder</h3>
            <p><strong>Book Title:</strong> ${bookName}</p>
            <p><strong>Due Date:</strong> <span style="color: #d32f2f; font-weight: bold;">TODAY (${new Date(
              dueDate
            ).toLocaleDateString()})</span></p>
          </div>

          <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #c62828;">⚠️ Important Notice:</h4>
            <ul>
              <li>Please return the book <strong>TODAY</strong> to avoid fines</li>
              <li>Fines of $1 per day will be charged from tomorrow</li>
              <li>Visit the library during working hours</li>
            </ul>
          </div>

          <p>Thank you for your immediate attention!</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Due today reminder sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending due today reminder:", error);
    throw error;
  }
};

// Overdue Warning Email
const sendOverdueWarning = async (
  userEmail,
  userName,
  bookName,
  overdueDays,
  fineAmount
) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `⚠️ OVERDUE BOOK: ${overdueDays} Day(s) Late - Fine: $${fineAmount}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">⚠️ Book Overdue!</h2>
          <p>Dear <strong>${userName}</strong>,</p>
          
          <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #c62828;">Overdue Notice</h3>
            <p><strong>Book Title:</strong> ${bookName}</p>
            <p><strong>Days Overdue:</strong> <span style="color: #d32f2f;">${overdueDays} day(s)</span></p>
            <p><strong>Current Fine:</strong> <span style="color: #d32f2f;">$${fineAmount}</span></p>
            <p><strong>Fine Increases:</strong> $1 per day until returned</p>
          </div>

          <div style="background: #f3e5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #7b1fa2;">📋 Required Action:</h4>
            <ul>
              <li>Return the book immediately to stop fine accumulation</li>
              <li>Pay the outstanding fine at the library counter</li>
              <li>Contact librarian if you have any questions</li>
            </ul>
          </div>

          <p>Please return the book as soon as possible to avoid further charges.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Overdue warning sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending overdue warning:", error);
    throw error;
  }
};

// Return Confirmation Email
const sendReturnConfirmation = async (
  userEmail,
  userName,
  bookName,
  issueDate,
  returnDate
) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "✅ Book Return Confirmed - Thank You!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">✅ Book Return Confirmed!</h2>
          <p>Dear <strong>${userName}</strong>,</p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2e7d32;">Return Details</h3>
            <p><strong>Book Title:</strong> ${bookName}</p>
            <p><strong>Issued On:</strong> ${new Date(
              issueDate
            ).toLocaleDateString()}</p>
            <p><strong>Returned On:</strong> ${new Date(
              returnDate
            ).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span style="color: #4CAF50;">Successfully Returned</span></p>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #1565c0;">📚 What's Next?</h4>
            <ul>
              <li>You can now borrow other available books</li>
              <li>Remember the 3-book limit policy</li>
              <li>Visit our library for more great books!</li>
            </ul>
          </div>

          <p>Thank you for using our library services!</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Return confirmation sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending return confirmation:", error);
    throw error;
  }
};

// OTP Email Function for Password Reset
const sendOtpEmail = async (to, otp, studentName) => {
  try {
    console.log("📧 EMAIL SERVICE: Starting to send OTP email to:", to);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "🔐 Password Reset OTP - College Library",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">College Library</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Password Reset OTP</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${studentName},</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              You requested to reset your password for the Library Management System. 
              Use the OTP below to verify your identity:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 42px; font-weight: bold; color: #667eea; letter-spacing: 8px; 
                         background: white; padding: 20px; border-radius: 10px; border: 2px dashed #667eea;">
                ${otp}
              </div>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ Important:</h4>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li>This OTP will expire in <strong>5 minutes</strong></li>
                <li>Do not share this OTP with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Thank you for using our library services!<br>
              <strong>Engineering College Library</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd;">
            <p style="margin: 0;">
              Library Management System<br>
              This is an automated email - please do not reply
            </p>
          </div>
        </div>
      `,
    };

    console.log("📧 EMAIL SERVICE: OTP mail options prepared");
    console.log("📧 EMAIL SERVICE: From:", process.env.EMAIL_USER);
    console.log("📧 EMAIL SERVICE: To:", to);
    console.log("📧 EMAIL SERVICE: OTP:", otp);

    // Test if transporter is working
    console.log("📧 EMAIL SERVICE: Testing transporter...");
    await transporter.verify();
    console.log("📧 EMAIL SERVICE: Transporter verified successfully");

    console.log("📧 EMAIL SERVICE: Attempting to send OTP email...");
    const result = await transporter.sendMail(mailOptions);

    console.log("📧 EMAIL SERVICE: OTP email sent successfully!");
    console.log("📧 EMAIL SERVICE: Message ID:", result.messageId);
    console.log("📧 EMAIL SERVICE: Response:", result.response);

    return result;
  } catch (error) {
    console.error("❌ EMAIL SERVICE: Error sending OTP email:", error);
    console.error("❌ EMAIL SERVICE: Error details:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    throw error;
  }
};

// Export all functions
module.exports = {
  sendRejectionEmail,
  sendApprovalEmail,
  sendDueTodayReminder,
  sendOverdueWarning,
  sendReturnConfirmation,
  sendOtpEmail,
};
