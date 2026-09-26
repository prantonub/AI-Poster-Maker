import { Router } from "express";
import mongoose from "mongoose";
import { Poster } from "../models/Poster";
import { Template } from "../models/Template";
import { verifyAuth } from "../middleware/auth";
import { createPosterRateLimiter, quickPreviewRateLimiter } from "../middleware/rateLimiter";
import { requireGenerationEnabled } from "../middleware/platformSettings";
import { validateBody } from "../middleware/validate";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { createPosterSchema, quickPreviewSchema } from "../schemas/posterSchemas";
import { generatePoster, renderTemplateToImageUrl } from "../services/posterRenderer";
import { toCachedSuggestion } from "../services/styleSuggestionService";

const router = Router();
const MAX_RETRIES = 3;

function requireOwnership(posterUserId: mongoose.Types.ObjectId, requestUserId: string) {
  if (posterUserId.toString() !== requestUserId) {
    throw new ApiError(403, "You do not have access to this poster");
  }
}

// POST /api/posters — create + kick off generation asynchronously
router.post(
  "/",
  verifyAuth,
  requireGenerationEnabled,
  createPosterRateLimiter,
  validateBody(createPosterSchema),
  asyncHandler(async (req, res) => {
    const { templateId, formData, uploadedPhotoUrls } = req.body;

    const template = await Template.findById(templateId);
    if (!template || !template.isActive) {
      throw new ApiError(404, "Template not found");
    }

    const poster = await Poster.create({
      userId: req.user!.sub,
      templateId,
      formData,
      uploadedPhotoUrls,
      status: "generating",
      retryCount: 0,
    });

    // Fire-and-forget: the pipeline persists its own success/failure onto
    // the Poster doc, so we don't await it here. The frontend polls
    // GET /api/posters/:id for status.
    generatePoster(poster._id.toString()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[posters] unexpected error generating ${poster._id}:`, err);
    });

    res.status(202).json({ _id: poster._id, status: poster.status });
  })
);

// POST /api/posters/quick-preview — renders one preview per active template
// (up to 5) from a single headline/name, without saving anything to Poster
// history. Used by the homepage's "one prompt, every banner style" demo.
router.post(
  "/quick-preview",
  verifyAuth,
  requireGenerationEnabled,
  quickPreviewRateLimiter,
  validateBody(quickPreviewSchema),
  asyncHandler(async (req, res) => {
    const formData = req.body as {
      name: string;
      designation: string;
      party: string;
      district: string;
      thana: string;
      union: string;
      headlineText: string;
    };

    const templates = await Template.find({ isActive: true }).sort({ occasionType: 1 });
    if (templates.length === 0) {
      throw new ApiError(404, "No active templates to preview");
    }

    const results: { templateId: string; title: string; occasionType: string; imageUrl: string }[] = [];

    // Sequential, not parallel: all renders share one Puppeteer browser
    // instance, and running 5 screenshots concurrently against it would
    // spike memory for no real speed benefit in a single-process MVP.
    for (const template of templates) {
      try {
        const { imageUrl, resolved } = await renderTemplateToImageUrl(
          template,
          formData,
          [], // quick preview never has real uploaded photos
          template.occasionType
        );

        if (resolved.source === "gemini") {
          template.lastGeminiSuggestion = toCachedSuggestion(resolved.suggestion);
          await template.save();
        }

        results.push({
          templateId: template._id.toString(),
          title: template.title,
          occasionType: template.occasionType,
          imageUrl,
        });
      } catch (err) {
        // One occasion's render failing shouldn't sink the whole batch —
        // skip it and log server-side.
        // eslint-disable-next-line no-console
        console.error(`[quick-preview] failed for template ${template._id}:`, err);
      }
    }

    if (results.length === 0) {
      throw new ApiError(500, "Failed to render any preview banners");
    }

    res.json({ results });
  })
);

// GET /api/posters/:id — poll for status/result
router.get(
  "/:id",
  verifyAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      throw new ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user!.sub);
    res.json(poster);
  })
);

// POST /api/posters/:id/regenerate — re-run the pipeline, capped retries
router.post(
  "/:id/regenerate",
  verifyAuth,
  requireGenerationEnabled,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      throw new ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user!.sub);

    if (poster.retryCount >= MAX_RETRIES) {
      throw new ApiError(429, `Maximum of ${MAX_RETRIES} regenerations reached for this poster`);
    }

    poster.retryCount += 1;
    poster.status = "generating";
    poster.errorMessage = undefined;
    await poster.save();

    generatePoster(poster._id.toString()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[posters] unexpected error regenerating ${poster._id}:`, err);
    });

    res.status(202).json({ _id: poster._id, status: poster.status, retryCount: poster.retryCount });
  })
);

// GET /api/posters/user/:userId — paginated history, most recent first
router.get(
  "/user/:userId",
  verifyAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
    if (userId !== req.user!.sub && req.user!.role !== "admin") {
      throw new ApiError(403, "You can only view your own posters");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "12"), 10) || 12));

    const [items, total] = await Promise.all([
      Poster.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Poster.countDocuments({ userId }),
    ]);

    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

// DELETE /api/posters/:id
router.delete(
  "/:id",
  verifyAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      throw new ApiError(404, "Poster not found");
    }
    requireOwnership(poster.userId, req.user!.sub);

    await poster.deleteOne();
    res.status(204).send();
  })
);

export default router;
