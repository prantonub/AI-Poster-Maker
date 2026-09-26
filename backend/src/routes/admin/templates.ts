import { Router } from "express";
import mongoose from "mongoose";
import { Template } from "../../models/Template";
import { Poster } from "../../models/Poster";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { recordAudit } from "../../services/auditService";
import { templateFileExists } from "../../services/templateFileService";
import {
  createTemplateSchema,
  updateTemplateSchema,
  bulkTemplateActionSchema,
  EMPTY_LAYOUT_CONFIG,
} from "../../schemas/adminSchemas";
import { str, escapeRegex } from "./helpers";

const router = Router();

const OCCASIONS = ["victory_day", "tribute", "campaign", "greeting", "eid_festival"];

/** Guards a template path so an admin can't point the renderer at ../../etc. */
function assertSafeTemplatePath(fileName: string) {
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new ApiError(400, "Template file name must not contain path separators");
  }
  if (!templateFileExists(fileName)) {
    throw new ApiError(400, `Template HTML file "${fileName}" was not found on the server`);
  }
}

async function findTemplateOr404(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid template id");
  }
  const template = await Template.findById(id);
  if (!template) {
    throw new ApiError(404, "Template not found");
  }
  return template;
}

// POST /api/admin/templates/bulk
router.post(
  "/bulk",
  validateBody(bulkTemplateActionSchema),
  asyncHandler(async (req, res) => {
    const { action, ids } = req.body as { action: "activate" | "deactivate" | "delete"; ids: string[] };

    if (action === "delete") {
      // Templates referenced by posters stay put — deactivating is the safe
      // alternative, and we surface the count so the admin understands why.
      const inUse = await Poster.countDocuments({ templateId: { $in: ids } });
      if (inUse > 0) {
        throw new ApiError(
          409,
          `${inUse} poster(s) still use these templates. Deactivate them instead of deleting.`
        );
      }
      const result = await Template.deleteMany({ _id: { $in: ids } });
      await recordAudit(req, {
        action: "template.bulk.delete",
        entity: "template",
        summary: `Deleted ${result.deletedCount} template(s)`,
        meta: { deleted: result.deletedCount },
      });
      res.json({ affected: result.deletedCount });
      return;
    }

    const isActive = action === "activate";
    const result = await Template.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive } }
    );
    await recordAudit(req, {
      action: `template.bulk.${action}`,
      entity: "template",
      summary: `${action} applied to ${result.modifiedCount} template(s)`,
      meta: { modified: result.modifiedCount },
    });
    res.json({ affected: result.modifiedCount });
  })
);

// GET /api/admin/templates — includes inactive ones, with usage counts
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};

    const occasion = str(req.query.occasion);
    if (occasion && OCCASIONS.includes(occasion)) filter.occasionType = occasion;

    const search = str(req.query.search);
    if (search) {
      filter.title = new RegExp(escapeRegex(search), "i");
    }

    const isActive = str(req.query.isActive);
    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    const templates = await Template.find(filter).sort({ occasionType: 1, createdAt: -1 }).lean();

    const usage = await Poster.aggregate([
      { $group: { _id: "$templateId", count: { $sum: 1 } } },
    ]);
    const usageByTemplate = new Map(usage.map((u) => [String(u._id), u.count as number]));

    res.json(
      templates.map((t) => ({
        ...t,
        _id: String(t._id),
        posterCount: usageByTemplate.get(String(t._id)) ?? 0,
        fileExists: templateFileExists(t.htmlTemplatePath),
      }))
    );
  })
);

// POST /api/admin/templates
router.post(
  "/",
  validateBody(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      title: string;
      occasionType: string;
      thumbnailUrl: string;
      htmlTemplatePath: string;
      layoutConfig?: Record<string, unknown>;
      isActive: boolean;
    };

    assertSafeTemplatePath(body.htmlTemplatePath);

    const duplicate = await Template.findOne({ title: body.title });
    if (duplicate) {
      throw new ApiError(409, "A template with this title already exists");
    }

    const template = await Template.create({
      ...body,
      layoutConfig: body.layoutConfig ?? EMPTY_LAYOUT_CONFIG,
    });

    await recordAudit(req, {
      action: "template.create",
      entity: "template",
      entityId: template._id.toString(),
      summary: `Created template "${template.title}"`,
    });

    res.status(201).json(template);
  })
);

// POST /api/admin/templates/:id/duplicate
router.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const source = await findTemplateOr404(req.params.id);

    let title = `${source.title} (কপি)`;
    // Ensure the auto-generated title stays unique.
    for (let i = 2; await Template.exists({ title }); i += 1) {
      title = `${source.title} (কপি ${i})`;
    }

    const copy = await Template.create({
      title,
      occasionType: source.occasionType,
      thumbnailUrl: source.thumbnailUrl,
      htmlTemplatePath: source.htmlTemplatePath,
      layoutConfig: source.layoutConfig,
      isActive: false, // a duplicate is draft until an admin activates it
    });

    await recordAudit(req, {
      action: "template.duplicate",
      entity: "template",
      entityId: copy._id.toString(),
      summary: `Duplicated template "${source.title}"`,
      meta: { sourceId: source._id.toString() },
    });

    res.status(201).json(copy);
  })
);

// PATCH /api/admin/templates/:id
router.patch(
  "/:id",
  validateBody(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);
    const patch = req.body as Partial<{
      title: string;
      occasionType: string;
      thumbnailUrl: string;
      htmlTemplatePath: string;
      layoutConfig: Record<string, unknown>;
      isActive: boolean;
    }>;

    if (patch.htmlTemplatePath) {
      assertSafeTemplatePath(patch.htmlTemplatePath);
    }
    if (patch.title && patch.title !== template.title) {
      const duplicate = await Template.findOne({ title: patch.title });
      if (duplicate) {
        throw new ApiError(409, "A template with this title already exists");
      }
    }

    const before = {
      title: template.title,
      occasionType: template.occasionType,
      htmlTemplatePath: template.htmlTemplatePath,
      isActive: template.isActive,
    };

    Object.assign(template, patch);
    await template.save();

    await recordAudit(req, {
      action: "template.update",
      entity: "template",
      entityId: template._id.toString(),
      summary: `Updated template "${template.title}"`,
      meta: { before, after: patch },
    });

    res.json(template);
  })
);

// PATCH /api/admin/templates/:id/toggle — flip isActive
router.patch(
  "/:id/toggle",
  asyncHandler(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);
    template.isActive = !template.isActive;
    await template.save();

    await recordAudit(req, {
      action: "template.toggle",
      entity: "template",
      entityId: template._id.toString(),
      summary: `${template.isActive ? "Activated" : "Deactivated"} template "${template.title}"`,
      meta: { isActive: template.isActive },
    });

    res.json(template);
  })
);

// DELETE /api/admin/templates/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);

    const inUse = await Poster.countDocuments({ templateId: template._id });
    if (inUse > 0) {
      throw new ApiError(
        409,
        `${inUse} poster(s) still use this template. Deactivate it instead of deleting.`
      );
    }

    await template.deleteOne();

    await recordAudit(req, {
      action: "template.delete",
      entity: "template",
      entityId: template._id.toString(),
      summary: `Deleted template "${template.title}"`,
    });

    res.json({ deleted: true });
  })
);

export default router;
