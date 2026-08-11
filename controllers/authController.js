import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (user, wallet) => ({
  _id: user._id,
  uniqueId: user.uniqueId,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  country: user.country,
  role: user.role,
  badge: user.badge,
  hiddenSections: user.hiddenSections,
  wallet: {
    balance: wallet?.balance || 0,
    earnedToday: wallet?.earnedToday || 0,
    totalWithdrawn: wallet?.totalWithdrawn || 0,
  },
});

export const register = async (req, res) => {
  try {
    const {
      fullName, email, gender, phone, phoneCountry,
      password, confirmPassword, agreedToTerms,
    } = req.body;

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered" });

    if (await User.findOne({ phone }))
      return res.status(400).json({ message: "Phone already registered" });

    // ── IP country detection — unchanged ──────────────────────────
    let ipCountry = "Unknown";
    try {
      const ip =
        (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "";
      const isPrivate = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
      if (!isPrivate && ip) {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country`);
        const geoData = await geoRes.json();
        if (geoData?.country) ipCountry = geoData.country;
      }
    } catch {
      // geo lookup failed — non-blocking
    }

    const countryMismatch =
      phoneCountry &&
      ipCountry !== "Unknown" &&
      phoneCountry.toLowerCase() !== ipCountry.toLowerCase();

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName,
      email,
      gender,
      phone,
      phoneCountry: phoneCountry || null,
      country: ipCountry,
      countryMismatch: !!countryMismatch,
      password: hashedPassword,
      agreedToTerms,
      isVerified: true, // no verification email — active right away
    });

    const wallet = await Wallet.create({ user: newUser._id, balance: 0 });

    res.status(201).json({
      token: signToken(newUser),
      user: publicUser(newUser, wallet),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Login with EITHER email or phone
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password)
      return res.status(400).json({ message: "Enter your email/phone and password" });

    const value = identifier.trim();

    const user = await User.findOne({
      $or: [{ email: value.toLowerCase() }, { phone: value }],
    }).populate("badge", "name imageUrl hidden");

    if (!user) return res.status(400).json({ message: "Invalid login or password" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been suspended." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid login or password" });

    const wallet = await Wallet.findOne({ user: user._id });

    res.json({
      token: signToken(user),
      user: publicUser(user, wallet),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
