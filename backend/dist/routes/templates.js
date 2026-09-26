"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Template_1 = require("../models/Template");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const VALID_OCCASIONS = [
    "victory_day",
    "tribute",
    "campaign",
    "greeting",
    "eid_festival",
];
// GET /api/templates?occasion=victory_day
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { occasion } = req.query;
    const filter = { isActive: true };
    if (occasion !== undefined) {
        if (typeof occasion !== "string" || !VALID_OCCASIONS.includes(occasion)) {
            throw new errorHandler_1.ApiError(400, `Invalid occasion. Must be one of: ${VALID_OCCASIONS.join(", ")}`);
        }
        filter.occasionType = occasion;
    }
    const templates = await Template_1.Template.find(filter).sort({ createdAt: -1 });
    res.json(templates);
}));
// GET /api/templates/:id
router.get("/:id", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.isValidObjectId(id)) {
        throw new errorHandler_1.ApiError(400, "Invalid template id");
    }
    const template = await Template_1.Template.findById(id);
    if (!template || !template.isActive) {
        throw new errorHandler_1.ApiError(404, "Template not found");
    }
    res.json(template);
}));
exports.default = router;
