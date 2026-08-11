import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer_out", "transfer_in", "gift_sent", "gift_received"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    relatedPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    relatedComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
