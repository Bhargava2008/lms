const Book = require("../model/Book");
const User = require("../model/User");
const Issue = require("../model/Issue");
const ApprovedBook = require("../model/ApprovedBook");

const Fine = require("../model/Fine");
const bcrypt = require("bcrypt");

console.log("✅ studentsController.js loaded successfully");

// -------------------- Core Functions --------------------

// 1. Search/View Books - MongoDB Version
const getAllBooks = async (req, res) => {
  try {
    console.log("🔄 Student getAllBooks CALLED - MongoDB Version");

    const { search } = req.query;

    let query = { status: "available" };

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      query.$or = [
        { bookName: { $regex: searchTerm, $options: "i" } },
        { authorName: { $regex: searchTerm, $options: "i" } },
        { isbn: { $regex: searchTerm, $options: "i" } },
        { department: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const books = await Book.find(query);
    console.log(`✅ Found ${books.length} available books in MongoDB`);
    res.json(books);
  } catch (error) {
    console.error("❌ Error in student getAllBooks:", error);
    res.status(500).json({ message: "Error loading books" });
  }
};

// Request a Book - MongoDB Version
const requestBook = async (req, res) => {
  const { bookId } = req.body;

  try {
    console.log(
      "🔄 Student requestBook called for book:",
      bookId,
      "User:",
      req.user
    );

    // **1. Check for duplicate book request**
    const existingBookRequest = await Issue.findOne({
      bookId: bookId,
      userId: req.user,
    });

    if (existingBookRequest) {
      console.log("❌ Duplicate book request blocked");
      return res.status(409).json({
        message: "You already have a request for this book.",
      });
    }

    // **2. Check 3-book limit with specific conditions**
    const allIssueRequests = await Issue.find({ userId: req.user });
    const pendingBooksCount = allIssueRequests.length;

    const approvedBooks = await ApprovedBook.find({
      userId: req.user,
      status: { $in: ["issued", "overdue"] },
    });
    const approvedBooksCount = approvedBooks.length;

    const totalActiveBooks = pendingBooksCount + approvedBooksCount;

    console.log(`📊 Book counts for user ${req.user}:`);
    console.log(`   - Pending requests: ${pendingBooksCount}`);
    console.log(`   - Issued books: ${approvedBooksCount}`);
    console.log(`   - TOTAL active books: ${totalActiveBooks}`);

    if (totalActiveBooks >= 3) {
      // **SPECIFIC ERROR MESSAGES BASED ON SITUATION**
      if (approvedBooksCount >= 3) {
        return res.status(400).json({
          message: "You have 3 issued books. Please return some books first.",
        });
      } else if (pendingBooksCount >= 3) {
        return res.status(400).json({
          message:
            "You have 3 pending book requests. Maximum limit is 3. Please contact librarian.",
        });
      } else {
        // Mixed situation (some issued + some pending = 3 total)
        return res.status(400).json({
          message: `You have ${approvedBooksCount} issued books and ${pendingBooksCount} pending requests. Total limit is 3. Please return some books first.`,
        });
      }
    }

    // **3. Check book availability**
    const book = await Book.findOne({ isbn: bookId });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    if (book.status !== "available") {
      return res.status(400).json({ message: "Book is not available" });
    }

    // **4. Create request**
    const newRequest = await Issue.create({
      bookId,
      userId: req.user,
      requestDate: new Date().toISOString(),
      status: "pending",
    });

    console.log("✅ Book request created");
    res.status(201).json({
      message: "Book requested successfully!",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
};
// 3. Update Password - MongoDB Version
const updatePassword = async (req, res) => {
  console.log("🔄 Student updatePassword called - User ID:", req.user);

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required" });
  }

  try {
    const user = await User.findOne({ id: req.user });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    console.log("✅ Password updated successfully for user:", req.user);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
};

// 4. View Issued Books - MongoDB Version
const getIssuedBooks = async (req, res) => {
  console.log("🔄 Student getIssuedBooks called - User ID:", req.user);

  try {
    // Get issued books from approvedbooks db
    const userIssuedBooks = await ApprovedBook.find({
      userId: req.user,
      status: { $in: ["issued", "overdue"] },
    });

    const enrichedIssuedBooks = await Promise.all(
      userIssuedBooks.map(async (approvedBook) => {
        const book = await Book.findOne({ isbn: approvedBook.bookId });

        // Calculate due date and overdue days
        const issueDate = new Date(
          approvedBook.issueDate || approvedBook.approvedDate
        );
        const dueDate = new Date(issueDate);
        dueDate.setDate(issueDate.getDate() + 15);

        const today = new Date();
        const overdueDays = Math.max(
          0,
          Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24))
        );

        return {
          id: approvedBook._id,
          bookId: approvedBook.bookId,
          userId: approvedBook.userId,
          issueDate: issueDate.toISOString().split("T")[0],
          dueDate: dueDate.toISOString().split("T")[0],
          status: approvedBook.status,
          bookTitle: book ? book.bookName : "Unknown Book",
          bookAuthor: book ? book.authorName : "Unknown Author",
          bookDepartment: book ? book.department : "General",
          overdueDays: overdueDays,
        };
      })
    );

    console.log(
      "✅ Found issued books from approvedbooks:",
      enrichedIssuedBooks.length
    );
    res.json(enrichedIssuedBooks);
  } catch (err) {
    console.error("❌ Error in student getIssuedBooks:", err);
    res.status(500).json({ message: "Failed to load issued books." });
  }
};

// 5. View Fines - MongoDB Version
const getFines = async (req, res) => {
  console.log("🔄 Student getFines called - User ID:", req.user);

  try {
    const userFines = await Fine.find({
      userId: req.user,
      status: "overdue",
    });

    const enrichedFines = await Promise.all(
      userFines.map(async (fine) => {
        const book = await Book.findOne({ isbn: fine.bookId });
        return {
          id: fine._id,
          bookId: fine.bookId,
          userId: fine.userId,
          bookTitle: book ? book.bookName : "Unknown Book",
          bookAuthor: book ? book.authorName : "Unknown Author",
          requestDate: fine.requestDate,
          dueDate: fine.dueDate,
          overdueDays: fine.overdueDays || 0,
          fineAmount: fine.fineAmount || 0,
          status: fine.status,
        };
      })
    );

    console.log("✅ Found fines:", enrichedFines.length);
    res.json(enrichedFines);
  } catch (err) {
    console.error("❌ Error in student getFines:", err);
    res.status(500).json({ message: "Failed to load fines." });
  }
};

// Export all functions
module.exports = {
  getAllBooks,
  requestBook,
  updatePassword,
  getIssuedBooks,
  getFines,
};
