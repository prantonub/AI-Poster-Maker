import { Router } from "express";
import mongoose from "mongoose";
import { Template } from "../models/Template";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

const router = Router();

const VALID_OCCASIONS = [
  "victory_day",
  "tribute",
  "campaign",
  "greeting",
  "eid_festival",
];

// GET /api/templates?occasion=victory_day
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { occasion } = req.query;
    const filter: Record<string, unknown> = { isActive: true };

    if (occasion !== undefined) {
      if (typeof occasion !== "string" || !VALID_OCCASIONS.includes(occasion)) {
        throw new ApiError(400, `Invalid occasion. Must be one of: ${VALID_OCCASIONS.join(", ")}`);
      }
      filter.occasionType = occasion;
    }

    const templates = await Template.find(filter).sort({ createdAt: -1 });
    res.json(templates);
  })
);

// GET /api/templates/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, "Invalid template id");
    }

    const template = await Template.findById(id);
    if (!template || !template.isActive) {
      throw new ApiError(404, "Template not found");
    }

    res.json(template);
  })
);

export default router;
