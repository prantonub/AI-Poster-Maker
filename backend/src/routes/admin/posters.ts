import { Router, Request } from "express";
import mongoose from "mongoose";
import { Poster } from "../../models/Poster";
import { GenerationLog } from "../../models/GenerationLog";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { recordAudit } from "../../services/auditService";
import { generatePoster } from "../../services/posterRenderer";
import { setPosterStatusSchema, bulkDeleteSchema } from "../../schemas/adminSchemas";
import { paginationParams, paginated, str, escapeRegex, dateRange, sortFrom, toCsv } from "./helpers";

const router = Router();

const OCCASIONS = ["victory_day", "tribute", "campaign", "greeting", "eid_festival"];
const STATUSES = ["draft", "generating", "completed", "failed"];

/** Shared filter builder so the list view and the CSV export always agree. */
function buildPosterFilter(query: Request["query"]): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const status = str(query.status);
  if (status && STATUSES.includes(status)) filter.status = status;

  const occasion = str(query.occasion);
  if (occasion && OCCASIONS.includes(occasion)) filter["formData.occasion"] = occasion;

  const userId = str(query.userId);
  if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;

  const templateId = str(query.templateId);
  if (templateId && mongoose.isValidObjectId(templateId)) filter.templateId = templateId;

  const search = str(query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ "formData.headlineText": rx }, { "formData.name": rx }];
  }

  const range = dateRange(query, "createdAt");
  if (range) filter.createdAt = range;

  return filter;
}

const POSTER_SORTS = { createdAt: 1, updatedAt: 1, status: 1 } as const;

// GET /api/admin/posters/export.csv — same filters as the list, capped at 5000 rows
router.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const filter = buildPosterFilter(req.query);
    const posters = await Poster.find(filter)
      .populate("userId", "name email")
      .populate("templateId", "title")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const csv = toCsv(
      ["Poster ID", "Owner", "Email", "Template", "Occasion", "Name", "Headline", "Status", "Retries", "Created"],
      posters.map((p) => {
        const owner = p.userId as unknown as { name?: string; email?: string } | null;
        const template = p.templateId as unknown as { title?: string } | null;
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
      })
    );

    await recordAudit(req, {
      action: "poster.export",
      entity: "poster",
      summary: `Exported ${posters.length} poster(s) to CSV`,
      meta: { count: posters.length, filter },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="posters-${Date.now()}.csv"`);
    res.send(csv);
  })
);

// POST /api/admin/posters/bulk-delete
router.post(
  "/bulk-delete",
  validateBody(bulkDeleteSchema),
  asyncHandler(async (req, res) => {
    const { ids } = req.body as { ids: string[] };
    const result = await Poster.deleteMany({ _id: { $in: ids } });
    await GenerationLog.deleteMany({ posterId: { $in: ids } });

    await recordAudit(req, {
      action: "poster.bulk.delete",
      entity: "poster",
      summary: `Deleted ${result.deletedCount} poster(s)`,
      meta: { ids: ids.length, deleted: result.deletedCount },
    });

    res.json({ deleted: result.deletedCount });
  })
);

// GET /api/admin/posters
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = buildPosterFilter(req.query);
    const sort = sortFrom(req.query, POSTER_SORTS, { createdAt: -1 });

    const [items, total] = await Promise.all([
      Poster.find(filter)
        .populate("userId", "name email isActive")
        .populate("templateId", "title occasionType")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Poster.countDocuments(filter),
    ]);

    res.json(paginated(items, page, limit, total));
  })
);

// GET /api/admin/posters/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findById(req.params.id)
      .populate("userId", "name email phone")
      .populate("templateId", "title occasionType")
      .lean();
    if (!poster) throw new ApiError(404, "Poster not found");

    const logs = await GenerationLog.find({ posterId: poster._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ ...poster, generationLogs: logs });
  })
);

// PATCH /api/admin/posters/:id/status — manual status override
router.patch(
  "/:id/status",
  validateBody(setPosterStatusSchema),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const { status } = req.body as { status: "draft" | "generating" | "completed" | "failed" };

    const poster = await Poster.findByIdAndUpdate(
      req.params.id,
      { status, errorMessage: status === "failed" ? "Manually marked as failed by an admin" : undefined },
      { new: true }
    ).lean();
    if (!poster) throw new ApiError(404, "Poster not found");

    await recordAudit(req, {
      action: "poster.status.update",
      entity: "poster",
      entityId: poster._id.toString(),
      summary: `Poster status set to ${status}`,
      meta: { status },
    });

    res.json(poster);
  })
);

// POST /api/admin/posters/:id/regenerate — re-run generation, ignoring the
// owner's retry budget (an operator override for stuck/failed posters).
router.post(
  "/:id/regenerate",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findById(req.params.id);
    if (!poster) throw new ApiError(404, "Poster not found");

    poster.status = "generating";
    poster.errorMessage = undefined;
    await poster.save();

    generatePoster(poster._id.toString()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[admin] unexpected error regenerating ${poster._id}:`, err);
    });

    await recordAudit(req, {
      action: "poster.regenerate",
      entity: "poster",
      entityId: poster._id.toString(),
      summary: "Regeneration triggered by admin",
    });

    res.status(202).json({ _id: poster._id, status: poster.status });
  })
);

// DELETE /api/admin/posters/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid poster id");
    }
    const poster = await Poster.findByIdAndDelete(req.params.id);
    if (!poster) throw new ApiError(404, "Poster not found");

    await GenerationLog.deleteMany({ posterId: poster._id });

    await recordAudit(req, {
      action: "poster.delete",
      entity: "poster",
      entityId: poster._id.toString(),
      summary: `Deleted poster "${poster.formData?.headlineText ?? poster._id}"`,
    });

    res.json({ deleted: true });
  })
);

export default router;
