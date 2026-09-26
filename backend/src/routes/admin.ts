import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Poster } from "../models/Poster";
import { Template } from "../models/Template";
import { GenerationLog } from "../models/GenerationLog";
import { verifyAuth, verifyAdmin } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

const router = Router();

// Every route in this file is admin-only.
router.use(verifyAuth, verifyAdmin);

function paginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /api/admin/stats — dashboard overview
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [userCount, posterCounts, templateCount, activeTemplateCount, geminiLogCount, geminiSuccessCount] =
      await Promise.all([
        User.countDocuments(),
        Poster.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Template.countDocuments(),
        Template.countDocuments({ isActive: true }),
        GenerationLog.countDocuments(),
        GenerationLog.countDocuments({ success: true }),
      ]);

    const postersByStatus: Record<string, number> = { draft: 0, generating: 0, completed: 0, failed: 0 };
    for (const row of posterCounts) {
      postersByStatus[row._id] = row.count;
    }

    res.json({
      userCount,
      templateCount,
      activeTemplateCount,
      postersByStatus,
      totalPosters: Object.values(postersByStatus).reduce((a, b) => a + b, 0),
      geminiCalls: geminiLogCount,
      geminiSuccessRate: geminiLogCount > 0 ? Math.round((geminiSuccessCount / geminiLogCount) * 100) : null,
    });
  })
);

// GET /api/admin/users
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const [items, total] = await Promise.all([
      User.find().select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

// GET /api/admin/posters — across ALL users, optionally filtered by status
router.get(
  "/posters",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.status && typeof req.query.status === "string") {
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      Poster.find(filter)
        .populate("userId", "name email")
        .populate("templateId", "title occasionType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Poster.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

// GET /api/admin/templates — including inactive ones (unlike the public route)
router.get(
  "/templates",
  asyncHandler(async (_req, res) => {
    const templates = await Template.find().sort({ occasionType: 1 });
    res.json(templates);
  })
);

// PATCH /api/admin/templates/:id/toggle — flip isActive
router.patch(
  "/templates/:id/toggle",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid template id");
    }
    const template = await Template.findById(req.params.id);
    if (!template) {
      throw new ApiError(404, "Template not found");
    }
    template.isActive = !template.isActive;
    await template.save();
    res.json(template);
  })
);

// GET /api/admin/generation-logs — Gemini cost/usage tracking
router.get(
  "/generation-logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const [items, total] = await Promise.all([
      GenerationLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      GenerationLog.countDocuments(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

export default router;
