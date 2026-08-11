import express from "express";
import {
  startLiveRoom,
  joinLiveRoom,
  leaveLiveRoom,
  endLiveRoom,
  getLiveRooms,
  giftLiveRoom,
} from "../controllers/liveController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getLiveRooms);
router.post("/", startLiveRoom);
router.post("/:roomId/join", joinLiveRoom);
router.post("/:roomId/leave", leaveLiveRoom);
router.post("/:roomId/end", endLiveRoom);
router.post("/:roomId/gift", giftLiveRoom);

export default router;
