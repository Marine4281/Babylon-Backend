import mongoose from "mongoose";

const liveRoomSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["video", "voice"], required: true },
    title: { type: String, default: "", maxlength: 100 },

    // Agora channel this room streams on — never exposed to clients directly,
    // only via the Agora token payload returned from start/join
    channelName: { type: String, required: true, unique: true },

    status: { type: String, enum: ["live", "ended"], default: "live", index: true },
    viewerCount: { type: Number, default: 0, min: 0 },
    giftTotal: { type: Number, default: 0 },

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

liveRoomSchema.index({ status: 1, type: 1, createdAt: -1 });

export default mongoose.model("LiveRoom", liveRoomSchema);
