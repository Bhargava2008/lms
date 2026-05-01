const express = require("express");
const router = express.Router();
const librarianController = require("../../controllers/librarianController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the librarian API!" });
});

// Dashboard metrics routes
router.get(
  "/dashboard/total-books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getTotalBooks
);

router.get("/dashboard/total-books-debug", (req, res) => {
  console.log("🎯 DEBUG ROUTE CALLED!");
  librarianController.getTotalBooks(req, res);
});

router.get(
  "/dashboard/issued-books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getBooksIssued
);
router.get(
  "/dashboard/overdue-books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getOverdueBooks
);
router.get(
  "/dashboard/pending-requests",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getPendingRequestsCount
);
router.get(
  "/dashboard/fines-collected",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getFinesCollected
);
router.get(
  "/dashboard/active-users",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getActiveUsers
);
router.get(
  "/dashboard/recent-requests",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getRecentPendingRequests
);
router.get(
  "/dashboard/recent-overdue",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getOverdueBooksList
);

// Books routes
router.get(
  "/books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getAllBooks
);
router.post(
  "/books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.createBook
);

router.put(
  "/books/:id",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.updateBook
);
router.delete(
  "/books/:id",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.deleteBook
);

// Users routes
router.get(
  "/users",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getAllUsers
);

router.put(
  "/users/:id",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.updateUser
);
router.delete(
  "/users/:id",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.deleteUser
);

// Issue/Return/Request routes
router.post(
  "/issues/issue",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.issueBook
);
router.get("/test-email", librarianController.testEmail);
router.put(
  "/issues/:id/return",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.processReturn
);
router.get(
  "/requests/pending",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getPendingRequests
);
router.put(
  "/requests/:id/approve",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.approveRequest
);
router.put(
  "/requests/:id/reject",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.rejectRequest
);

// Issued books & fines routes
router.get(
  "/issued-books",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getIssuedBooks
);
router.get(
  "/fines",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getFines
);
router.put(
  "/fines/:id/paid",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.markFineAsPaid
);

// Debug routes
router.get(
  "/dev/resetAllData",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.resetAllDataGET
);
router.get("/dev/clear-cache", librarianController.forceClearCache);

// ✅ ADD THIS TEST ROUTE
router.get("/test-delete/:id", librarianController.testDelete);

// Returns routes
router.get(
  "/returns/data",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getReturnsData
);

// Enhanced fines routes
router.get(
  "/fines/data",
  verifyRoles(ROLES_LIST.Librarian),
  librarianController.getFinesData
);
module.exports = router;
