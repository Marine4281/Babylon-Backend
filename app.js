// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// Routes
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import liveRoutes from "./routes/liveRoutes.js";

dotenv.config();

/* =================================================
   APP
================================================= */
const app = express();

app.set("trust proxy", 1);

/* CORS */
const ALLOWED_ORIGINS = [
  "https://babylon-frontend.vercel.app", // TODO: replace with your real deployed frontend URL
  "http://localhost:3000", // local dev
  "http://localhost:5173", // vite default dev port
];

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

/* Body parser */
app.use(express.json());

/* Health check */
app.get("/", (req, res) => {
  res.json({ status: "Babylon backend running" });
});

/* =================================================
   ROUTES
================================================= */
app.use("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/live", liveRoutes);

export default app;
