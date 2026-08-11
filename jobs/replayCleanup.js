// jobs/replayCleanup.js
import cron from "node-cron";
import { cloudinary } from "../Config/cloudinary.js";
import Replay from "../models/Replay.js";
import LiveRoom from "../models/LiveRoom.js";

// Deletes replays whose 30-day window has passed and that the creator
// didn't mark "Keep Forever" — removes the video from Cloudinary too.
const deleteExpiredReplays = async () => {
  const expired = await Replay.find({
    keepForever: false,
    expiresAt: { $lte: new Date() },
  }).select("_id videoPublicId liveRoom");

  for (const replay of expired) {
    try {
      if (replay.videoPublicId) {
        await cloudinary.uploader.destroy(replay.videoPublicId, { resource_type: "video" });
      }
      await LiveRoom.updateOne({ replay: replay._id }, { $unset: { replay: "" } });
      await replay.deleteOne();
    } catch (error) {
      console.error(`Replay cleanup error (${replay._id}):`, error.message);
    }
  }

  if (expired.length) {
    console.log(`🧹 Cleaned up ${expired.length} expired replay(s)`);
  }
};

// Runs once a day at 03:00 server time.
export const startReplayCleanupJob = () => {
  cron.schedule("0 3 * * *", deleteExpiredReplays);
};
