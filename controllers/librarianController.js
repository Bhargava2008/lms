const User = require("../model/User");
const BookModel = require("../model/Book");
const Issue = require("../model/Issue");
const ApprovedBook = require("../model/ApprovedBook");
const Fine = require("../model/Fine");
const {
  sendRejectionEmail,
  sendApprovalEmail,
  sendDueTodayReminder,
  sendOverdueWarning,
  sendReturnConfirmation,
} = require("../services/emailService");

// -------------------- Helper Functions --------------------

const calculateFine = (issueDate) => {
  const today = new Date();
  const issue = new Date(issueDate);
  const overdueDays = Math.ceil((today - issue) / (1000 * 60 * 60 * 24)) - 15;
  return overdueDays > 0 ? overdueDays : 0;
};

// Auto process overdue books - Only for ApprovedBook
const processOverdues = async () => {
  const today = new Date();

  try {
    // Find due today books from ApprovedBook
    const dueTodayBooks = await ApprovedBook.find({
      status: "issued",
      issueDate: {
        $lte: new Date(
          today.getTime() - 15 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });

    // Send due today reminders
    dueTodayBooks.forEach(async (book) => {
      try {
        const user = await User.findOne({ id: book.userId });
        const bookDetails = await BookModel.findOne({ isbn: book.bookId });

        if (user && user.email && bookDetails) {
          await sendDueTodayReminder(
            user.email,
            user.name || "Student",
            bookDetails.bookName || "Unknown Book",
            book.dueDate
          );
          console.log(`✅ Sent due today reminder to ${user.email}`);
        }
      } catch (error) {
        console.error("❌ Error sending due today reminder:", error);
      }
    });

    // Find overdue books from ApprovedBook
    const overdueBooks = await ApprovedBook.find({
      status: "issued",
      issueDate: {
        $lte: new Date(
          today.getTime() - 16 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });

    if (overdueBooks.length === 0) return;

    for (const book of overdueBooks) {
      const overdueDays = calculateFine(book.issueDate);

      // Update status in ApprovedBook
      book.status = "overdue";
      book.overdueDays = overdueDays;
      await book.save();

      // Add to fines collection
      const existingFine = await Fine.findOne({
        bookId: book.bookId,
        userId: book.userId,
        status: "overdue",
      });

      if (!existingFine) {
        const bookDetails = await BookModel.findOne({ isbn: book.bookId });
        const fineRecord = {
          bookId: book.bookId,
          userId: book.userId,
          bookTitle: bookDetails ? bookDetails.bookName : "Unknown Book",
          bookAuthor: bookDetails ? bookDetails.authorName : "Unknown Author",
          issueDate: book.issueDate,
          dueDate: book.dueDate,
          overdueDays: overdueDays,
          fineAmount: overdueDays * 1,
          status: "overdue",
        };

        await Fine.create(fineRecord);

        // Send overdue warning email
        try {
          const user = await User.findOne({ id: book.userId });
          if (user && user.email && bookDetails) {
            await sendOverdueWarning(
              user.email,
              user.name || "Student",
              bookDetails.bookName || "Unknown Book",
              overdueDays,
              fineRecord.fineAmount
            );
            console.log(`✅ Sent overdue warning to ${user.email}`);
          }
        } catch (error) {
          console.error("❌ Error sending overdue warning:", error);
        }
      }
    }

    console.log(
      `✅ Processed ${dueTodayBooks.length} due today reminders and ${overdueBooks.length} overdue books`
    );
  } catch (error) {
    console.error("❌ Error in processOverdues:", error);
  }
};

// Run on server start and every minute
processOverdues();
setInterval(processOverdues, 60 * 1000);

// -------------------- Dashboard Metrics --------------------

const getTotalBooks = async (req, res) => {
  try {
    const totalBooks = await BookModel.countDocuments();
    res.json({ total: totalBooks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBooksIssued = async (req, res) => {
  try {
    const issuedCount = await ApprovedBook.countDocuments({ status: "issued" });
    res.json({ issued: issuedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOverdueBooks = async (req, res) => {
  try {
    const overdueCount = await Fine.countDocuments({ status: "overdue" });
    res.json({ overdue: overdueCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingRequestsCount = async (req, res) => {
  try {
    const pendingCount = await Issue.countDocuments();
    res.json({ pending: pendingCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFinesCollected = async (req, res) => {
  try {
    const paidFines = await Fine.find({ status: "paid" });
    const totalCollected = paidFines.reduce(
      (sum, fine) => sum + (fine.fineAmount || 0),
      0
    );
    res.json({ collected: totalCollected });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getActiveUsers = async (req, res) => {
  try {
    const activeUsers = await User.countDocuments();
    res.json({ activeUsers: activeUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------- Book Management --------------------

const getAllBooks = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const term = search.trim();
      query = {
        $or: [
          { bookName: { $regex: term, $options: "i" } },
          { authorName: { $regex: term, $options: "i" } },
          { isbn: { $regex: term, $options: "i" } },
          { department: { $regex: term, $options: "i" } },
        ],
      };
    }

    const books = await BookModel.find(query);
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBook = async (req, res) => {
  try {
    const { bookName, authorName, isbn, department } = req.body;

    if (!bookName || !authorName || !isbn || !department) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const duplicate = await BookModel.findOne({ isbn: isbn });
    if (duplicate) {
      return res
        .status(409)
        .json({ message: "Book with this ISBN already exists" });
    }

    const newBook = await BookModel.create({
      bookName,
      authorName,
      isbn,
      department,
      status: "available",
    });

    res.status(201).json({ success: `Book "${bookName}" added.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBook = async (req, res) => {
  try {
    const bookId = req.params.id;
    const { bookName, authorName, isbn, department } = req.body;

    const book = await BookModel.findOne({ isbn: bookId });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (isbn && isbn !== bookId) {
      const existingBook = await BookModel.findOne({ isbn: isbn });
      if (existingBook) {
        return res
          .status(409)
          .json({ message: "Book with this ISBN already exists" });
      }
    }

    if (bookName) book.bookName = bookName;
    if (authorName) book.authorName = authorName;
    if (department) book.department = department;
    if (isbn) book.isbn = isbn;

    await book.save();
    res.json({ message: "Book updated", book: book });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteBook = async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await BookModel.findOne({ isbn: bookId });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.status !== "available") {
      return res.status(400).json({
        message: "Cannot delete issued book. Please process return first.",
      });
    }

    await BookModel.deleteOne({ isbn: bookId });
    res.json({ message: "Book deleted", deletedBook: book });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------- Request Management --------------------

const getPendingRequests = async (req, res) => {
  try {
    const pendingRequests = await Issue.find();

    const enrichedRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const book = await BookModel.findOne({ isbn: request.bookId });
        const user = await User.findOne({ id: request.userId });

        return {
          id: request._id.toString(),
          bookId: request.bookId,
          userId: request.userId,
          requestDate: request.requestDate || request.createdAt,
          bookTitle: book ? book.bookName : "Unknown Book",
          bookAuthor: book ? book.authorName : "Unknown Author",
          userName: user ? user.name : `User ID: ${request.userId}`,
          userEmail: user ? user.email : "N/A",
        };
      })
    );

    res.json(enrichedRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔄 approveRequest called with request ID:", id);

    // Find the pending request
    const request = await Issue.findById(id);
    if (!request) {
      return res.status(400).json({ message: "Request not found" });
    }

    console.log("✅ Processing request for user:", request.userId);

    // Check 3-book limit using ApprovedBook
    const userIssuedBooks = await ApprovedBook.find({
      userId: request.userId,
      status: { $in: ["issued", "overdue"] },
    });

    if (userIssuedBooks.length >= 3) {
      return res.status(400).json({
        message:
          "User already has 3 books issued. Cannot approve this request.",
      });
    }

    // Check if book exists
    const book = await BookModel.findOne({ isbn: request.bookId });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Check if book is already issued
    const alreadyIssued = await ApprovedBook.findOne({
      bookId: request.bookId,
      status: { $in: ["issued", "overdue"] },
    });

    if (alreadyIssued) {
      return res.status(400).json({
        message: "Book is already issued to another user.",
      });
    }

    // ✅ STEP 1: Update book status to "issued"
    book.status = "issued";
    await book.save();

    // ✅ STEP 2: Calculate due date
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(issueDate.getDate() + 15);

    // ✅ STEP 3: Create record in ApprovedBook
    const approvedBook = await ApprovedBook.create({
      bookId: request.bookId,
      userId: request.userId,
      issueDate: issueDate.toISOString().split("T")[0],
      dueDate: dueDate.toISOString().split("T")[0],
      status: "issued",
    });

    // ✅ STEP 4: Delete from Issue collection
    await Issue.findByIdAndDelete(id);

    // ✅ STEP 5: Send approval email
    let emailSent = false;
    try {
      const user = await User.findOne({ id: request.userId });
      if (user && user.email && book) {
        await sendApprovalEmail(
          user.email,
          user.name || "Student",
          book.bookName || "Unknown Book",
          book.authorName || "Unknown Author",
          approvedBook.dueDate
        );
        emailSent = true;
      }
    } catch (emailError) {
      console.error("❌ Error sending approval email:", emailError);
    }

    console.log("✅ Request approved and moved to ApprovedBook");
    res.json({
      message: "Book issued successfully",
      approvedBook: approvedBook,
      emailSent: emailSent,
    });
  } catch (error) {
    console.error("❌ Error in approveRequest:", error);
    res
      .status(500)
      .json({ message: "Internal server error: " + error.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the request
    const request = await Issue.findById(id);
    if (!request) {
      return res.status(400).json({ message: "Request not found" });
    }

    // ✅ Simply delete from Issue collection
    await Issue.findByIdAndDelete(id);

    // Send rejection email
    let emailSent = false;
    try {
      const user = await User.findOne({ id: request.userId });
      const book = await BookModel.findOne({ isbn: request.bookId });

      if (user && user.email && book) {
        await sendRejectionEmail(
          user.email,
          user.name || "Student",
          book.bookName || "Unknown Book"
        );
        emailSent = true;
      }
    } catch (error) {
      console.error("❌ Error sending rejection email:", error);
    }

    res.json({
      message: "Request rejected successfully",
      emailSent: emailSent,
    });
  } catch (error) {
    console.error("Error in rejectRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// -------------------- Direct Issue (Librarian) --------------------

const issueBook = async (req, res) => {
  const requestId = Date.now();
  console.log(
    `🆔 [${requestId}] STARTING DIRECT ISSUE - BookID: ${req.body.bookId}, UserID: ${req.body.userId}`
  );

  try {
    const { bookId, userId } = req.body;
    console.log(`🆔 [${requestId}] Processing direct issue...`);

    // ✅ STEP 1: Validate input
    if (!bookId || !userId) {
      console.log(`❌ [${requestId}] Missing bookId or userId`);
      return res.status(400).json({
        message: "Book ID and User ID are required",
        errorType: "MISSING_FIELDS",
      });
    }

    // ✅ STEP 2: Check if user exists
    const user = await User.findOne({ id: userId });
    if (!user) {
      console.log(`❌ [${requestId}] User not found: ${userId}`);
      return res.status(400).json({
        message: `User with ID "${userId}" not found. Please check the User ID.`,
        errorType: "USER_NOT_FOUND",
      });
    }
    console.log(`✅ [${requestId}] User found: ${user.name}`);

    // ✅ STEP 3: Check if user already has 3 issued/overdue books
    const userIssuedBooks = await ApprovedBook.find({
      userId: userId,
      status: { $in: ["issued", "overdue"] },
    });

    if (userIssuedBooks.length >= 3) {
      console.log(
        `❌ [${requestId}] User has ${userIssuedBooks.length} books - limit reached`
      );
      return res.status(400).json({
        message: `User already has ${userIssuedBooks.length} books issued. Maximum limit is 3 books per user.`,
        errorType: "BOOK_LIMIT_REACHED",
        currentCount: userIssuedBooks.length,
      });
    }

    // ✅ STEP 4: Check if book exists
    const book = await BookModel.findOne({ isbn: bookId });
    if (!book) {
      console.log(`❌ [${requestId}] Book not found: ${bookId}`);
      return res.status(400).json({
        message: `Book with ID "${bookId}" not found.`,
        errorType: "BOOK_NOT_FOUND",
      });
    }

    // ✅ STEP 5: Check if book is already issued to ANY user
    const existingIssue = await ApprovedBook.findOne({
      bookId: bookId,
      status: { $in: ["issued", "overdue"] },
    });

    if (existingIssue) {
      console.log(
        `❌ [${requestId}] Book already issued to user: ${existingIssue.userId}`
      );
      return res.status(400).json({
        message: `Book "${book.bookName}" is already issued to another user.`,
        errorType: "BOOK_ALREADY_ISSUED",
      });
    }

    // ✅ STEP 6: Check if the same user already has this book
    const userHasSameBook = await ApprovedBook.findOne({
      bookId: bookId,
      userId: userId,
      status: { $in: ["issued", "overdue"] },
    });

    if (userHasSameBook) {
      console.log(`❌ [${requestId}] User already has this book`);
      return res.status(400).json({
        message: `User already has this book issued.`,
        errorType: "DUPLICATE_BOOK_ISSUE",
      });
    }

    // ✅ STEP 7: Check if book is available
    if (book.status !== "available") {
      console.log(
        `❌ [${requestId}] Book not available. Status: ${book.status}`
      );
      return res.status(400).json({
        message: `Book "${book.bookName}" is not available for issue. Current status: ${book.status}`,
        errorType: "BOOK_NOT_AVAILABLE",
      });
    }

    // ✅ STEP 8: Update book status to "issued"
    console.log(
      `📚 [${requestId}] Updating book status from "${book.status}" to "issued"`
    );
    book.status = "issued";
    await book.save();
    console.log(`✅ [${requestId}] Book status updated to issued`);

    // ✅ STEP 9: Remove any pending requests for this book (cleanup)
    const pendingRequests = await Issue.find({
      bookId: bookId,
    });

    if (pendingRequests.length > 0) {
      await Issue.deleteMany({ bookId: bookId });
      console.log(
        `✅ [${requestId}] Removed ${pendingRequests.length} pending requests for this book`
      );
    }

    // ✅ STEP 10: Calculate due date (15 days from now)
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(issueDate.getDate() + 15);
    console.log(
      `✅ [${requestId}] Due date: ${dueDate.toISOString().split("T")[0]}`
    );

    // ✅ STEP 11: Create record in ApprovedBook collection
    const newApprovedBook = await ApprovedBook.create({
      bookId,
      userId,
      issueDate: issueDate.toISOString().split("T")[0],
      dueDate: dueDate.toISOString().split("T")[0],
      status: "issued",
    });

    console.log(
      `✅ [${requestId}] ApprovedBook record created with ID: ${newApprovedBook._id}`
    );

    // ✅ STEP 12: Send email notification
    let emailInitiated = false;
    let emailError = null;

    try {
      console.log(
        `📧 [${requestId}] Attempting to send email to: ${user.email}`
      );

      if (user && user.email) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await sendApprovalEmail(
              user.email,
              user.name || "Student",
              book.bookName || "Unknown Book",
              book.authorName || "Unknown Author",
              newApprovedBook.dueDate
            );
            console.log(
              `✅ [${requestId}] Email sent successfully to ${user.email} (attempt ${attempt})`
            );
            emailInitiated = true;
            break;
          } catch (emailErr) {
            console.log(
              `❌ [${requestId}] Email attempt ${attempt} failed: ${emailErr.message}`
            );
            emailError = emailErr.message;
            if (attempt < 3) {
              console.log(
                `⏳ [${requestId}] Waiting 2 seconds before retry...`
              );
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        }
      } else {
        console.log(`⚠️ [${requestId}] No email address found for user`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Email preparation error:`, error);
      emailError = error.message;
    }

    // ✅ STEP 13: Send success response
    console.log(
      `✅ [${requestId}] Direct book issuance completed successfully`
    );

    const responseData = {
      message: "Book issued successfully",
      issuedBook: {
        id: newApprovedBook._id,
        bookId: newApprovedBook.bookId,
        userId: newApprovedBook.userId,
        issueDate: newApprovedBook.issueDate,
        dueDate: newApprovedBook.dueDate,
        status: newApprovedBook.status,
      },
      bookDetails: {
        bookName: book.bookName,
        authorName: book.authorName,
        isbn: book.isbn,
      },
      userDetails: {
        userName: user.name,
        userEmail: user.email,
        userId: user.id,
      },
      emailInitiated: emailInitiated,
    };

    if (emailError) {
      responseData.emailError = emailError;
    }

    console.log(`📤 [${requestId}] Sending success response`);
    res.status(201).json(responseData);
  } catch (error) {
    console.error(`❌ [${requestId}] Error in direct issue:`, error);
    console.error(`❌ [${requestId}] Stack:`, error.stack);

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error: " + error.message,
        errorType: "VALIDATION_ERROR",
        requestId: requestId,
      });
    }

    if (error.name === "MongoError") {
      return res.status(500).json({
        message: "Database error: " + error.message,
        errorType: "DATABASE_ERROR",
        requestId: requestId,
      });
    }

    res.status(500).json({
      message: "Internal server error during book issuance",
      requestId: requestId,
      error: error.message,
    });
  }
};
// -------------------- Returns Management --------------------

const getIssuedBooks = async (req, res) => {
  try {
    const issuedBooks = await ApprovedBook.find({
      status: { $in: ["issued", "overdue"] },
    });

    const enrichedIssuedBooks = await Promise.all(
      issuedBooks.map(async (approvedBook) => {
        const book = await BookModel.findOne({ isbn: approvedBook.bookId });
        const user = await User.findOne({ id: approvedBook.userId });

        return {
          ...approvedBook.toObject(),
          bookTitle: book ? book.bookName : "Unknown Book",
          bookAuthor: book ? book.authorName : "Unknown Author",
          bookDepartment: book ? book.department : "Unknown Department",
          userName: user ? user.name : `User ID: ${approvedBook.userId}`,
        };
      })
    );

    res.json(enrichedIssuedBooks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const processReturn = async (req, res) => {
  console.log("🔄 ========== PROCESS RETURN START ==========");

  try {
    const { id } = req.params;
    console.log("🔍 Processing return for ApprovedBook ID:", id);

    // ✅ STEP 1: Find the approved book
    const approvedBook = await ApprovedBook.findById(id);
    if (!approvedBook) {
      console.log("❌ Approved book not found with ID:", id);
      return res.status(404).json({
        message: "Approved book record not found",
      });
    }

    console.log("✅ Found approved book:", {
      bookId: approvedBook.bookId,
      userId: approvedBook.userId,
      status: approvedBook.status,
    });

    // ✅ STEP 2: Update book status to "available"
    const book = await BookModel.findOne({ isbn: approvedBook.bookId });
    if (!book) {
      console.log("❌ Book not found with ISBN:", approvedBook.bookId);
      return res.status(404).json({
        message: "Book not found in database",
      });
    }

    console.log("📚 Book before update:", {
      isbn: book.isbn,
      bookName: book.bookName,
      currentStatus: book.status,
    });

    // ✅ FIX: Update book status to available
    const updateResult = await BookModel.updateOne(
      { isbn: approvedBook.bookId },
      { $set: { status: "available" } }
    );

    console.log("✅ Book update result:", updateResult);

    // Verify the update
    const updatedBook = await BookModel.findOne({ isbn: approvedBook.bookId });
    console.log("📚 Book after update:", {
      isbn: updatedBook.isbn,
      bookName: updatedBook.bookName,
      newStatus: updatedBook.status,
    });

    // ✅ STEP 3: Delete from ApprovedBook collection
    const deleteResult = await ApprovedBook.findByIdAndDelete(id);
    console.log(
      "✅ ApprovedBook delete result:",
      deleteResult ? "SUCCESS" : "FAILED"
    );

    // ✅ STEP 4: Send return confirmation email
    let emailSent = false;
    try {
      const user = await User.findOne({ id: approvedBook.userId });
      if (user && user.email) {
        await sendReturnConfirmation(
          user.email,
          user.name || "Student",
          book.bookName || "Unknown Book",
          approvedBook.issueDate,
          new Date().toISOString().split("T")[0]
        );
        emailSent = true;
        console.log("✅ Return confirmation email sent");
      }
    } catch (emailError) {
      console.error("❌ Error sending return email:", emailError);
    }

    console.log("✅ Return process completed successfully");

    res.json({
      message: "Book returned successfully",
      returnedBook: {
        bookId: approvedBook.bookId,
        bookName: book.bookName,
        userId: approvedBook.userId,
      },
      databaseUpdates: {
        bookStatusUpdated: true,
        approvedBookDeleted: true,
      },
      emailSent: emailSent,
    });
  } catch (error) {
    console.error("❌ Error in processReturn:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      message: "Internal server error during return process",
      error: error.message,
    });
  } finally {
    console.log("🔄 ========== PROCESS RETURN END ==========");
  }
};
// -------------------- User Management --------------------

const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      const term = search.toLowerCase().trim();
      query = {
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { id: { $regex: term, $options: "i" } },
          { course: { $regex: term, $options: "i" } },
          { department: { $regex: term, $options: "i" } },
        ],
      };
    }

    const users = await User.find(query).select("-password -refreshToken");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params; // Old user ID
    const { name, email, course, department, role, id: newId } = req.body;

    console.log("🔄 ========== UPDATE USER START ==========");
    console.log("📥 Request params (old ID):", id);
    console.log("📥 Request body:", {
      name,
      email,
      course,
      department,
      role,
      newId,
    });

    // Find user by old ID
    const user = await User.findOne({ id: id });
    if (!user) {
      console.log("❌ User not found with ID:", id);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Found user:", user.name, "Current ID:", user.id);

    // If ID is being changed, check if new ID already exists
    if (newId && newId !== id) {
      console.log(`🔄 Attempting to change ID from "${id}" to "${newId}"`);

      const existingUser = await User.findOne({ id: newId });
      if (existingUser) {
        console.log("❌ User with new ID already exists:", newId);
        return res
          .status(409)
          .json({ message: "User with this ID already exists" });
      }

      // Update related records
      try {
        console.log("🔄 Updating related records...");

        const approvedBooksUpdate = await ApprovedBook.updateMany(
          { userId: id },
          { $set: { userId: newId } }
        );
        console.log(
          `✅ Updated ${approvedBooksUpdate.modifiedCount} ApprovedBook records`
        );

        const finesUpdate = await Fine.updateMany(
          { userId: id },
          { $set: { userId: newId } }
        );
        console.log(`✅ Updated ${finesUpdate.modifiedCount} Fine records`);

        const issuesUpdate = await Issue.updateMany(
          { userId: id },
          { $set: { userId: newId } }
        );
        console.log(`✅ Updated ${issuesUpdate.modifiedCount} Issue records`);
      } catch (updateError) {
        console.error("❌ Error updating related records:", updateError);
        return res.status(500).json({
          message: "Failed to update user ID in related records",
          error: updateError.message,
        });
      }

      // Update the user ID
      user.id = newId;
      console.log(`✅ User ID changed from "${id}" to "${newId}"`);
    }

    // Update other fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (course) user.course = course;
    if (department) user.department = department;

    if (role) {
      if (role === "librarian") {
        user.roles = { Librarian: 5150 };
      } else if (role === "student") {
        user.roles = { Student: 2001 };
      } else if (role === "admin") {
        user.roles = { Admin: 1984 };
      }
      console.log(`✅ Role updated to: ${role}`);
    }

    await user.save();
    console.log("✅ User saved successfully");

    console.log("🔄 ========== UPDATE USER END ==========");

    res.json({
      success: true,
      message: "User updated successfully",
      updatedUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        course: user.course,
        department: user.department,
        roles: user.roles,
      },
    });
  } catch (error) {
    console.error("❌ Error updating user:", error);
    res.status(500).json({
      message: "Error updating user: " + error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id: id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.roles?.Librarian === 5150) {
      return res
        .status(403)
        .json({ message: "Cannot delete librarian accounts" });
    }

    // Check if user has any issued books
    const issuedBooks = await ApprovedBook.find({
      userId: user.id,
      status: { $in: ["issued", "overdue"] },
    });

    if (issuedBooks.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete user with issued books. Please process returns first.",
      });
    }

    await User.deleteOne({ id: id });
    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user: " + error.message });
  }
};

// -------------------- Fines Management --------------------

const getFines = async (req, res) => {
  try {
    const fines = await Fine.find({});
    res.json(fines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markFineAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const fine = await Fine.findById(id);

    if (!fine || fine.status !== "overdue") {
      return res
        .status(400)
        .json({ message: "Fine not found or already paid" });
    }

    // Update fine status
    fine.status = "paid";
    await fine.save();

    // Update ApprovedBook status
    await ApprovedBook.findOneAndUpdate(
      {
        bookId: fine.bookId,
        userId: fine.userId,
      },
      {
        status: "returned",
        returnedDate: new Date().toISOString().split("T")[0],
      }
    );

    // Update book status to available - FIXED
    const book = await BookModel.findOne({ isbn: fine.bookId });
    if (book) {
      book.status = "available";
      await book.save();
    }

    res.json({
      message: "Fine paid and book returned successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add these missing functions to your controller

const getRecentPendingRequests = async (req, res) => {
  try {
    const recentRequests = await Issue.find().sort({ createdAt: -1 }).limit(5);
    res.json(recentRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOverdueBooksList = async (req, res) => {
  try {
    const overdueBooks = await Fine.find({ status: "overdue" })
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(overdueBooks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReturnsData = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get issued books from ApprovedBook
    const issuedBooks = await ApprovedBook.find({
      status: { $in: ["issued", "overdue"] },
    });

    // Calculate returns data
    const returnsToday = issuedBooks.filter((book) => {
      return book.dueDate === today && book.status === "issued";
    }).length;

    const pendingReturns = issuedBooks.filter(
      (book) => book.status === "issued"
    ).length;

    const lateReturns = issuedBooks.filter(
      (book) => book.status === "overdue"
    ).length;

    // Enrich the data
    const enrichedReturnsList = await Promise.all(
      issuedBooks.map(async (book) => {
        const bookDetails = await BookModel.findOne({ isbn: book.bookId });
        const user = await User.findOne({ id: book.userId });

        const dueDate = new Date(book.dueDate);
        const today = new Date();
        const isLate = book.status === "overdue";
        const isDueToday = book.dueDate === today.toISOString().split("T")[0];

        return {
          id: book._id,
          bookId: book.bookId,
          bookTitle: bookDetails ? bookDetails.bookName : "Unknown Book",
          bookAuthor: bookDetails ? bookDetails.authorName : "Unknown Author",
          userId: book.userId,
          userName: user ? user.name : `User ID: ${book.userId}`,
          issueDate: book.issueDate,
          dueDate: book.dueDate,
          status: isLate ? "late" : isDueToday ? "due-today" : "pending",
          overdueDays: isLate ? book.overdueDays || 0 : 0,
          fineAmount: isLate ? book.overdueDays || 0 : 0,
        };
      })
    );

    res.json({
      returnsToday,
      pendingReturns,
      lateReturns,
      returnsList: enrichedReturnsList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFinesData = async (req, res) => {
  try {
    const unpaidFines = await Fine.find({ status: "overdue" });
    const paidFines = await Fine.find({ status: "paid" });

    const totalUnpaid = unpaidFines.reduce(
      (sum, fine) => sum + (fine.fineAmount || 0),
      0
    );
    const activeFines = unpaidFines.length;
    const totalPaidFines = paidFines.length;

    const finesList = await Promise.all(
      unpaidFines.map(async (fine) => {
        const user = await User.findOne({ id: fine.userId });
        const dueDate = new Date(fine.dueDate);
        const today = new Date();
        const overdueDays = Math.ceil(
          (today - dueDate) / (1000 * 60 * 60 * 24)
        );

        return {
          id: fine._id,
          bookId: fine.bookId,
          bookTitle: fine.bookTitle || "Unknown Book",
          bookAuthor: fine.bookAuthor || "Unknown Author",
          userId: fine.userId,
          userName: user ? user.name : `User ID: ${fine.userId}`,
          userEmail: user ? user.email : "N/A",
          issueDate: fine.issueDate,
          dueDate: fine.dueDate,
          overdueDays: overdueDays > 0 ? overdueDays : 0,
          fineAmount: fine.fineAmount || 0,
          status: fine.status,
        };
      })
    );

    res.json({
      totalUnpaid,
      activeFines,
      totalPaidFines,
      finesList,
      summary: {
        totalUnpaid,
        activeFines,
        totalPaidFines,
        totalCollected: paidFines.reduce(
          (sum, fine) => sum + (fine.fineAmount || 0),
          0
        ),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Test functions (keep these or remove if not needed)
const testEmail = async (req, res) => {
  try {
    await sendApprovalEmail(
      "test@example.com",
      "Test User",
      "Test Book",
      "Test Author",
      "2025-10-20"
    );
    res.json({ message: "Test email sent successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resetAllDataGET = async (req, res) => {
  try {
    await BookModel.deleteMany({});
    await Issue.deleteMany({});
    await Fine.deleteMany({});
    await ApprovedBook.deleteMany({});

    res.json({
      success: true,
      message: "All data reset complete",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const forceClearCache = (req, res) => {
  res.json({
    success: true,
    message: "Cache cleared",
  });
};

const testDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id: id });
    const allUsers = await User.find({}, "id name");

    res.json({
      searchingFor: id,
      userFound: !!user,
      userDetails: user,
      allUsers: allUsers.map((u) => ({ id: u.id, name: u.name })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  // Dashboard metrics
  getTotalBooks,
  getBooksIssued,
  getOverdueBooks,
  getPendingRequestsCount,
  getFinesCollected,
  getActiveUsers,
  getRecentPendingRequests,
  getOverdueBooksList,

  // Books
  createBook,
  getAllBooks,
  updateBook,
  deleteBook,

  // Issues & Returns
  issueBook,
  approveRequest,
  rejectRequest,
  processReturn,
  getPendingRequests,
  getIssuedBooks,
  getReturnsData,

  // Users
  getAllUsers,
  updateUser,
  deleteUser,
  testDelete,

  // Fines
  getFines,
  markFineAsPaid,
  getFinesData,

  // Test functions
  testEmail,
  resetAllDataGET,
  forceClearCache,
};
