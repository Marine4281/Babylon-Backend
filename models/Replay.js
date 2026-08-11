import mongoose from "mongoose";

const replaySchema = new mongoose.Schema(
  {
    liveRoom: { type: mongoose.Schema.Types.ObjectId, ref: "LiveRoom", required: true, index: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["video", "voice"], required: true },
    title: { type: String, default: "", maxlength: 100 },

    thumbnailUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    videoPublicId: { type: String, default: "" },
    duration: { type: Number, default: 0 }, // seconds

    viewCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    keepForever: { type: Boolean, default: false }, // "Keep it on their profile"
    expiresAt: { type: Date, index: true }, // null when keepForever is true

    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing", index: true },
  },
  { timestamps: true }
);

replaySchema.index({ creator: 1, createdAt: -1 });

export default mongoose.model("Replay", replaySchema);
