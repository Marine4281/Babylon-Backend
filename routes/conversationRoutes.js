import express from "express";
import {
  getConversations,
  openConversation,
  getMessages,
  sendMessage,
  sendMoneyMessage,
  markRead,
} from "../controllers/conversationController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getConversations);
router.post("/", openConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);
router.post("/:id/transfer", sendMoneyMessage);
router.patch("/:id/read", markRead);

export default router;
