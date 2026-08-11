import mongoose from "mongoose";

const liveRoomSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["video", "voice"], required: true },
    title: { type: String, default: "", maxlength: 100 },

    channelName: { type: String, required: true, unique: true },

    status: { type: String, enum: ["live", "ended"], default: "live", index: true },
    viewerCount: { type: Number, default: 0, min: 0 },
    giftTotal: { type: Number, default: 0 },

    recordingEnabled: { type: Boolean, default: false }, // creator's choice at go-live time
    recording: {
      agoraResourceId: { type: String, default: "" },
      agoraSid: { type: String, default: "" },
      recordingUid: { type: String, default: "" },
      status: {
        type: String,
        enum: ["none", "recording", "stopping", "processing", "ready", "failed"],
        default: "none",
      },
    },
    replay: { type: mongoose.Schema.Types.ObjectId, ref: "Replay" }, // set once processing completes

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

liveRoomSchema.index({ status: 1, type: 1, createdAt: -1 });

export default mongoose.model("LiveRoom", liveRoomSchema);
