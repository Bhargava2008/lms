const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const fineSchema = new Schema(
  {
    bookId: { type: String, required: true },
    userId: { type: String, required: true },
    bookTitle: String,
    bookAuthor: String,
    issueDate: String,
    dueDate: String,
    overdueDays: Number,
    fineAmount: Number,
    status: {
      type: String,
      enum: ["overdue", "paid"],
      default: "overdue",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Fine", fineSchema);
