import { v4 as uuidv4 } from "uuid";
import LiveRoom from "../models/LiveRoom.js";
import { generateAgoraRtcToken } from "../utils/agoraToken.js";
import { acquireRecordingResource, startCloudRecording, RECORDING_UID } from "../utils/agoraCloudRecording.js";
import { HOST_FIELDS } from "./liveController.js";

// @desc    Go live with video — one broadcaster, many viewers. Recording is
//          on by default; pass recordingEnabled: false to opt out.
// @route   POST /api/live/video
// @access  Protected
export const startVideoLiveRoom = async (req, res) => {
  try {
    const { title = "", recordingEnabled = true } = req.body;

    const existing = await LiveRoom.findOne({ host: req.user._id, status: "live" });
    if (existing) {
      return res.status(400).json({ message: "You already have an active live room", room: existing });
    }

    const channelName = `babylon_live_video_${uuidv4()}`;

    const room = await LiveRoom.create({
      host: req.user._id,
      type: "video",
      title: title.trim(),
      channelName,
      recordingEnabled: Boolean(recordingEnabled),
    });

    // Recording is best-effort — if Agora's recording API fails, the LIVE
    // still goes ahead, it just won't produce a replay.
    if (room.recordingEnabled) {
      try {
        const resourceId = await acquireRecordingResource(channelName);
        const recordingToken = generateAgoraRtcToken(channelName, RECORDING_UID, "subscriber");
        const sid = await startCloudRecording(channelName, resourceId, recordingToken);

        room.recording = {
          agoraResourceId: resourceId,
          agoraSid: sid,
          recordingUid: RECORDING_UID,
          status: "recording",
        };
        await room.save();
      } catch (recordingError) {
        console.error("Start cloud recording error:", recordingError.message);
        room.recording.status = "failed";
        await room.save();
      }
    }

    const token = generateAgoraRtcToken(channelName, req.user._id.toString(), "publisher");
    const populated = await room.populate("host", HOST_FIELDS);

    res.status(201).json({
      room: populated,
      agora: {
        appId: process.env.AGORA_APP_ID,
        channelName,
        token,
        uid: req.user._id.toString(),
        role: "publisher",
      },
    });
  } catch (error) {
    console.error("Start video live room error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
