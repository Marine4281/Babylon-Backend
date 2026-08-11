import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import LiveRoom from "./models/LiveRoom.js";
import Conversation from "./models/Conversation.js";
import { startReplayCleanupJob } from "./jobs/replayCleanup.js";

dotenv.config();

/* ========================================
   🗄️ CONNECT TO MONGODB
======================================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB error:", err));

const PORT = process.env.PORT || 5000;

/* ========================================
   🌐 CREATE HTTP SERVER
======================================== */
const server = http.createServer(app);

/* ========================================
   🔌 SOCKET.IO SETUP
======================================== */
const ALLOWED_ORIGINS = [
  "https://babylon-frontend.vercel.app",
  "http://localhost:3000", // local dev
];

export const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PATCH"],
  },
});

/* Make io accessible in routes/controllers via req.app.get("io") */
app.set("io", io);

/* ========================================
   🔐 SOCKET AUTH — every socket must present the same
   JWT used for REST calls, passed as `auth: { token }`
   on the client's io() connection options
======================================== */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Not authorized, no token"));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Not authorized, token failed"));
  }
});

/* ========================================
   🔗 SOCKET CONNECTION — ROOMS
======================================== */
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id, "user:", socket.userId);

  // Scoped room join: only allow joining `live_<roomId>` if that room is
  // actually live, or a conversation id the socket's user is a participant of.
  socket.on("join_room", async (room) => {
    try {
      if (typeof room !== "string" || !room) return;

      if (room.startsWith("live_")) {
        const roomId = room.slice("live_".length);
        const liveRoom = await LiveRoom.findById(roomId).select("_id status");
        if (!liveRoom || liveRoom.status !== "live") {
          return socket.emit("join_room_error", { room, message: "Live room not found or has ended" });
        }
        return socket.join(room);
      }

      // Otherwise treat it as a conversation id
      const conversation = await Conversation.findOne({
        _id: room,
        participants: socket.userId,
      }).select("_id");

      if (!conversation) {
        return socket.emit("join_room_error", { room, message: "Not authorized to join this room" });
      }

      socket.join(room);
    } catch (error) {
      console.error("join_room error:", error.message);
      socket.emit("join_room_error", { room, message: "Could not join room" });
    }
  });

  socket.on("leave_room", (room) => {
    socket.leave(room);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

/* ========================================
   🧹 SCHEDULED JOBS
======================================== */
startReplayCleanupJob();

/* ========================================
   🚀 START SERVER
======================================== */
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
