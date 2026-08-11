import express from "express";
import {
  joinLiveRoom,
  leaveLiveRoom,
  endLiveRoom,
  getLiveRooms,
  giftLiveRoom,
} from "../controllers/liveController.js";
import { startVideoLiveRoom } from "../controllers/liveVideoController.js";
import {
  startAudioLiveRoom,
  requestToSpeak,
  approveSpeaker,
  removeSpeaker,
} from "../controllers/audioLiveController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Shared
router.get("/", getLiveRooms);
router.post("/:roomId/join", joinLiveRoom);
router.post("/:roomId/leave", leaveLiveRoom);
router.post("/:roomId/end", endLiveRoom);
router.post("/:roomId/gift", giftLiveRoom);

// Video-only
router.post("/video", startVideoLiveRoom);

// Voice-only
router.post("/voice", startAudioLiveRoom);
router.post("/voice/:roomId/request-speak", requestToSpeak);
router.post("/voice/:roomId/approve-speak/:userId", approveSpeaker);
router.post("/voice/:roomId/remove-speaker/:userId", removeSpeaker);

export default router;
