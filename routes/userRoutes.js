import express from "express";
import { getProfile, updateProfile, toggleFollow, uploadAvatar, uploadCoverPhoto } from "../controllers/userController.js";
import { protect } from "../Middlewares/authMiddleware.js";
import { uploadAvatar as uploadAvatarMiddleware, uploadCoverPhoto as uploadCoverPhotoMiddleware } from "../Config/cloudinary.js";

const router = express.Router();

router.use(protect);

router.put("/me", updateProfile);
router.post("/me/avatar", uploadAvatarMiddleware.single("avatar"), uploadAvatar);
router.post("/me/cover-photo", uploadCoverPhotoMiddleware.single("cover"), uploadCoverPhoto);
router.get("/:username", getProfile);
router.post("/:id/follow", toggleFollow);

export default router;
