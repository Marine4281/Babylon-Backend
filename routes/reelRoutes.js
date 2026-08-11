import express from "express";
import {
  createReelFromReplay,
  getReels,
  getUserReels,
  toggleLikeReel,
  deleteReel,
} from "../controllers/reelController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getReels);
router.get("/user/:userId", getUserReels);
router.post("/from-replay/:replayId", createReelFromReplay);
router.post("/:id/like", toggleLikeReel);
router.delete("/:id", deleteReel);

export default router;
