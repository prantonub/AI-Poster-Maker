import { Router } from "express";
import mongoose from "mongoose";
import { GenerationLog } from "../../models/GenerationLog";
import { AuditLog } from "../../models/AuditLog";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { recordAudit } from "../../services/auditService";
import { purgeLogsSchema } from "../../schemas/adminSchemas";
import { paginationParams, paginated, str, escapeRegex, dateRange } from "./helpers";

const router = Router();

// GET /api/admin/generation-logs?success=&userId=&posterId=&from=&to=&page=&limit=
router.get(
  "/generation-logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query, 25);
    const filter: Record<string, unknown> = {};

    const success = str(req.query.success);
    if (success === "true" || success === "false") {
      filter.success = success === "true";
    }

    const userId = str(req.query.userId);
    if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;

    const posterId = str(req.query.posterId);
    if (posterId && mongoose.isValidObjectId(posterId)) filter.posterId = posterId;

    const search = str(req.query.search);
    if (search) filter.errorMessage = new RegExp(escapeRegex(search), "i");

    const range = dateRange(req.query, "createdAt");
    if (range) filter.createdAt = range;

    const [items, total, summary] = await Promise.all([
      GenerationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GenerationLog.countDocuments(filter),
      GenerationLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: { $sum: { $cond: ["$success", 1, 0] } },
            failed: { $sum: { $cond: ["$success", 0, 1] } },
            avgLatencyMs: { $avg: "$latencyMs" },
            totalTokens: { $sum: "$tokensUsed" },
          },
        },
      ]),
    ]);

    const stats = summary[0] ?? { total: 0, success: 0, failed: 0, avgLatencyMs: null, totalTokens: 0 };

    res.json({
      ...paginated(items, page, limit, total),
      summary: {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null,
        avgLatencyMs: stats.avgLatencyMs ? Math.round(stats.avgLatencyMs) : null,
        totalTokens: stats.totalTokens ?? 0,
      },
    });
  })
);

// POST /api/admin/generation-logs/purge — retention control
router.post(
  "/generation-logs/purge",
  validateBody(purgeLogsSchema),
  asyncHandler(async (req, res) => {
    const { olderThanDays } = req.body as { olderThanDays: number };

    if (olderThanDays === 0) {
      throw new ApiError(400, "Refusing to purge every log. Choose a retention of at least 1 day.");
    }

    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await GenerationLog.deleteMany({ createdAt: { $lt: cutoff } });

    await recordAudit(req, {
      action: "logs.purge",
      entity: "generationLog",
      summary: `Purged ${result.deletedCount} generation log(s) older than ${olderThanDays} day(s)`,
      meta: { olderThanDays, deleted: result.deletedCount, cutoff },
    });

    res.json({ deleted: result.deletedCount, cutoff });
  })
);

// GET /api/admin/audit-logs — who changed what, when
router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query, 25);
    const filter: Record<string, unknown> = {};

    const action = str(req.query.action);
    if (action) filter.action = new RegExp(`^${escapeRegex(action)}`, "i");

    const entity = str(req.query.entity);
    if (entity) filter.entity = entity;

    const search = str(req.query.search);
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ summary: rx }, { adminEmail: rx }, { action: rx }];
    }

    const range = dateRange(req.query, "createdAt");
    if (range) filter.createdAt = range;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json(paginated(items, page, limit, total));
  })
);

export default router;
