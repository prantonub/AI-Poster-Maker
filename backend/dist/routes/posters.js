"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Poster_1 = require("../models/Poster");
const Template_1 = require("../models/Template");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const validate_1 = require("../middleware/validate");
const errorHandler_1 = require("../middleware/errorHandler");
const posterSchemas_1 = require("../schemas/posterSchemas");
const posterRenderer_1 = require("../services/posterRenderer");
const styleSuggestionService_1 = require("../services/styleSuggestionService");
const router = (0, express_1.Router)();
const MAX_RETRIES = 3;
function requireOwnership(posterUserId, requestUserId) {
    if (posterUserId.toString() !== requestUserId) {
        throw new errorHandler_1.ApiError(403, "You do not have access to this poster");
    }
}
// POST /api/posters — create + kick off generation asynchronously
router.post("/", auth_1.verifyAuth, rateLimiter_1.createPosterRateLimiter, (0, validate_1.validateBody)(posterSchemas_1.createPosterSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { templateId, formData, uploadedPhotoUrls } = req.body;
    const template = await Template_1.Template.findById(templateId);
    if (!template || !template.isActive) {
        throw new errorHandler_1.ApiError(404, "Template not found");
    }
    const poster = await Poster_1.Poster.create({
        userId: req.user.sub,
        templateId,
        formData,
        uploadedPhotoUrls,
        status: "generating",
        retryCount: 0,
    });
    // Fire-and-forget: the pipeline persists its own success/failure onto
    // the Poster doc, so we don't await it here. The frontend polls
    // GET /api/posters/:id for status.
    (0, posterRenderer_1.generatePoster)(poster._id.toString()).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[posters] unexpected error generating ${poster._id}:`, err);
    });
    res.status(202).json({ _id: poster._id, status: poster.status });
}));
// POST /api/posters/quick-preview — renders one preview per active template
// (up to 5) from a single headline/name, without saving anything to Poster
// history. Used by the homepage's "one prompt, every banner style" demo.
router.post("/quick-preview", auth_1.verifyAuth, rateLimiter_1.quickPreviewRateLimiter, (0, validate_1.validateBody)(posterSchemas_1.quickPreviewSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const formData = req.body;
    const templates = await Template_1.Template.find({ isActive: true }).sort({ occasionType: 1 });
    if (templates.length === 0) {
        throw new errorHandler_1.ApiError(404, "No active templates to preview");
    }
    const results = [];
    // Sequential, not parallel: all renders share one Puppeteer browser
    // instance, and running 5 screenshots concurrently against it would
    // spike memory for no real speed benefit in a single-process MVP.
    for (const template of templates) {
        try {
            const { imageUrl, resolved } = await (0, posterRenderer_1.renderTemplateToImageUrl)(template, formData, [], // quick preview never has real uploaded photos
            template.occasionType);
            if (resolved.source === "gemini") {
                template.lastGeminiSuggestion = (0, styleSuggestionService_1.toCachedSuggestion)(resolved.suggestion);
                await template.save();
            }
            results.push({
                templateId: template._id.toString(),
                title: template.title,
                occasionType: template.occasionType,
                imageUrl,
            });
        }
        catch (err) {
            // One occasion's render failing shouldn't sink the whole batch —
            // skip it and log server-side.
            // eslint-disable-next-line no-console
            console.error(`[quick-preview] failed for template ${template._id}:`, err);
        }
    }
    if (results.length === 0) {
        throw new errorHandler_1.ApiError(500, "Failed to render any preview banners");
    }
    res.json({ results });
}));
// GET /api/posters/:id — poll for status/result
router.get("/:id", auth_1.verifyAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findById(req.params.id);
    if (!poster) {
        throw new errorHandler_1.ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user.sub);
    res.json(poster);
}));
// POST /api/posters/:id/regenerate — re-run the pipeline, capped retries
router.post("/:id/regenerate", auth_1.verifyAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findById(req.params.id);
    if (!poster) {
        throw new errorHandler_1.ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user.sub);
    if (poster.retryCount >= MAX_RETRIES) {
        throw new errorHandler_1.ApiError(429, `Maximum of ${MAX_RETRIES} regenerations reached for this poster`);
    }
    poster.retryCount += 1;
    poster.status = "generating";
    poster.errorMessage = undefined;
    await poster.save();
    (0, posterRenderer_1.generatePoster)(poster._id.toString()).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[posters] unexpected error regenerating ${poster._id}:`, err);
    });
    res.status(202).json({ _id: poster._id, status: poster.status, retryCount: poster.retryCount });
}));
// GET /api/posters/user/:userId — paginated history, most recent first
router.get("/user/:userId", auth_1.verifyAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose_1.default.isValidObjectId(userId)) {
        throw new errorHandler_1.ApiError(400, "Invalid user id");
    }
    if (userId !== req.user.sub && req.user.role !== "admin") {
        throw new errorHandler_1.ApiError(403, "You can only view your own posters");
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "12"), 10) || 12));
    const [items, total] = await Promise.all([
        Poster_1.Poster.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Poster_1.Poster.countDocuments({ userId }),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));
// DELETE /api/posters/:id
router.delete("/:id", auth_1.verifyAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        throw new errorHandler_1.ApiError(400, "Invalid poster id");
    }
    const poster = await Poster_1.Poster.findById(req.params.id);
    if (!poster) {
        throw new errorHandler_1.ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user.sub);
    await poster.deleteOne();
    res.status(204).send();
}));
exports.default = router;
