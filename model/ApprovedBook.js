const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const approvedBookSchema = new Schema(
  {
    bookId: { type: String, required: true },
    userId: { type: String, required: true },
    issueDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["issued", "overdue", "returned"],
      default: "issued",
    },
    overdueDays: { type: Number, default: 0 },
    returnedDate: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ApprovedBook", approvedBookSchema);
