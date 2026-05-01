const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const requestSchema = new Schema(
  {
    bookId: { type: String, required: true },
    userId: { type: String, required: true },
    requestDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "rejected"],
      default: "pending",
    },
    rejectedDate: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);
