const express = require("express");
const router = express.Router();
const studentsController = require("../../controllers/studentsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");
const verifyJWT = require("../../middleware/verifyJWT");

// Apply JWT verification to all routes
router.use(verifyJWT);

// Books route
router.get(
  "/books",
  verifyRoles(ROLES_LIST.Student),
  studentsController.getAllBooks
);

// Other student routes...
router.get(
  "/issues",
  verifyRoles(ROLES_LIST.Student),
  studentsController.getIssuedBooks
);

router.post(
  "/issues/request",
  verifyRoles(ROLES_LIST.Student),
  studentsController.requestBook
);

router.get(
  "/fines",
  verifyRoles(ROLES_LIST.Student),
  studentsController.getFines
);

module.exports = router;
