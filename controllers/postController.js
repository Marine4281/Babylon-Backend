import Post from "../models/Post.js";
import Bookmark from "../models/Bookmark.js";
import Comment from "../models/Comment.js";

const AUTHOR_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    Create a new post
// @route   POST /api/posts
// @access  Protected
export const createPost = async (req, res) => {
  try {
    const { caption, media } = req.body;

    if (!caption && (!media || media.length === 0)) {
      return res.status(400).json({ message: "Post needs a caption or media" });
    }

    const post = await Post.create({
      author: req.user._id,
      caption: caption || "",
      media: media || [],
    });

    const populated = await post.populate("author", AUTHOR_FIELDS);
    res.status(201).json(populated);
  } catch (error) {
    console.error("Create post error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get the home feed (paginated, newest first)
// @route   GET /api/posts?page=1&limit=10
// @access  Protected
export const getFeed = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", AUTHOR_FIELDS)
      .lean();

    if (posts.length === 0) {
      return res.json({ page, limit, posts: [] });
    }

    const postIds = posts.map((p) => p._id);

    // Figure out which of these posts the current user liked/saved, in one query each
    const [savedRows, topGifts] = await Promise.all([
      Bookmark.find({ user: req.user._id, post: { $in: postIds } }).select("post").lean(),
      Comment.aggregate([
        { $match: { post: { $in: postIds }, isGift: true } },
        { $sort: { giftAmount: -1 } },
        {
          $group: {
            _id: "$post",
            topComment: { $first: "$$ROOT" },
          },
        },
      ]),
    ]);

    const savedSet = new Set(savedRows.map((b) => String(b.post)));
    const topGiftMap = new Map(topGifts.map((g) => [String(g._id), g.topComment]));

    const shaped = posts.map((p) => ({
      ...p,
      isLiked: p.likes?.some((id) => String(id) === String(req.user._id)) || false,
      isSaved: savedSet.has(String(p._id)),
      topGiftComment: topGiftMap.get(String(p._id)) || null,
      likes: undefined, // don't ship the full likes array to the client
    }));

    res.json({ page, limit, posts: shaped });
  } catch (error) {
    console.error("Get feed error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Like or unlike a post
// @route   POST /api/posts/:id/like
// @access  Protected
export const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.some((id) => String(id) === String(req.user._id));

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => String(id) !== String(req.user._id));
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likes.push(req.user._id);
      post.likesCount += 1;
    }

    await post.save();
    res.json({ isLiked: !alreadyLiked, likesCount: post.likesCount });
  } catch (error) {
    console.error("Toggle like error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Save or unsave a post (bookmark)
// @route   POST /api/posts/:id/save
// @access  Protected
export const toggleSave = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select("_id");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const existing = await Bookmark.findOne({ user: req.user._id, post: post._id });

    if (existing) {
      await existing.deleteOne();
      return res.json({ isSaved: false });
    }

    await Bookmark.create({ user: req.user._id, post: post._id });
    res.json({ isSaved: true });
  } catch (error) {
    console.error("Toggle save error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
