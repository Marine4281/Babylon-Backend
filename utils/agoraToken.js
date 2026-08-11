import pkg from "agora-access-token";
const { RtcTokenBuilder, RtcRole } = pkg;

// Generates a short-lived Agora RTC token for a given channel + user.
// role: "publisher" (host, can send audio/video) or "subscriber" (viewer, receive-only)
export const generateAgoraRtcToken = (channelName, uid, role = "subscriber") => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error("Agora credentials are not configured");
  }

  const expirationTimeInSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const agoraRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs
  );
};
