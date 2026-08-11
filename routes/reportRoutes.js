import express from "express";
import { createReport, getReports, updateReportStatus } from "../controllers/reportController.js";
import { protect } from "../Middlewares/authMiddleware.js";
import roleMiddleware from "../Middlewares/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// Any authenticated user can file a report
router.post("/", createReport);

// Reviewing reports is restricted to admin/moderator
router.get("/", roleMiddleware("admin", "moderator"), getReports);
router.patch("/:id", roleMiddleware("admin", "moderator"), updateReportStatus);

export default router;
