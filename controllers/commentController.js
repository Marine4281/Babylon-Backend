import mongoose from "mongoose";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Transaction from "../models/Transaction.js";
import { getOrCreateWallet } from "./walletController.js";

const AUTHOR_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    Get comments for a post — gift comments first (highest gift on top),
//          then regular comments newest first
// @route   GET /api/posts/:postId/comments?page=1&limit=20
// @access  Protected
export const getComments = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const comments = await Comment.find({ post: req.params.postId })
      .sort({ isGift: -1, giftAmount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", AUTHOR_FIELDS)
      .lean();

    res.json({ page, limit, comments });
  } catch (error) {
    console.error("Get comments error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add a plain text comment
// @route   POST /api/posts/:postId/comments
// @access  Protected
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment can't be empty" });
    }

    const post = await Post.findById(req.params.postId).select("_id");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      text: text.trim(),
    });

    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });

    const populated = await comment.populate("author", AUTHOR_FIELDS);
    res.status(201).json(populated);
  } catch (error) {
    console.error("Add comment error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add a gift comment — attaches real money to a comment, visible
//          beneath the post. Debits the sender and credits the post's author.
// @route   POST /api/posts/:postId/comments/gift
// @access  Protected
export const addGiftComment = async (req, res) => {
  const { text, amount: rawAmount } = req.body;
  const amount = Number(rawAmount);

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Enter a valid gift amount" });
  }

  const post = await Post.findById(req.params.postId).select("_id author");
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (String(post.author) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't gift your own post" });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const senderWallet = await getOrCreateWallet(req.user._id, session);
      if (senderWallet.balance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }
      const creatorWallet = await getOrCreateWallet(post.author, session);

      senderWallet.balance -= amount;
      creatorWallet.balance += amount;
      await senderWallet.save({ session });
      await creatorWallet.save({ session });

      const created = await Comment.create(
        [
          {
            post: post._id,
            author: req.user._id,
            text: (text && text.trim()) || "Sent a gift! 🔥",
            isGift: true,
            giftAmount: amount,
          },
        ],
        { session }
      );
      const comment = created[0];

      await Post.updateOne(
        { _id: post._id },
        { $inc: { commentsCount: 1, giftTotal: amount } },
        { session }
      );

      await Transaction.create(
        [
          {
            user: req.user._id,
            type: "gift_sent",
            amount,
            balanceAfter: senderWallet.balance,
            relatedUser: post.author,
            relatedPost: post._id,
            relatedComment: comment._id,
            description: "Gift sent on a post",
          },
          {
            user: post.author,
            type: "gift_received",
            amount,
            balanceAfter: creatorWallet.balance,
            relatedUser: req.user._id,
            relatedPost: post._id,
            relatedComment: comment._id,
            description: "Gift received on a post",
          },
        ],
        { session }
      );

      result = await comment.populate("author", AUTHOR_FIELDS);
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    console.error("Gift comment error:", error.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};
