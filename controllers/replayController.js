import Replay from "../models/Replay.js";
import LiveRoom from "../models/LiveRoom.js";
import { cloudinary } from "../Config/cloudinary.js";

const AUTHOR_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    Get recent replays (paginated, newest first) — Babylon Live's
//          "Recent Replays" rail
// @route   GET /api/replays?page=1&limit=10
// @access  Protected
export const getReplays = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    const replays = await Replay.find({ status: "ready" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("creator", AUTHOR_FIELDS)
      .lean();

    res.json({ page, limit, replays });
  } catch (error) {
    console.error("Get replays error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get replays by a specific creator (profile grid)
// @route   GET /api/replays/user/:userId
// @access  Protected
export const getUserReplays = async (req, res) => {
  try {
    const replays = await Replay.find({ creator: req.params.userId, status: "ready" })
      .sort({ createdAt: -1 })
      .populate("creator", AUTHOR_FIELDS)
      .lean();

    res.json({ replays });
  } catch (error) {
    console.error("Get user replays error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Watch a single replay — increments view count
// @route   GET /api/replays/:id
// @access  Protected
export const getReplay = async (req, res) => {
  try {
    const replay = await Replay.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate("creator", AUTHOR_FIELDS);

    if (!replay) return res.status(404).json({ message: "Replay not found" });

    res.json({ replay });
  } catch (error) {
    console.error("Get replay error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Like or unlike a replay
// @route   POST /api/replays/:id/like
// @access  Protected
export const toggleLikeReplay = async (req, res) => {
  try {
    const replay = await Replay.findById(req.params.id);
    if (!replay) return res.status(404).json({ message: "Replay not found" });

    const alreadyLiked = replay.likes.some((id) => String(id) === String(req.user._id));

    if (alreadyLiked) {
      replay.likes = replay.likes.filter((id) => String(id) !== String(req.user._id));
      replay.likesCount = Math.max(0, replay.likesCount - 1);
    } else {
      replay.likes.push(req.user._id);
      replay.likesCount += 1;
    }

    await replay.save();
    res.json({ isLiked: !alreadyLiked, likesCount: replay.likesCount });
  } catch (error) {
    console.error("Toggle like replay error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get a download link for a replay (Cloudinary's attachment flag
//          forces a browser download instead of inline playback)
// @route   GET /api/replays/:id/download
// @access  Protected
export const getReplayDownloadUrl = async (req, res) => {
  try {
    const replay = await Replay.findById(req.params.id).select("videoPublicId status");
    if (!replay || replay.status !== "ready") {
      return res.status(404).json({ message: "Replay not found or not ready" });
    }

    const downloadUrl = cloudinary.url(replay.videoPublicId, {
      resource_type: "video",
      flags: "attachment",
    });

    res.json({ downloadUrl });
  } catch (error) {
    console.error("Get replay download url error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a replay — creator only. Removes the video from
//          Cloudinary and clears the LiveRoom's replay reference.
// @route   DELETE /api/replays/:id
// @access  Protected
export const deleteReplay = async (req, res) => {
  try {
    const replay = await Replay.findById(req.params.id);
    if (!replay) return res.status(404).json({ message: "Replay not found" });
    if (String(replay.creator) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the creator can delete this replay" });
    }

    if (replay.videoPublicId) {
      await cloudinary.uploader.destroy(replay.videoPublicId, { resource_type: "video" }).catch(() => {});
    }
    await LiveRoom.updateOne({ replay: replay._id }, { $unset: { replay: "" } });
    await replay.deleteOne();

    res.json({ message: "Replay deleted" });
  } catch (error) {
    console.error("Delete replay error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
