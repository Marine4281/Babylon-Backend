import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caption: { type: String, default: "", maxlength: 2200 },
    media: [{ type: String }],
    mediaPublicIds: [{ type: String }], // Cloudinary public_ids, parallel to `media` — for cleanup on delete
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    giftTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

export default mongoose.model("Post", postSchema);
