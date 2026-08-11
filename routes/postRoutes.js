import express from "express";
import { createPost, getFeed, toggleLike, toggleSave, uploadPostMedia } from "../controllers/postController.js";
import { getComments, addComment, addGiftComment } from "../controllers/commentController.js";
import { protect } from "../Middlewares/authMiddleware.js";
import { uploadPostMedia as uploadPostMediaMiddleware } from "../Config/cloudinary.js";

const router = express.Router();

router.use(protect);

router.get("/", getFeed);
router.post("/upload-media", uploadPostMediaMiddleware.array("media", 10), uploadPostMedia);
router.post("/", createPost);
router.post("/:id/like", toggleLike);
router.post("/:id/save", toggleSave);

router.get("/:postId/comments", getComments);
router.post("/:postId/comments", addComment);
router.post("/:postId/comments/gift", addGiftComment);

export default router;
