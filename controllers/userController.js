// controllers/userController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import { cloudinary } from "../Config/cloudinary.js";

const PROFILE_FIELDS =
  "username fullName bio avatarUrl coverPhotoUrl countryCode isVerified followersCount followingCount createdAt";

// @desc    Get a user's public profile by username
// @route   GET /api/users/:username
// @access  Protected
export const getProfile = async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    const user = await User.findOne({ username, isActive: true }).select(PROFILE_FIELDS);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [postsCount, isFollowing] = await Promise.all([
      Post.countDocuments({ author: user._id }),
      Follow.exists({ follower: req.user._id, following: user._id }),
    ]);

    res.json({
      ...user.toObject(),
      postsCount,
      isFollowing: Boolean(isFollowing),
      isSelf: String(user._id) === String(req.user._id),
    });
  } catch (error) {
    console.error("Get profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update the logged-in user's own profile
// @route   PUT /api/users/me
// @access  Protected
export const updateProfile = async (req, res) => {
  try {
    const { fullName, bio, avatarUrl, coverPhotoUrl, countryCode } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName.trim();
    if (bio !== undefined) updates.bio = bio.trim().slice(0, 200);
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (coverPhotoUrl !== undefined) updates.coverPhotoUrl = coverPhotoUrl;
    if (countryCode !== undefined) updates.countryCode = countryCode.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select(PROFILE_FIELDS);

    res.json(user);
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Upload/replace the logged-in user's avatar
// @route   POST /api/users/me/avatar
// @access  Protected
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const existing = await User.findById(req.user._id).select("avatarPublicId");
    if (existing?.avatarPublicId) {
      await cloudinary.uploader.destroy(existing.avatarPublicId).catch(() => {});
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: req.file.path, avatarPublicId: req.file.filename },
      { new: true }
    ).select(PROFILE_FIELDS);

    res.json(user);
  } catch (error) {
    console.error("Upload avatar error:", error.message);
    res.status(500).json({ message: "Avatar upload failed" });
  }
};

// @desc    Upload/replace the logged-in user's cover photo
// @route   POST /api/users/me/cover-photo
// @access  Protected
export const uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const existing = await User.findById(req.user._id).select("coverPhotoPublicId");
    if (existing?.coverPhotoPublicId) {
      await cloudinary.uploader.destroy(existing.coverPhotoPublicId).catch(() => {});
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { coverPhotoUrl: req.file.path, coverPhotoPublicId: req.file.filename },
      { new: true }
    ).select(PROFILE_FIELDS);

    res.json(user);
  } catch (error) {
    console.error("Upload cover photo error:", error.message);
    res.status(500).json({ message: "Cover photo upload failed" });
  }
};

// @desc    Follow or unfollow a user (toggle)
// @route   POST /api/users/:id/follow
// @access  Protected
export const toggleFollow = async (req, res) => {
  try {
    const targetId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (String(targetId) === String(req.user._id)) {
      return res.status(400).json({ message: "You can't follow yourself" });
    }

    const target = await User.findById(targetId).select("_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await Follow.findOne({ follower: req.user._id, following: targetId });

    if (existing) {
      await existing.deleteOne();
      await Promise.all([
        User.updateOne({ _id: req.user._id }, { $inc: { followingCount: -1 } }),
        User.updateOne({ _id: targetId }, { $inc: { followersCount: -1 } }),
      ]);
      return res.json({ isFollowing: false });
    }

    await Follow.create({ follower: req.user._id, following: targetId });
    await Promise.all([
      User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } }),
      User.updateOne({ _id: targetId }, { $inc: { followersCount: 1 } }),
    ]);

    res.json({ isFollowing: true });
  } catch (error) {
    console.error("Toggle follow error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
