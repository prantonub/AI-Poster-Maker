import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { recordAudit } from "../../services/auditService";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "../../services/settingsService";
import { updateSettingsSchema } from "../../schemas/adminSchemas";

const router = Router();

// GET /api/admin/settings — current values plus the defaults they fall back to
router.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings, defaults: DEFAULT_SETTINGS });
  })
);

// PATCH /api/admin/settings — partial update, takes effect immediately
router.patch(
  "/settings",
  validateBody(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const patch = req.body as Record<string, unknown>;

    const updated = await updateSettings(patch, req.user!.sub);

    await recordAudit(req, {
      action: "settings.update",
      entity: "settings",
      summary: `Updated settings: ${Object.keys(patch).join(", ")}`,
      meta: { patch },
    });

    res.json({ settings: updated, defaults: DEFAULT_SETTINGS });
  })
);

export default router;
