// utils/agoraCloudRecording.js
import axios from "axios";

const AGORA_BASE_URL = "https://api.agora.io/v1/apps";

// Fixed uid the recording bot joins as. It's a subscriber only — it never
// publishes — so any uid outside the range real hosts/users use is fine.
export const RECORDING_UID = process.env.AGORA_RECORDING_UID || "999999";

// Agora's Cloud Recording REST API is authenticated with Basic Auth using
// the Customer ID / Customer Secret pair from Agora Console → RESTful API,
// which is DIFFERENT from the App ID / App Certificate used for RTC tokens.
const authHeader = () => {
  const key = process.env.AGORA_CUSTOMER_KEY;
  const secret = process.env.AGORA_CUSTOMER_SECRET;
  if (!key || !secret) {
    throw new Error("Agora Cloud Recording credentials are not configured");
  }
  const encoded = Buffer.from(`${key}:${secret}`).toString("base64");
  return { Authorization: `Basic ${encoded}`, "Content-Type": "application/json" };
};

const appId = () => {
  const id = process.env.AGORA_APP_ID;
  if (!id) throw new Error("AGORA_APP_ID is not configured");
  return id;
};

// Third-party storage the recording bot uploads finished files to. Agora
// only supports a fixed set of vendors (Cloudinary isn't one) — S3 is the
// default here. The finished file gets pulled from this bucket and
// re-hosted on Cloudinary by the replay-processing step once recording
// finishes; this util only talks to Agora.
const storageConfig = () => ({
  vendor: Number(process.env.AGORA_RECORDING_STORAGE_VENDOR || 1), // 1 = Amazon S3
  region: Number(process.env.AGORA_RECORDING_STORAGE_REGION || 0), // 0 = US_EAST_1
  bucket: process.env.AGORA_RECORDING_BUCKET,
  accessKey: process.env.AGORA_RECORDING_ACCESS_KEY,
  secretKey: process.env.AGORA_RECORDING_SECRET_KEY,
  fileNamePrefix: ["babylon", "recordings"],
});

/**
 * Step 1 — Acquire a cloud recording resource for a channel. Must be called
 * before start; the returned resourceId is only valid for 5 minutes if unused.
 */
export const acquireRecordingResource = async (channelName) => {
  const url = `${AGORA_BASE_URL}/${appId()}/cloud_recording/acquire`;
  const { data } = await axios.post(
    url,
    {
      cname: channelName,
      uid: RECORDING_UID,
      clientRequest: {
        resourceExpiredHour: 24,
        scene: 0, // 0 = real-time recording
      },
    },
    { headers: authHeader() }
  );
  return data.resourceId;
};

/**
 * Step 2 — Start recording. mode "mix" composites all streams into a single
 * MP4 (what we want for LIVE → one replay video). `recordingToken` is an
 * Agora RTC subscriber token issued for RECORDING_UID on this channel —
 * generate it with generateAgoraRtcToken(channelName, RECORDING_UID, "subscriber").
 */
export const startCloudRecording = async (channelName, resourceId, recordingToken) => {
  const url = `${AGORA_BASE_URL}/${appId()}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
  const { data } = await axios.post(
    url,
    {
      cname: channelName,
      uid: RECORDING_UID,
      clientRequest: {
        token: recordingToken,
        recordingConfig: {
          channelType: 1, // 1 = live broadcast
          streamTypes: 2, // 2 = audio + video
          maxIdleTime: 120, // auto-stop if the channel goes silent for 2 min
          transcodingConfig: {
            width: 720,
            height: 1280, // portrait — matches vertical LIVE video
            fps: 30,
            bitrate: 1130,
            mixedVideoLayout: 1, // 1 = best-fit composite layout
          },
        },
        storageConfig: storageConfig(),
      },
    },
    { headers: authHeader() }
  );
  return data.sid; // recording session id — store alongside resourceId on the LiveRoom
};

/**
 * Step 3 — Poll recording status mid-stream (e.g. to confirm the bot is
 * actually recording before showing a "recording" indicator in the UI).
 */
export const queryCloudRecording = async (resourceId, sid) => {
  const url = `${AGORA_BASE_URL}/${appId()}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`;
  const { data } = await axios.get(url, { headers: authHeader() });
  return data;
};

/**
 * Step 4 — Stop recording when the host ends the LIVE. Response includes
 * the uploaded file(s) in serverResponse.fileList — that's what kicks off
 * replay processing (download from S3 → upload to Cloudinary → save Replay).
 */
export const stopCloudRecording = async (channelName, resourceId, sid) => {
  const url = `${AGORA_BASE_URL}/${appId()}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`;
  const { data } = await axios.post(
    url,
    {
      cname: channelName,
      uid: RECORDING_UID,
      clientRequest: {},
    },
    { headers: authHeader() }
  );
  return data;
};
