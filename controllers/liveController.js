import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import LiveRoom from "../models/LiveRoom.js";
import Transaction from "../models/Transaction.js";
import { getOrCreateWallet } from "./walletController.js";
import { generateAgoraRtcToken } from "../utils/agoraToken.js";

const HOST_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    Go live — creates a video or voice room and returns an Agora
//          publisher token for the host
// @route   POST /api/live
// @access  Protected
export const startLiveRoom = async (req, res) => {
  try {
    const { type = "video", title = "" } = req.body;
    if (!["video", "voice"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'video' or 'voice'" });
    }

    const existing = await LiveRoom.findOne({ host: req.user._id, status: "live" });
    if (existing) {
      return res.status(400).json({ message: "You already have an active live room", room: existing });
    }

    const channelName = `babylon_live_${uuidv4()}`;

    const room = await LiveRoom.create({
      host: req.user._id,
      type,
      title: title.trim(),
      channelName,
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
    console.error("Start live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Join a live room as a viewer — returns an Agora subscriber token
// @route   POST /api/live/:roomId/join
// @access  Protected
export const joinLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room || room.status !== "live") {
      return res.status(404).json({ message: "Live room not found or has ended" });
    }

    const token = generateAgoraRtcToken(room.channelName, req.user._id.toString(), "subscriber");
    const updated = await LiveRoom.findOneAndUpdate(
      { _id: room._id },
      { $inc: { viewerCount: 1 } },
      { new: true }
    );

    req.app.get("io").to(`live_${room._id}`).emit("live:viewer_joined", {
      roomId: room._id,
      viewerCount: updated.viewerCount,
    });

    res.json({
      room: updated,
      agora: {
        appId: process.env.AGORA_APP_ID,
        channelName: room.channelName,
        token,
        uid: req.user._id.toString(),
        role: "subscriber",
      },
    });
  } catch (error) {
    console.error("Join live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Leave a live room (viewer)
// @route   POST /api/live/:roomId/leave
// @access  Protected
export const leaveLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Live room not found" });

    const updated = await LiveRoom.findOneAndUpdate(
      { _id: room._id, viewerCount: { $gt: 0 } },
      { $inc: { viewerCount: -1 } },
      { new: true }
    ) || room;

    req.app.get("io").to(`live_${room._id}`).emit("live:viewer_left", {
      roomId: room._id,
      viewerCount: updated.viewerCount,
    });

    res.json({ message: "Left live room" });
  } catch (error) {
    console.error("Leave live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    End a live room — host only
// @route   POST /api/live/:roomId/end
// @access  Protected
export const endLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Live room not found" });
    if (String(room.host) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the host can end this live room" });
    }

    room.status = "ended";
    room.endedAt = new Date();
    await room.save();

    req.app.get("io").to(`live_${room._id}`).emit("live:ended", { roomId: room._id });

    res.json({ message: "Live room ended", room });
  } catch (error) {
    console.error("End live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    List currently active live rooms — filter by ?type=video|voice
// @route   GET /api/live
// @access  Protected
export const getLiveRooms = async (req, res) => {
  try {
    const filter = { status: "live" };
    if (["video", "voice"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const rooms = await LiveRoom.find(filter)
      .sort({ createdAt: -1 })
      .populate("host", HOST_FIELDS)
      .lean();

    res.json({ rooms });
  } catch (error) {
    console.error("Get live rooms error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Send a real-money gift during a live stream — debits sender,
//          credits host, broadcasts to the room instantly via socket
// @route   POST /api/live/:roomId/gift
// @access  Protected
export const giftLiveRoom = async (req, res) => {
  const { amount: rawAmount, message = "" } = req.body;
  const amount = Number(rawAmount);

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Enter a valid gift amount" });
  }

  const room = await LiveRoom.findById(req.params.roomId);
  if (!room || room.status !== "live") {
    return res.status(404).json({ message: "Live room not found or has ended" });
  }
  if (String(room.host) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't gift your own live room" });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const senderWallet = await getOrCreateWallet(req.user._id, session);
      if (senderWallet.balance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }
      const hostWallet = await getOrCreateWallet(room.host, session);

      senderWallet.balance -= amount;
      hostWallet.balance += amount;
      await senderWallet.save({ session });
      await hostWallet.save({ session });

      await LiveRoom.updateOne({ _id: room._id }, { $inc: { giftTotal: amount } }, { session });

      await Transaction.create(
        [
          {
            user: req.user._id,
            type: "gift_sent",
            amount,
            balanceAfter: senderWallet.balance,
            relatedUser: room.host,
            description: "Gift sent on a live stream",
          },
          {
            user: room.host,
            type: "gift_received",
            amount,
            balanceAfter: hostWallet.balance,
            relatedUser: req.user._id,
            description: "Gift received on a live stream",
          },
        ],
        { session }
      );

      result = { balance: senderWallet.balance };
    });

    req.app.get("io").to(`live_${room._id}`).emit("live:gift", {
      roomId: room._id,
      from: { id: req.user._id, username: req.user.username, avatarUrl: req.user.avatarUrl },
      amount,
      message: message.trim(),
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    console.error("Gift live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};
