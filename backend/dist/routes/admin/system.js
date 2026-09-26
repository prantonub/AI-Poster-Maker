"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const os_1 = __importDefault(require("os"));
const env_1 = require("../../config/env");
const User_1 = require("../../models/User");
const Poster_1 = require("../../models/Poster");
const Template_1 = require("../../models/Template");
const GenerationLog_1 = require("../../models/GenerationLog");
const AuditLog_1 = require("../../models/AuditLog");
const AppSetting_1 = require("../../models/AppSetting");
const errorHandler_1 = require("../../middleware/errorHandler");
const auditService_1 = require("../../services/auditService");
const browserManager_1 = require("../../services/browserManager");
const router = (0, express_1.Router)();
// POST /api/admin/system/reset-stuck-posters
// A poster stuck in "generating" (e.g. the server was killed mid-render) blocks
// the user's history forever. This sweeps them back to "failed" so they can
// retry.
router.post("/system/reset-stuck-posters", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const minutes = Math.min(1440, Math.max(1, parseInt(String(req.body?.olderThanMinutes ?? "15"), 10) || 15));
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const result = await Poster_1.Poster.updateMany({ status: "generating", updatedAt: { $lt: cutoff } }, {
        $set: {
            status: "failed",
            errorMessage: `Stuck in "generating" for over ${minutes} minutes — reset by admin`,
        },
    });
    await (0, auditService_1.recordAudit)(req, {
        action: "system.resetStuckPosters",
        entity: "poster",
        summary: `Reset ${result.modifiedCount} stuck poster(s) to failed`,
        meta: { modified: result.modifiedCount, minutes },
    });
    res.json({ reset: result.modifiedCount, minutes });
}));
// POST /api/admin/system/sync-indexes — rebuild declared indexes
router.post("/system/sync-indexes", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const models = { User: User_1.User, Poster: Poster_1.Poster, Template: Template_1.Template, GenerationLog: GenerationLog_1.GenerationLog, AuditLog: AuditLog_1.AuditLog, AppSetting: AppSetting_1.AppSetting };
    const results = {};
    for (const [name, model] of Object.entries(models)) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results[name] = await model.syncIndexes();
        }
        catch (err) {
            results[name] = `failed: ${err.message}`;
        }
    }
    await (0, auditService_1.recordAudit)(req, {
        action: "system.syncIndexes",
        entity: "system",
        summary: "Rebuilt MongoDB indexes",
        meta: { results },
    });
    res.json({ results });
}));
// GET /api/admin/system — health, configuration readiness and DB statistics
router.get("/system", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = process.uptime();
    // Best-effort: Atlas free tiers and some managed providers refuse dbStats.
    let dbStats = {};
    try {
        const raw = await mongoose_1.default.connection.db?.admin().command({ dbStats: 1 });
        if (raw) {
            dbStats = {
                sizeBytes: raw.dataSize ?? raw.storageSize,
                storageSizeBytes: raw.storageSize,
                collections: raw.collections,
            };
        }
    }
    catch {
        dbStats = {};
    }
    // Touching the browser tells us whether the Puppeteer render pipeline can
    // actually start, which is the single most common silent failure.
    let browserReady = false;
    let browserError = null;
    try {
        const browser = await (0, browserManager_1.getBrowser)();
        browserReady = browser.connected;
    }
    catch (err) {
        browserError = err.message;
    }
    const [userCount, posterCount, templateCount, logCount, auditCount, settingCount] = await Promise.all([
        User_1.User.estimatedDocumentCount(),
        Poster_1.Poster.estimatedDocumentCount(),
        Template_1.Template.estimatedDocumentCount(),
        GenerationLog_1.GenerationLog.estimatedDocumentCount(),
        AuditLog_1.AuditLog.estimatedDocumentCount(),
        AppSetting_1.AppSetting.estimatedDocumentCount(),
    ]);
    res.json({
        server: {
            uptimeSeconds,
            uptimeLabel: formatUptime(uptimeSeconds),
            nodeVersion: process.version,
            platform: `${os_1.default.type()} ${os_1.default.release()}`,
            pid: process.pid,
            environment: env_1.env.isProd ? "production" : "development",
        },
        memory: {
            rssBytes: mem.rss,
            heapUsedBytes: mem.heapUsed,
            heapTotalBytes: mem.heapTotal,
            systemFreeBytes: os_1.default.freemem(),
            systemTotalBytes: os_1.default.totalmem(),
        },
        database: {
            connected: mongoose_1.default.connection.readyState === 1,
            readyState: mongoose_1.default.connection.readyState,
            name: mongoose_1.default.connection.name ?? null,
            host: mongoose_1.default.connection.host ?? null,
            ...dbStats,
        },
        collections: { userCount, posterCount, templateCount, logCount, auditCount, settingCount },
        services: {
            puppeteer: { ready: browserReady, error: browserError },
        },
        // Only booleans — never the secret values themselves.
        configuration: {
            huggingFace: Boolean(env_1.env.hfApiKey),
            cloudinary: Boolean(env_1.env.cloudinary.cloudName && env_1.env.cloudinary.apiKey && env_1.env.cloudinary.apiSecret),
            mongodb: Boolean(env_1.env.mongodbUri),
            jwtSecretSet: Boolean(env_1.env.jwtSecret),
        },
    });
}));
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}
exports.default = router;
