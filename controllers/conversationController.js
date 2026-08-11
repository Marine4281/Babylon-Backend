import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

const PARTICIPANT_FIELDS = "username fullName avatarUrl countryCode isVerified";

// @desc    List my conversations, newest activity first
// @route   GET /api/conversations
// @access  Protected
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate("participants", PARTICIPANT_FIELDS)
      .lean();

    res.json({ conversations });
  } catch (error) {
    console.error("Get conversations error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get or create a 1:1 conversation with another user
// @route   POST /api/conversations
// @access  Protected
// body: { userId }  (for a DM)  OR  { isGroup: true, groupName, participantIds: [] }
export const openConversation = async (req, res) => {
  try {
    const { userId, isGroup, groupName, participantIds } = req.body;

    if (isGroup) {
      if (!groupName || !Array.isArray(participantIds) || participantIds.length < 2) {
        return res.status(400).json({ message: "Group needs a name and at least 2 other participants" });
      }
      const conversation = await Conversation.create({
        participants: [req.user._id, ...participantIds],
        isGroup: true,
        groupName,
      });
      const populated = await conversation.populate("participants", PARTICIPANT_FIELDS);
      return res.status(201).json(populated);
    }

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (userId === String(req.user._id)) {
      return res.status(400).json({ message: "Can't start a conversation with yourself" });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, userId],
        isGroup: false,
      });
    }

    const populated = await conversation.populate("participants", PARTICIPANT_FIELDS);
    res.status(201).json(populated);
  } catch (error) {
    console.error("Open conversation error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get paginated messages for a conversation (newest last page = most recent)
// @route   GET /api/conversations/:id/messages?page=1&limit=30
// @access  Protected
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);

    const conversation = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", PARTICIPANT_FIELDS)
      .lean();

    res.json({ page, limit, messages: messages.reverse() });
  } catch (error) {
    console.error("Get messages error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Send a text message in a conversation
// @route   POST /api/conversations/:id/messages
// @access  Protected
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, attachments } = req.body;

    if (!text && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: "Message needs text or an attachment" });
    }

    const conversation = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await Message.create({
      conversation: id,
      sender: req.user._id,
      text: text || "",
      attachments: attachments || [],
      readBy: [req.user._id],
    });

    conversation.lastMessageText = text || "📎 Attachment";
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSender = req.user._id;
    await conversation.save();

    const populated = await message.populate("sender", PARTICIPANT_FIELDS);

    req.app.get("io").to(id).emit("new_message", populated);

    res.status(201).json(populated);
  } catch (error) {
    console.error("Send message error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Send an in-chat P2P money transfer as a message
// @route   POST /api/conversations/:id/transfer
// @access  Protected
// body: { amount }
export const sendMoneyMessage = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Enter a valid amount" });
    }

    const conversation = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    if (conversation.isGroup) {
      return res.status(400).json({ message: "Direct transfers aren't supported in group chats" });
    }

    const recipientId = conversation.participants.find((p) => String(p) !== String(req.user._id));

    let message;
    await session.withTransaction(async () => {
      const senderWallet = await Wallet.findOne({ user: req.user._id }).session(session);
      if (!senderWallet || senderWallet.balance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      let recipientWallet = await Wallet.findOne({ user: recipientId }).session(session);
      if (!recipientWallet) {
        const created = await Wallet.create([{ user: recipientId, balance: 0 }], { session });
        recipientWallet = created[0];
      }

      senderWallet.balance -= amount;
      recipientWallet.balance += amount;
      await senderWallet.save({ session });
      await recipientWallet.save({ session });

      const [outTx] = await Transaction.create(
        [{ user: req.user._id, type: "transfer_out", amount, balanceAfter: senderWallet.balance, relatedUser: recipientId, description: "P2P transfer" }],
        { session }
      );
      await Transaction.create(
        [{ user: recipientId, type: "transfer_in", amount, balanceAfter: recipientWallet.balance, relatedUser: req.user._id, description: "P2P transfer" }],
        { session }
      );

      const [msg] = await Message.create(
        [{
          conversation: id,
          sender: req.user._id,
          text: `Sent you a $${amount.toFixed(2)} peer transfer! 💸`,
          isMoneyTransfer: true,
          amount,
          relatedTransaction: outTx._id,
          readBy: [req.user._id],
        }],
        { session }
      );
      message = msg;

      conversation.lastMessageText = `💸 $${amount.toFixed(2)} transfer`;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSender = req.user._id;
      await conversation.save({ session });
    });

    const populated = await message.populate("sender", PARTICIPANT_FIELDS);
    req.app.get("io").to(id).emit("new_message", populated);

    res.status(201).json(populated);
  } catch (error) {
    if (error.message === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }
    console.error("Send money message error:", error.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

// @desc    Mark all messages in a conversation as read
// @route   PATCH /api/conversations/:id/read
// @access  Protected
export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.updateMany(
      { conversation: id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Mark read error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
