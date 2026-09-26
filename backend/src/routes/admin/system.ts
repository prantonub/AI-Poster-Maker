import { Router } from "express";
import mongoose from "mongoose";
import os from "os";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { Poster } from "../../models/Poster";
import { Template } from "../../models/Template";
import { GenerationLog } from "../../models/GenerationLog";
import { AuditLog } from "../../models/AuditLog";
import { AppSetting } from "../../models/AppSetting";
import { asyncHandler } from "../../middleware/errorHandler";
import { recordAudit } from "../../services/auditService";
import { getBrowser } from "../../services/browserManager";

const router = Router();

// POST /api/admin/system/reset-stuck-posters
// A poster stuck in "generating" (e.g. the server was killed mid-render) blocks
// the user's history forever. This sweeps them back to "failed" so they can
// retry.
router.post(
  "/system/reset-stuck-posters",
  asyncHandler(async (req, res) => {
    const minutes = Math.min(
      1440,
      Math.max(1, parseInt(String(req.body?.olderThanMinutes ?? "15"), 10) || 15)
    );
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const result = await Poster.updateMany(
      { status: "generating", updatedAt: { $lt: cutoff } },
      {
        $set: {
          status: "failed",
          errorMessage: `Stuck in "generating" for over ${minutes} minutes — reset by admin`,
        },
      }
    );

    await recordAudit(req, {
      action: "system.resetStuckPosters",
      entity: "poster",
      summary: `Reset ${result.modifiedCount} stuck poster(s) to failed`,
      meta: { modified: result.modifiedCount, minutes },
    });

    res.json({ reset: result.modifiedCount, minutes });
  })
);

// POST /api/admin/system/sync-indexes — rebuild declared indexes
router.post(
  "/system/sync-indexes",
  asyncHandler(async (req, res) => {
    const models = { User, Poster, Template, GenerationLog, AuditLog, AppSetting };
    const results: Record<string, unknown> = {};

    for (const [name, model] of Object.entries(models)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results[name] = await (model as any).syncIndexes();
      } catch (err) {
        results[name] = `failed: ${(err as Error).message}`;
      }
    }

    await recordAudit(req, {
      action: "system.syncIndexes",
      entity: "system",
      summary: "Rebuilt MongoDB indexes",
      meta: { results },
    });

    res.json({ results });
  })
);

// GET /api/admin/system — health, configuration readiness and DB statistics
router.get(
  "/system",
  asyncHandler(async (_req, res) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    // Best-effort: Atlas free tiers and some managed providers refuse dbStats.
    let dbStats: { sizeBytes?: number; storageSizeBytes?: number; collections?: number } = {};
    try {
      const raw = await mongoose.connection.db?.admin().command({ dbStats: 1 });
      if (raw) {
        dbStats = {
          sizeBytes: raw.dataSize ?? raw.storageSize,
          storageSizeBytes: raw.storageSize,
          collections: raw.collections,
        };
      }
    } catch {
      dbStats = {};
    }

    // Touching the browser tells us whether the Puppeteer render pipeline can
    // actually start, which is the single most common silent failure.
    let browserReady = false;
    let browserError: string | null = null;
    try {
      const browser = await getBrowser();
      browserReady = browser.connected;
    } catch (err) {
      browserError = (err as Error).message;
    }

    const [userCount, posterCount, templateCount, logCount, auditCount, settingCount] =
      await Promise.all([
        User.estimatedDocumentCount(),
        Poster.estimatedDocumentCount(),
        Template.estimatedDocumentCount(),
        GenerationLog.estimatedDocumentCount(),
        AuditLog.estimatedDocumentCount(),
        AppSetting.estimatedDocumentCount(),
      ]);

    res.json({
      server: {
        uptimeSeconds,
        uptimeLabel: formatUptime(uptimeSeconds),
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        pid: process.pid,
        environment: env.isProd ? "production" : "development",
      },
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        systemFreeBytes: os.freemem(),
        systemTotalBytes: os.totalmem(),
      },
      database: {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name ?? null,
        host: mongoose.connection.host ?? null,
        ...dbStats,
      },
      collections: { userCount, posterCount, templateCount, logCount, auditCount, settingCount },
      services: {
        puppeteer: { ready: browserReady, error: browserError },
      },
      // Only booleans — never the secret values themselves.
      configuration: {
        huggingFace: Boolean(env.hfApiKey),
        cloudinary: Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret),
        mongodb: Boolean(env.mongodbUri),
        jwtSecretSet: Boolean(env.jwtSecret),
      },
    });
  })
);

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default router;
