import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 500 },
    isGift: { type: Boolean, default: false },
    giftAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
