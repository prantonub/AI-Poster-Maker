"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Poster_1 = require("../models/Poster");
const Template_1 = require("../models/Template");
const GenerationLog_1 = require("../models/GenerationLog");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Every route in this file is admin-only.
router.use(auth_1.verifyAuth, auth_1.verifyAdmin);
function paginationParams(query) {
    const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
// GET /api/admin/stats — dashboard overview
router.get("/stats", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const [userCount, posterCounts, templateCount, activeTemplateCount, geminiLogCount, geminiSuccessCount] = await Promise.all([
        User_1.User.countDocuments(),
        Poster_1.Poster.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Template_1.Template.countDocuments(),
        Template_1.Template.countDocuments({ isActive: true }),
        GenerationLog_1.GenerationLog.countDocuments(),
        GenerationLog_1.GenerationLog.countDocuments({ success: true }),
    ]);
    const postersByStatus = { draft: 0, generating: 0, completed: 0, failed: 0 };
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
}));
// GET /api/admin/users
router.get("/users", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const [items, total] = await Promise.all([
        User_1.User.find().select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
        User_1.User.countDocuments(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));
// GET /api/admin/posters — across ALL users, optionally filtered by status
router.get("/posters", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = {};
    if (req.query.status && typeof req.query.status === "string") {
        filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
        Poster_1.Poster.find(filter)
            .populate("userId", "name email")
            .populate("templateId", "title occasionType")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Poster_1.Poster.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));
// GET /api/admin/templates — including inactive ones (unlike the public route)
router.get("/templates", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const templates = await Template_1.Template.find().sort({ occasionType: 1 });
    res.json(templates);
}));
// PATCH /api/admin/templates/:id/toggle — flip isActive
router.patch("/templates/:id/toggle", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid template id");
    }
    const template = await Template_1.Template.findById(req.params.id);
    if (!template) {
        throw new errorHandler_1.ApiError(404, "Template not found");
    }
    template.isActive = !template.isActive;
    await template.save();
    res.json(template);
}));
// GET /api/admin/generation-logs — Gemini cost/usage tracking
router.get("/generation-logs", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const [items, total] = await Promise.all([
        GenerationLog_1.GenerationLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
        GenerationLog_1.GenerationLog.countDocuments(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));
exports.default = router;
