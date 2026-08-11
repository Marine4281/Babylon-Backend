import Report from "../models/Report.js";

const REPORTABLE_TYPES = ["post", "comment", "reel", "replay", "liveRoom", "user"];
const REPORT_REASONS = ["spam", "harassment", "copyright", "illegal_content", "privacy", "other"];

// @desc    File a report against a post, comment, reel, replay, live room, or user
// @route   POST /api/reports
// @access  Protected
export const createReport = async (req, res) => {
  try {
    const { targetType, targetId, reason, details = "" } = req.body;

    if (!REPORTABLE_TYPES.includes(targetType)) {
      return res.status(400).json({ message: "Invalid targetType" });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Invalid reason" });
    }
    if (!targetId) {
      return res.status(400).json({ message: "targetId is required" });
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      details: details.trim(),
    });

    res.status(201).json({ message: "Report submitted", report });
  } catch (error) {
    console.error("Create report error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    List reports for moderation review — filter by ?status= and ?targetType=
// @route   GET /api/reports
// @access  Protected (admin, moderator)
export const getReports = async (req, res) => {
  try {
    const filter = {};
    if (["open", "reviewed", "actioned", "dismissed"].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (REPORTABLE_TYPES.includes(req.query.targetType)) {
      filter.targetType = req.query.targetType;
    }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .populate("reporter", "username fullName avatarUrl")
      .lean();

    res.json({ reports });
  } catch (error) {
    console.error("Get reports error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update a report's status after moderation review
// @route   PATCH /api/reports/:id
// @access  Protected (admin, moderator)
export const updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["open", "reviewed", "actioned", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json({ report });
  } catch (error) {
    console.error("Update report status error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
