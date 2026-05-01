const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookSchema = new Schema(
  {
    bookName: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    isbn: {
      type: String,
      required: true,
      unique: true,
    },
    department: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "issued"],
      default: "available",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Create the 'books' collection in MongoDB
module.exports = mongoose.model("Book", bookSchema);
