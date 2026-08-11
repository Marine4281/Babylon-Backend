import express from "express";
import {
  getReplays,
  getUserReplays,
  getReplay,
  toggleLikeReplay,
  getReplayDownloadUrl,
  deleteReplay,
} from "../controllers/replayController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getReplays);
router.get("/user/:userId", getUserReplays);
router.get("/:id", getReplay);
router.get("/:id/download", getReplayDownloadUrl);
router.post("/:id/like", toggleLikeReplay);
router.delete("/:id", deleteReplay);

export default router;
