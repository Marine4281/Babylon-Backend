import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: {
      type: String,
      enum: ["post", "comment", "reel", "replay", "liveRoom", "user"],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: {
      type: String,
      enum: ["spam", "harassment", "copyright", "illegal_content", "privacy", "other"],
      required: true,
    },
    details: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["open", "reviewed", "actioned", "dismissed"], default: "open", index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
