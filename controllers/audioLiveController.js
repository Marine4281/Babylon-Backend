import { v4 as uuidv4 } from "uuid";
import LiveRoom from "../models/LiveRoom.js";
import { generateAgoraRtcToken } from "../utils/agoraToken.js";
import { HOST_FIELDS } from "./liveController.js";

// @desc    Start a voice room — host is seeded as the first speaker
// @route   POST /api/live/voice
// @access  Protected
export const startAudioLiveRoom = async (req, res) => {
  try {
    const { title = "" } = req.body;

    const existing = await LiveRoom.findOne({ host: req.user._id, status: "live" });
    if (existing) {
      return res.status(400).json({ message: "You already have an active live room", room: existing });
    }

    const channelName = `babylon_live_voice_${uuidv4()}`;

    const room = await LiveRoom.create({
      host: req.user._id,
      type: "voice",
      title: title.trim(),
      channelName,
      speakers: [req.user._id],
    });

    const token = generateAgoraRtcToken(channelName, req.user._id.toString(), "publisher");
    const populated = await room.populate("host", HOST_FIELDS);

    res.status(201).json({
      room: populated,
      agora: {
        appId: process.env.AGORA_APP_ID,
        channelName,
        token,
        uid: req.user._id.toString(),
        role: "publisher",
      },
    });
  } catch (error) {
    console.error("Start audio live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Listener raises their hand to request a mic
// @route   POST /api/live/voice/:roomId/request-speak
// @access  Protected
export const requestToSpeak = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room || room.status !== "live") {
      return res.status(404).json({ message: "Live room not found or has ended" });
    }
    if (room.type !== "voice") {
      return res.status(400).json({ message: "Only voice rooms support speaker requests" });
    }
    if (room.speakers.some((id) => String(id) === String(req.user._id))) {
      return res.status(400).json({ message: "You're already on stage" });
    }

    await LiveRoom.updateOne({ _id: room._id }, { $addToSet: { speakerRequests: req.user._id } });

    req.app.get("io").to(`live_${room._id}`).emit("live:speak_requested", {
      roomId: room._id,
      user: { id: req.user._id, username: req.user.username, avatarUrl: req.user.avatarUrl },
    });

    res.json({ message: "Request sent to the host" });
  } catch (error) {
    console.error("Request to speak error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Host approves a raised hand — promotes listener to speaker
// @route   POST /api/live/voice/:roomId/approve-speak/:userId
// @access  Protected (host only)
export const approveSpeaker = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room || room.status !== "live") {
      return res.status(404).json({ message: "Live room not found or has ended" });
    }
    if (String(room.host) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the host can approve speakers" });
    }

    const { userId } = req.params;

    await LiveRoom.updateOne(
      { _id: room._id },
      { $addToSet: { speakers: userId }, $pull: { speakerRequests: userId } }
    );

    const publisherToken = generateAgoraRtcToken(room.channelName, userId, "publisher");

    req.app.get("io").to(`live_${room._id}`).emit("live:speaker_approved", {
      roomId: room._id,
      userId,
    });

    res.json({
      message: "Speaker approved",
      agora: {
        appId: process.env.AGORA_APP_ID,
        channelName: room.channelName,
        token: publisherToken,
        uid: userId,
        role: "publisher",
      },
    });
  } catch (error) {
    console.error("Approve speaker error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Host removes a speaker, or a speaker steps down themselves
// @route   POST /api/live/voice/:roomId/remove-speaker/:userId
// @access  Protected (host, or the speaker themselves)
export const removeSpeaker = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room || room.status !== "live") {
      return res.status(404).json({ message: "Live room not found or has ended" });
    }

    const { userId } = req.params;
    const isHost = String(room.host) === String(req.user._id);
    const isSelf = String(userId) === String(req.user._id);

    if (!isHost && !isSelf) {
      return res.status(403).json({ message: "Only the host or the speaker themselves can do this" });
    }
    if (String(userId) === String(room.host)) {
      return res.status(400).json({ message: "The host can't be removed from speaking" });
    }

    await LiveRoom.updateOne({ _id: room._id }, { $pull: { speakers: userId } });

    req.app.get("io").to(`live_${room._id}`).emit("live:speaker_removed", {
      roomId: room._id,
      userId,
    });

    res.json({ message: "Speaker moved back to listening" });
  } catch (error) {
    console.error("Remove speaker error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
