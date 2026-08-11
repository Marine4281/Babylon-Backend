import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    text: { type: String, default: "" },
    attachments: [{ type: String }],

    // In-chat money transfer (e.g. "Sent you a $10.00 peer transfer!")
    isMoneyTransfer: { type: Boolean, default: false },
    amount: { type: Number, default: 0, min: 0 },
    relatedTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
