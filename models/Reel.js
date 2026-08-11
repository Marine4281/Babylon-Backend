import mongoose from "mongoose";

const reelSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceReplay: { type: mongoose.Schema.Types.ObjectId, ref: "Replay" },

    caption: { type: String, default: "", maxlength: 300 },
    thumbnailUrl: { type: String, default: "" },
    videoUrl: { type: String, required: true },
    videoPublicId: { type: String, required: true },

    clipStart: { type: Number, default: 0 },
    clipEnd: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },

    viewCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

reelSchema.index({ createdAt: -1 });

export default mongoose.model("Reel", reelSchema);
