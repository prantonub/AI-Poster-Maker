import { Router } from "express";
import { env } from "../config/env";
import { verifyAuth } from "../middleware/auth";
import { createPosterRateLimiter } from "../middleware/rateLimiter";
import { requireGenerationEnabled } from "../middleware/platformSettings";
import { validateBody } from "../middleware/validate";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { generatePosterSchema } from "../schemas/posterSchemas";
import { generatePosterImage, editPosterImage } from "../services/posterImageService";
import { uploadBufferToCloudinary } from "../services/uploadService";

const router = Router();

// POST /api/generate-poster — prompt-to-image AI poster generation.
// Body: { prompt, aspectRatio, image? }. When `image` is present the request
// is an EDIT of that previously generated poster ("Edit with Prompt");
// otherwise it's a fresh generation. The Hugging Face API key stays on the
// server (HF_API_KEY) and never reaches the frontend.
router.post(
  "/",
  verifyAuth,
  requireGenerationEnabled,
  createPosterRateLimiter,
  validateBody(generatePosterSchema),
  asyncHandler(async (req, res) => {
    const { prompt, aspectRatio, image } = req.body;

    if (!env.hfApiKey) {
      throw new ApiError(
        503,
        "AI generation is not configured yet (HF_API_KEY is missing on the server). Please try again later."
      );
    }

    const result = image
      ? await editPosterImage(image, prompt, aspectRatio)
      : await generatePosterImage(prompt, aspectRatio);

    const buffer = Buffer.from(result.base64, "base64");
    const uploaded = await uploadBufferToCloudinary(buffer, "poster-maker/ai-posters").catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[generate-poster] Cloudinary upload failed:", err);
      throw new ApiError(502, "The generated image could not be saved. Please try again.");
    });

    res.json({ imageUrl: uploaded.url, prompt, aspectRatio });
  })
);

export default router;