const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const issueSchema = new Schema(
  {
    bookId: { type: String, required: true },
    userId: { type: String, required: true },
    requestDate: { type: String }, // Remove required: true
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Issue", issueSchema);
