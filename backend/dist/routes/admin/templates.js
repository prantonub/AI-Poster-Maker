"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Template_1 = require("../../models/Template");
const Poster_1 = require("../../models/Poster");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auditService_1 = require("../../services/auditService");
const templateFileService_1 = require("../../services/templateFileService");
const adminSchemas_1 = require("../../schemas/adminSchemas");
const helpers_1 = require("./helpers");
const router = (0, express_1.Router)();
const OCCASIONS = ["victory_day", "tribute", "campaign", "greeting", "eid_festival"];
/** Guards a template path so an admin can't point the renderer at ../../etc. */
function assertSafeTemplatePath(fileName) {
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
        throw new errorHandler_1.ApiError(400, "Template file name must not contain path separators");
    }
    if (!(0, templateFileService_1.templateFileExists)(fileName)) {
        throw new errorHandler_1.ApiError(400, `Template HTML file "${fileName}" was not found on the server`);
    }
}
async function findTemplateOr404(id) {
    if (!mongoose_1.default.isValidObjectId(id)) {
        throw new errorHandler_1.ApiError(400, "Invalid template id");
    }
    const template = await Template_1.Template.findById(id);
    if (!template) {
        throw new errorHandler_1.ApiError(404, "Template not found");
    }
    return template;
}
// POST /api/admin/templates/bulk
router.post("/bulk", (0, validate_1.validateBody)(adminSchemas_1.bulkTemplateActionSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { action, ids } = req.body;
    if (action === "delete") {
        // Templates referenced by posters stay put — deactivating is the safe
        // alternative, and we surface the count so the admin understands why.
        const inUse = await Poster_1.Poster.countDocuments({ templateId: { $in: ids } });
        if (inUse > 0) {
            throw new errorHandler_1.ApiError(409, `${inUse} poster(s) still use these templates. Deactivate them instead of deleting.`);
        }
        const result = await Template_1.Template.deleteMany({ _id: { $in: ids } });
        await (0, auditService_1.recordAudit)(req, {
            action: "template.bulk.delete",
            entity: "template",
            summary: `Deleted ${result.deletedCount} template(s)`,
            meta: { deleted: result.deletedCount },
        });
        res.json({ affected: result.deletedCount });
        return;
    }
    const isActive = action === "activate";
    const result = await Template_1.Template.updateMany({ _id: { $in: ids } }, { $set: { isActive } });
    await (0, auditService_1.recordAudit)(req, {
        action: `template.bulk.${action}`,
        entity: "template",
        summary: `${action} applied to ${result.modifiedCount} template(s)`,
        meta: { modified: result.modifiedCount },
    });
    res.json({ affected: result.modifiedCount });
}));
// GET /api/admin/templates — includes inactive ones, with usage counts
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const filter = {};
    const occasion = (0, helpers_1.str)(req.query.occasion);
    if (occasion && OCCASIONS.includes(occasion))
        filter.occasionType = occasion;
    const search = (0, helpers_1.str)(req.query.search);
    if (search) {
        filter.title = new RegExp((0, helpers_1.escapeRegex)(search), "i");
    }
    const isActive = (0, helpers_1.str)(req.query.isActive);
    if (isActive === "true")
        filter.isActive = true;
    if (isActive === "false")
        filter.isActive = false;
    const templates = await Template_1.Template.find(filter).sort({ occasionType: 1, createdAt: -1 }).lean();
    const usage = await Poster_1.Poster.aggregate([
        { $group: { _id: "$templateId", count: { $sum: 1 } } },
    ]);
    const usageByTemplate = new Map(usage.map((u) => [String(u._id), u.count]));
    res.json(templates.map((t) => ({
        ...t,
        _id: String(t._id),
        posterCount: usageByTemplate.get(String(t._id)) ?? 0,
        fileExists: (0, templateFileService_1.templateFileExists)(t.htmlTemplatePath),
    })));
}));
// POST /api/admin/templates
router.post("/", (0, validate_1.validateBody)(adminSchemas_1.createTemplateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    assertSafeTemplatePath(body.htmlTemplatePath);
    const duplicate = await Template_1.Template.findOne({ title: body.title });
    if (duplicate) {
        throw new errorHandler_1.ApiError(409, "A template with this title already exists");
    }
    const template = await Template_1.Template.create({
        ...body,
        layoutConfig: body.layoutConfig ?? adminSchemas_1.EMPTY_LAYOUT_CONFIG,
    });
    await (0, auditService_1.recordAudit)(req, {
        action: "template.create",
        entity: "template",
        entityId: template._id.toString(),
        summary: `Created template "${template.title}"`,
    });
    res.status(201).json(template);
}));
// POST /api/admin/templates/:id/duplicate
router.post("/:id/duplicate", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const source = await findTemplateOr404(req.params.id);
    let title = `${source.title} (কপি)`;
    // Ensure the auto-generated title stays unique.
    for (let i = 2; await Template_1.Template.exists({ title }); i += 1) {
        title = `${source.title} (কপি ${i})`;
    }
    const copy = await Template_1.Template.create({
        title,
        occasionType: source.occasionType,
        thumbnailUrl: source.thumbnailUrl,
        htmlTemplatePath: source.htmlTemplatePath,
        layoutConfig: source.layoutConfig,
        isActive: false, // a duplicate is draft until an admin activates it
    });
    await (0, auditService_1.recordAudit)(req, {
        action: "template.duplicate",
        entity: "template",
        entityId: copy._id.toString(),
        summary: `Duplicated template "${source.title}"`,
        meta: { sourceId: source._id.toString() },
    });
    res.status(201).json(copy);
}));
// PATCH /api/admin/templates/:id
router.patch("/:id", (0, validate_1.validateBody)(adminSchemas_1.updateTemplateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);
    const patch = req.body;
    if (patch.htmlTemplatePath) {
        assertSafeTemplatePath(patch.htmlTemplatePath);
    }
    if (patch.title && patch.title !== template.title) {
        const duplicate = await Template_1.Template.findOne({ title: patch.title });
        if (duplicate) {
            throw new errorHandler_1.ApiError(409, "A template with this title already exists");
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
    await (0, auditService_1.recordAudit)(req, {
        action: "template.update",
        entity: "template",
        entityId: template._id.toString(),
        summary: `Updated template "${template.title}"`,
        meta: { before, after: patch },
    });
    res.json(template);
}));
// PATCH /api/admin/templates/:id/toggle — flip isActive
router.patch("/:id/toggle", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);
    template.isActive = !template.isActive;
    await template.save();
    await (0, auditService_1.recordAudit)(req, {
        action: "template.toggle",
        entity: "template",
        entityId: template._id.toString(),
        summary: `${template.isActive ? "Activated" : "Deactivated"} template "${template.title}"`,
        meta: { isActive: template.isActive },
    });
    res.json(template);
}));
// DELETE /api/admin/templates/:id
router.delete("/:id", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const template = await findTemplateOr404(req.params.id);
    const inUse = await Poster_1.Poster.countDocuments({ templateId: template._id });
    if (inUse > 0) {
        throw new errorHandler_1.ApiError(409, `${inUse} poster(s) still use this template. Deactivate it instead of deleting.`);
    }
    await template.deleteOne();
    await (0, auditService_1.recordAudit)(req, {
        action: "template.delete",
        entity: "template",
        entityId: template._id.toString(),
        summary: `Deleted template "${template.title}"`,
    });
    res.json({ deleted: true });
}));
exports.default = router;
