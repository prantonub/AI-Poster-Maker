"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auditService_1 = require("../../services/auditService");
const settingsService_1 = require("../../services/settingsService");
const adminSchemas_1 = require("../../schemas/adminSchemas");
const router = (0, express_1.Router)();
// GET /api/admin/settings — current values plus the defaults they fall back to
router.get("/settings", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const settings = await (0, settingsService_1.getSettings)();
    res.json({ settings, defaults: settingsService_1.DEFAULT_SETTINGS });
}));
// PATCH /api/admin/settings — partial update, takes effect immediately
router.patch("/settings", (0, validate_1.validateBody)(adminSchemas_1.updateSettingsSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const patch = req.body;
    const updated = await (0, settingsService_1.updateSettings)(patch, req.user.sub);
    await (0, auditService_1.recordAudit)(req, {
        action: "settings.update",
        entity: "settings",
        summary: `Updated settings: ${Object.keys(patch).join(", ")}`,
        meta: { patch },
    });
    res.json({ settings: updated, defaults: settingsService_1.DEFAULT_SETTINGS });
}));
exports.default = router;
