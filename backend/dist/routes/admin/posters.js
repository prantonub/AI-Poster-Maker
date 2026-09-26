"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Poster_1 = require("../../models/Poster");
const GenerationLog_1 = require("../../models/GenerationLog");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auditService_1 = require("../../services/auditService");
const posterRenderer_1 = require("../../services/posterRenderer");
const adminSchemas_1 = require("../../schemas/adminSchemas");
const helpers_1 = require("./helpers");
const router = (0, express_1.Router)();
const OCCASIONS = ["victory_day", "tribute", "campaign", "greeting", "eid_festival"];
const STATUSES = ["draft", "generating", "completed", "failed"];
/** Shared filter builder so the list view and the CSV export always agree. */
function buildPosterFilter(query) {
    const filter = {};
    const status = (0, helpers_1.str)(query.status);
    if (status && STATUSES.includes(status))
        filter.status = status;
    const occasion = (0, helpers_1.str)(query.occasion);
    if (occasion && OCCASIONS.includes(occasion))
        filter["formData.occasion"] = occasion;
    const userId = (0, helpers_1.str)(query.userId);
    if (userId && mongoose_1.default.isValidObjectId(userId))
        filter.userId = userId;
    const templateId = (0, helpers_1.str)(query.templateId);
    if (templateId && mongoose_1.default.isValidObjectId(templateId))
        filter.templateId = templateId;
    const search = (0, helpers_1.str)(query.search);
    if (search) {
        const rx = new RegExp((0, helpers_1.escapeRegex)(search), "i");
        filter.$or = [{ "formData.headlineText": rx }, { "formData.name": rx }];
    }
    const range = (0, helpers_1.dateRange)(query, "createdAt");
    if (range)
        filter.createdAt = range;
    return filter;
}
const POSTER_SORTS = { createdAt: 1, updatedAt: 1, status: 1 };
// GET /api/admin/posters/export.csv — same filters as the list, capped at 5000 rows
router.get("/export.csv", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const filter = buildPosterFilter(req.query);
    const posters = await Poster_1.Poster.find(filter)
        .populate("userId", "name email")
        .populate("templateId", "title")
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
    const csv = (0, helpers_1.toCsv)(["Poster ID", "Owner", "Email", "Template", "Occasion", "Name", "Headline", "Status", "Retries", "Created"], posters.map((p) => {
        const owner = p.userId;
        const template = p.templateId;
        return [
            String(p._id),
            owner?.name ?? "(deleted user)",
            owner?.email ?? "",
            template?.title ?? "",
            p.formData?.occasion ?? "",
            p.formData?.name ?? "",
            p.formData?.headlineText ?? "",
            p.status,
            p.retryCount,
            p.createdAt,
        ];
    }));
    await (0, auditService_1.recordAudit)(req, {
        action: "poster.export",
        entity: "poster",
        summary: `Exported ${posters.length} poster(s) to CSV`,
        meta: { count: posters.length, filter },
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="posters-${Date.now()}.csv"`);
    res.send(csv);
}));
// POST /api/admin/posters/bulk-delete
router.post("/bulk-delete", (0, validate_1.validateBody)(adminSchemas_1.bulkDeleteSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { ids } = req.body;
    const result = await Poster_1.Poster.deleteMany({ _id: { $in: ids } });
    await GenerationLog_1.GenerationLog.deleteMany({ posterId: { $in: ids } });
    await (0, auditService_1.recordAudit)(req, {
        action: "poster.bulk.delete",
        entity: "poster",
        summary: `Deleted ${result.deletedCount} poster(s)`,
        meta: { ids: ids.length, deleted: result.deletedCount },
    });
    res.json({ deleted: result.deletedCount });
}));
// GET /api/admin/posters
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = (0, helpers_1.paginationParams)(req.query);
    const filter = buildPosterFilter(req.query);
    const sort = (0, helpers_1.sortFrom)(req.query, POSTER_SORTS, { createdAt: -1 });
    const [items, total] = await Promise.all([
        Poster_1.Poster.find(filter)
            .populate("userId", "name email isActive")
            .populate("templateId", "title occasionType")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Poster_1.Poster.countDocuments(filter),
    ]);
    res.json((0, helpers_1.paginated)(items, page, limit, total));
}));
// GET /api/admin/posters/:id
router.get("/:id", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findById(req.params.id)
        .populate("userId", "name email phone")
        .populate("templateId", "title occasionType")
        .lean();
    if (!poster)
        throw new errorHandler_1.ApiError(404, "Poster not found");
    const logs = await GenerationLog_1.GenerationLog.find({ posterId: poster._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    res.json({ ...poster, generationLogs: logs });
}));
// PATCH /api/admin/posters/:id/status — manual status override
router.patch("/:id/status", (0, validate_1.validateBody)(adminSchemas_1.setPosterStatusSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const { status } = req.body;
    const poster = await Poster_1.Poster.findByIdAndUpdate(req.params.id, { status, errorMessage: status === "failed" ? "Manually marked as failed by an admin" : undefined }, { new: true }).lean();
    if (!poster)
        throw new errorHandler_1.ApiError(404, "Poster not found");
    await (0, auditService_1.recordAudit)(req, {
        action: "poster.status.update",
        entity: "poster",
        entityId: poster._id.toString(),
        summary: `Poster status set to ${status}`,
        meta: { status },
    });
    res.json(poster);
}));
// POST /api/admin/posters/:id/regenerate — re-run generation, ignoring the
// owner's retry budget (an operator override for stuck/failed posters).
router.post("/:id/regenerate", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findById(req.params.id);
    if (!poster)
        throw new errorHandler_1.ApiError(404, "Poster not found");
    poster.status = "generating";
    poster.errorMessage = undefined;
    await poster.save();
    (0, posterRenderer_1.generatePoster)(poster._id.toString()).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[admin] unexpected error regenerating ${poster._id}:`, err);
    });
    await (0, auditService_1.recordAudit)(req, {
        action: "poster.regenerate",
        entity: "poster",
        entityId: poster._id.toString(),
        summary: "Regeneration triggered by admin",
    });
    res.status(202).json({ _id: poster._id, status: poster.status });
}));
// DELETE /api/admin/posters/:id
router.delete("/:id", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findByIdAndDelete(req.params.id);
    if (!poster)
        throw new errorHandler_1.ApiError(404, "Poster not found");
    await GenerationLog_1.GenerationLog.deleteMany({ posterId: poster._id });
    await (0, auditService_1.recordAudit)(req, {
        action: "poster.delete",
        entity: "poster",
        entityId: poster._id.toString(),
        summary: `Deleted poster "${poster.formData?.headlineText ?? poster._id}"`,
    });
    res.json({ deleted: true });
}));
exports.default = router;
