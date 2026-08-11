// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // allows many docs with no email
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allows many docs with no phone
    },
    password: { type: String, required: true }, // bcrypt hash
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "moderator", "user"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
