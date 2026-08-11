// utils/replayProcessing.js
import { cloudinary } from "../Config/cloudinary.js";
import LiveRoom from "../models/LiveRoom.js";
import Replay from "../models/Replay.js";
import { stopCloudRecording } from "./agoraCloudRecording.js";

const REPLAY_LIFETIME_DAYS = 30;

// Builds the public S3 URL Agora Cloud Recording uploaded the file to.
// Assumes the recording bucket is public-read (or fronted by a CDN) — swap
// this for a presigned URL if the bucket is locked down.
const buildRecordingFileUrl = (fileName) => {
  const bucket = process.env.AGORA_RECORDING_BUCKET;
  const region = process.env.AGORA_RECORDING_STORAGE_REGION_NAME || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`;
};

/**
 * Called right after a host ends a LIVE that had recording enabled. Stops
 * the Agora cloud recording, then moves the finished file from S3 to
 * Cloudinary and creates the Replay doc. Runs in the background — doesn't
 * block the end-live response.
 */
export const finalizeReplay = async (room, io) => {
  try {
    if (!room.recording?.agoraResourceId || !room.recording?.agoraSid) return;

    await LiveRoom.updateOne({ _id: room._id }, { "recording.status": "stopping" });

    const stopResult = await stopCloudRecording(
      room.channelName,
      room.recording.agoraResourceId,
      room.recording.agoraSid
    );

    const fileList = stopResult?.serverResponse?.fileList;
    const fileName = Array.isArray(fileList) ? fileList[0]?.fileName : fileList?.fileName;

    if (!fileName) {
      await LiveRoom.updateOne({ _id: room._id }, { "recording.status": "failed" });
      return;
    }

    await LiveRoom.updateOne({ _id: room._id }, { "recording.status": "processing" });

    const sourceUrl = buildRecordingFileUrl(fileName);

    const uploaded = await cloudinary.uploader.upload(sourceUrl, {
      resource_type: "video",
      folder: "babylon/replays",
      public_id: `replay_${room._id}`,
    });

    const thumbnailUrl = cloudinary.url(uploaded.public_id, {
      resource_type: "video",
      format: "jpg",
      transformation: [{ width: 720, crop: "limit" }],
    });

    const expiresAt = new Date(Date.now() + REPLAY_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

    const replay = await Replay.create({
      liveRoom: room._id,
      creator: room.host,
      type: room.type,
      title: room.title,
      thumbnailUrl,
      videoUrl: uploaded.secure_url,
      videoPublicId: uploaded.public_id,
      duration: Math.round(uploaded.duration || 0),
      expiresAt,
      status: "ready",
    });

    await LiveRoom.updateOne(
      { _id: room._id },
      { replay: replay._id, "recording.status": "ready" }
    );

    io.to(`live_${room._id}`).emit("live:replay_ready", {
      roomId: room._id,
      replayId: replay._id,
    });
  } catch (error) {
    console.error("Finalize replay error:", error.message);
    await LiveRoom.updateOne({ _id: room._id }, { "recording.status": "failed" }).catch(() => {});
  }
};
