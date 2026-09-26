"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const validate_1 = require("../middleware/validate");
const errorHandler_1 = require("../middleware/errorHandler");
const posterSchemas_1 = require("../schemas/posterSchemas");
const posterImageService_1 = require("../services/posterImageService");
const uploadService_1 = require("../services/uploadService");
const router = (0, express_1.Router)();
// POST /api/generate-poster — prompt-to-image AI poster generation.
// Body: { prompt, aspectRatio, image? }. When `image` is present the request
// is an EDIT of that previously generated poster ("Edit with Prompt");
// otherwise it's a fresh generation. The Gemini API key stays on the server
// (GEMINI_API_KEY) and never reaches the frontend.
router.post("/", auth_1.verifyAuth, rateLimiter_1.createPosterRateLimiter, (0, validate_1.validateBody)(posterSchemas_1.generatePosterSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { prompt, aspectRatio, image } = req.body;
    if (!env_1.env.geminiApiKey) {
        throw new errorHandler_1.ApiError(503, "AI generation is not configured yet (GEMINI_API_KEY is missing on the server). Please try again later.");
    }
    const result = image
        ? await (0, posterImageService_1.editPosterImage)(image, prompt, aspectRatio)
        : await (0, posterImageService_1.generatePosterImage)(prompt, aspectRatio);
    const buffer = Buffer.from(result.base64, "base64");
    const uploaded = await (0, uploadService_1.uploadBufferToCloudinary)(buffer, "poster-maker/ai-posters").catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[generate-poster] Cloudinary upload failed:", err);
        throw new errorHandler_1.ApiError(502, "The generated image could not be saved. Please try again.");
    });
    res.json({ imageUrl: uploaded.url, prompt, aspectRatio });
}));
exports.default = router;
