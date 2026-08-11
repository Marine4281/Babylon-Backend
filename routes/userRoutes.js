import express from "express";
import { getProfile, updateProfile, toggleFollow } from "../controllers/userController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.put("/me", updateProfile);
router.get("/:username", getProfile);
router.post("/:id/follow", toggleFollow);

export default router;
