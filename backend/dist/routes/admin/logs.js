"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const GenerationLog_1 = require("../../models/GenerationLog");
const AuditLog_1 = require("../../models/AuditLog");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auditService_1 = require("../../services/auditService");
const adminSchemas_1 = require("../../schemas/adminSchemas");
const helpers_1 = require("./helpers");
const router = (0, express_1.Router)();
// GET /api/admin/generation-logs?success=&userId=&posterId=&from=&to=&page=&limit=
router.get("/generation-logs", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = (0, helpers_1.paginationParams)(req.query, 25);
    const filter = {};
    const success = (0, helpers_1.str)(req.query.success);
    if (success === "true" || success === "false") {
        filter.success = success === "true";
    }
    const userId = (0, helpers_1.str)(req.query.userId);
    if (userId && mongoose_1.default.isValidObjectId(userId))
        filter.userId = userId;
    const posterId = (0, helpers_1.str)(req.query.posterId);
    if (posterId && mongoose_1.default.isValidObjectId(posterId))
        filter.posterId = posterId;
    const search = (0, helpers_1.str)(req.query.search);
    if (search)
        filter.errorMessage = new RegExp((0, helpers_1.escapeRegex)(search), "i");
    const range = (0, helpers_1.dateRange)(req.query, "createdAt");
    if (range)
        filter.createdAt = range;
    const [items, total, summary] = await Promise.all([
        GenerationLog_1.GenerationLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        GenerationLog_1.GenerationLog.countDocuments(filter),
        GenerationLog_1.GenerationLog.aggregate([
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
        ...(0, helpers_1.paginated)(items, page, limit, total),
        summary: {
            total: stats.total,
            success: stats.success,
            failed: stats.failed,
            successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null,
            avgLatencyMs: stats.avgLatencyMs ? Math.round(stats.avgLatencyMs) : null,
            totalTokens: stats.totalTokens ?? 0,
        },
    });
}));
// POST /api/admin/generation-logs/purge — retention control
router.post("/generation-logs/purge", (0, validate_1.validateBody)(adminSchemas_1.purgeLogsSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { olderThanDays } = req.body;
    if (olderThanDays === 0) {
        throw new errorHandler_1.ApiError(400, "Refusing to purge every log. Choose a retention of at least 1 day.");
    }
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await GenerationLog_1.GenerationLog.deleteMany({ createdAt: { $lt: cutoff } });
    await (0, auditService_1.recordAudit)(req, {
        action: "logs.purge",
        entity: "generationLog",
        summary: `Purged ${result.deletedCount} generation log(s) older than ${olderThanDays} day(s)`,
        meta: { olderThanDays, deleted: result.deletedCount, cutoff },
    });
    res.json({ deleted: result.deletedCount, cutoff });
}));
// GET /api/admin/audit-logs — who changed what, when
router.get("/audit-logs", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = (0, helpers_1.paginationParams)(req.query, 25);
    const filter = {};
    const action = (0, helpers_1.str)(req.query.action);
    if (action)
        filter.action = new RegExp(`^${(0, helpers_1.escapeRegex)(action)}`, "i");
    const entity = (0, helpers_1.str)(req.query.entity);
    if (entity)
        filter.entity = entity;
    const search = (0, helpers_1.str)(req.query.search);
    if (search) {
        const rx = new RegExp((0, helpers_1.escapeRegex)(search), "i");
        filter.$or = [{ summary: rx }, { adminEmail: rx }, { action: rx }];
    }
    const range = (0, helpers_1.dateRange)(req.query, "createdAt");
    if (range)
        filter.createdAt = range;
    const [items, total] = await Promise.all([
        AuditLog_1.AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        AuditLog_1.AuditLog.countDocuments(filter),
    ]);
    res.json((0, helpers_1.paginated)(items, page, limit, total));
}));
exports.default = router;
