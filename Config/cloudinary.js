// Config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Post media (images + videos — feed posts, reels) ───────────────
// resource_type "auto" lets Cloudinary detect image vs video per file,
// so one input can accept a photo post or a video post.
const postMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "babylon/posts",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"],
  },
});

export const uploadPostMedia = multer({
  storage: postMediaStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — covers short video posts
});

// ── Profile avatar ──────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "babylon/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }],
  },
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ── Profile cover photo ─────────────────────────────────────────────
const coverPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "babylon/covers",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, crop: "limit" }],
  },
});

export const uploadCoverPhoto = multer({
  storage: coverPhotoStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

export { cloudinary };
