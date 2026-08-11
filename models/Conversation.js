import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: "" },
    groupAvatarUrl: { type: String, default: "" },

    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Fast lookup of "do these two users already have a DM" for 1:1 chats
conversationSchema.index({ participants: 1, isGroup: 1 });

export default mongoose.model("Conversation", conversationSchema);
