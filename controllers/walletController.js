import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

// Ensures every user has a wallet without needing a signup-time hook
const getOrCreateWallet = async (userId, session = null) => {
  let wallet = await Wallet.findOne({ user: userId }).session(session);
  if (!wallet) {
    const created = await Wallet.create([{ user: userId, balance: 0 }], { session });
    wallet = created[0];
  }
  return wallet;
};

// @desc    Get my wallet balance
// @route   GET /api/wallet/me
// @access  Protected
export const getMyWallet = async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error("Get wallet error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get my transaction history (paginated)
// @route   GET /api/wallet/transactions?page=1&limit=20
// @access  Protected
export const getTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("relatedUser", "username avatarUrl")
      .lean();

    res.json({ page, limit, transactions });
  } catch (error) {
    console.error("Get transactions error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Deposit funds into wallet
// @route   POST /api/wallet/deposit
// @access  Protected
// NOTE: this credits the wallet directly. Wire up a real payment gateway
// (Daraja/Stripe/etc — same pattern RestoPOS uses) before going live; right
// now it's a trusted-client stub so the rest of Home can be built against it.
export const deposit = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Enter a valid deposit amount" });
    }

    const wallet = await getOrCreateWallet(req.user._id);
    wallet.balance += amount;
    await wallet.save();

    await Transaction.create({
      user: req.user._id,
      type: "deposit",
      amount,
      balanceAfter: wallet.balance,
      status: "completed",
      description: "Wallet deposit",
    });

    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error("Deposit error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Withdraw funds from wallet
// @route   POST /api/wallet/withdraw
// @access  Protected
// NOTE: same as deposit — stubbed until a real payout gateway is wired in.
export const withdraw = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Enter a valid withdrawal amount" });
    }

    const wallet = await getOrCreateWallet(req.user._id);
    if (wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    wallet.balance -= amount;
    await wallet.save();

    await Transaction.create({
      user: req.user._id,
      type: "withdrawal",
      amount,
      balanceAfter: wallet.balance,
      status: "completed",
      description: "Wallet withdrawal",
    });

    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error("Withdraw error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    P2P transfer to another Babylonian by username
// @route   POST /api/wallet/transfer
// @access  Protected
export const transfer = async (req, res) => {
  const { username, amount: rawAmount } = req.body;
  const amount = Number(rawAmount);

  if (!username || !amount || amount <= 0) {
    return res.status(400).json({ message: "Recipient username and a valid amount are required" });
  }

  const recipient = await User.findOne({ username: username.toLowerCase().trim() });
  if (!recipient) {
    return res.status(404).json({ message: "Babylonian not found" });
  }
  if (String(recipient._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't send money to yourself" });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const senderWallet = await getOrCreateWallet(req.user._id, session);
      if (senderWallet.balance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }
      const recipientWallet = await getOrCreateWallet(recipient._id, session);

      senderWallet.balance -= amount;
      recipientWallet.balance += amount;
      await senderWallet.save({ session });
      await recipientWallet.save({ session });

      await Transaction.create(
        [
          {
            user: req.user._id,
            type: "transfer_out",
            amount,
            balanceAfter: senderWallet.balance,
            relatedUser: recipient._id,
            description: `Sent to @${recipient.username}`,
          },
          {
            user: recipient._id,
            type: "transfer_in",
            amount,
            balanceAfter: recipientWallet.balance,
            relatedUser: req.user._id,
            description: `Received from @${req.user.username}`,
          },
        ],
        { session }
      );

      result = { balance: senderWallet.balance };
    });

    res.json(result);
  } catch (error) {
    if (error.message === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    console.error("Transfer error:", error.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

export { getOrCreateWallet };
