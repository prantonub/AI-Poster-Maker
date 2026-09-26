"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickPreviewRateLimiter = exports.createPosterRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const errorHandler_1 = require("./errorHandler");
// Rate-limits by authenticated user id (falls back to IP if somehow
// unauthenticated, though verifyAuth always runs before this in practice).
// This must be mounted AFTER verifyAuth so req.user is populated.
exports.createPosterRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub ?? req.ip ?? "anonymous",
    handler: (_req, _res, next) => {
        next(new errorHandler_1.ApiError(429, "Too many posters created recently. Please wait a few minutes and try again."));
    },
});
// The quick-preview endpoint renders up to 5 full Puppeteer screenshots per
// call, so it gets a much tighter budget than single-poster creation.
exports.quickPreviewRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub ?? req.ip ?? "anonymous",
    handler: (_req, _res, next) => {
        next(new errorHandler_1.ApiError(429, "Too many quick-preview requests. Please wait a while and try again."));
    },
});
