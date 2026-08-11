import Reel from "../models/Reel.js";
import Replay from "../models/Replay.js";
import { cloudinary } from "../Config/cloudinary.js";

const AUTHOR_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    Clip a section of a finished replay into a standalone Reel
// @route   POST /api/reels/from-replay/:replayId
// @access  Protected (replay owner only)
export const createReelFromReplay = async (req, res) => {
  try {
    const { clipStart, clipEnd, caption = "" } = req.body;
    const start = Number(clipStart);
    const end = Number(clipEnd);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res
        .status(400)
        .json({ message: "clipStart and clipEnd must be valid seconds, with clipEnd after clipStart" });
    }

    const replay = await Replay.findById(req.params.replayId);
    if (!replay) return res.status(404).json({ message: "Replay not found" });
    if (String(replay.creator) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the replay's creator can clip it into a Reel" });
    }
    if (replay.status !== "ready") {
      return res.status(400).json({ message: "Replay isn't ready yet" });
    }
    if (end > replay.duration) {
      return res.status(400).json({ message: "clipEnd is past the end of the replay" });
    }

    // Cloudinary can sub-clip a video on the fly via start_offset/end_offset —
    // fetch that transformed clip as the source for a brand new asset so the
    // Reel has its own independent video, not just a transformation reference.
    const clipUrl = cloudinary.url(replay.videoPublicId, {
      resource_type: "video",
      start_offset: start,
      end_offset: end,
      format: "mp4",
    });

    const uploaded = await cloudinary.uploader.upload(clipUrl, {
      resource_type: "video",
      folder: "babylon/reels",
      public_id: `reel_${replay._id}_${Date.now()}`,
    });

    const thumbnailUrl = cloudinary.url(uploaded.public_id, {
      resource_type: "video",
      format: "jpg",
      transformation: [{ width: 720, crop: "limit" }],
    });

    const reel = await Reel.create({
      creator: req.user._id,
      sourceReplay: replay._id,
      caption: caption.trim(),
      thumbnailUrl,
      videoUrl: uploaded.secure_url,
      videoPublicId: uploaded.public_id,
      clipStart: start,
      clipEnd: end,
      duration: Math.round(uploaded.duration || end - start),
    });

    const populated = await reel.populate("creator", AUTHOR_FIELDS);
    res.status(201).json({ reel: populated });
  } catch (error) {
    console.error("Create reel from replay error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get the Reels feed (paginated, newest first)
// @route   GET /api/reels?page=1&limit=10
// @access  Protected
export const getReels = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    const reels = await Reel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("creator", AUTHOR_FIELDS)
      .lean();

    res.json({ page, limit, reels });
  } catch (error) {
    console.error("Get reels error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Reels by a specific creator (profile grid)
// @route   GET /api/reels/user/:userId
// @access  Protected
export const getUserReels = async (req, res) => {
  try {
    const reels = await Reel.find({ creator: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("creator", AUTHOR_FIELDS)
      .lean();

    res.json({ reels });
  } catch (error) {
    console.error("Get user reels error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Like or unlike a Reel
// @route   POST /api/reels/:id/like
// @access  Protected
export const toggleLikeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const alreadyLiked = reel.likes.some((id) => String(id) === String(req.user._id));

    if (alreadyLiked) {
      reel.likes = reel.likes.filter((id) => String(id) !== String(req.user._id));
      reel.likesCount = Math.max(0, reel.likesCount - 1);
    } else {
      reel.likes.push(req.user._id);
      reel.likesCount += 1;
    }

    await reel.save();
    res.json({ isLiked: !alreadyLiked, likesCount: reel.likesCount });
  } catch (error) {
    console.error("Toggle like reel error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a Reel — creator only
// @route   DELETE /api/reels/:id
// @access  Protected
export const deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });
    if (String(reel.creator) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the creator can delete this Reel" });
    }

    if (reel.videoPublicId) {
      await cloudinary.uploader.destroy(reel.videoPublicId, { resource_type: "video" }).catch(() => {});
    }
    await reel.deleteOne();

    res.json({ message: "Reel deleted" });
  } catch (error) {
    console.error("Delete reel error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
