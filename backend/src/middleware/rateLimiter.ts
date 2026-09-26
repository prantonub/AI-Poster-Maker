import rateLimit from "express-rate-limit";
import { Request } from "express";
import { ApiError } from "./errorHandler";

// Rate-limits by authenticated user id (falls back to IP if somehow
// unauthenticated, though verifyAuth always runs before this in practice).
// This must be mounted AFTER verifyAuth so req.user is populated.
export const createPosterRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.sub ?? req.ip ?? "anonymous",
  handler: (_req, _res, next) => {
    next(new ApiError(429, "Too many posters created recently. Please wait a few minutes and try again."));
  },
});

// The quick-preview endpoint renders up to 5 full Puppeteer screenshots per
// call, so it gets a much tighter budget than single-poster creation.
export const quickPreviewRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.sub ?? req.ip ?? "anonymous",
  handler: (_req, _res, next) => {
    next(new ApiError(429, "Too many quick-preview requests. Please wait a while and try again."));
  },
});
