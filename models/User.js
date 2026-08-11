// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ["admin", "moderator", "user"], required: true },
    isActive: { type: Boolean, default: true },

    bio: { type: String, default: "", maxlength: 200 },
    avatarUrl: { type: String, default: "" },
    coverPhotoUrl: { type: String, default: "" },
    countryCode: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },

    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
