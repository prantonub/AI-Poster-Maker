"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickPreviewSchema = exports.createPosterSchema = void 0;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const objectIdString = zod_1.z
    .string()
    .refine((v) => mongoose_1.default.isValidObjectId(v), { message: "Invalid id" });
const formDataSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(120),
    designation: zod_1.z.string().trim().min(1, "Designation is required").max(120),
    party: zod_1.z.string().trim().max(120).default(""),
    district: zod_1.z.string().trim().max(120).default(""),
    thana: zod_1.z.string().trim().max(120).default(""),
    union: zod_1.z.string().trim().max(120).default(""),
    occasion: zod_1.z.enum(["victory_day", "tribute", "campaign", "greeting", "eid_festival"]),
    headlineText: zod_1.z.string().trim().min(1, "Headline is required").max(200),
});
// Only URLs that actually came from our own /api/upload -> Cloudinary
// pipeline are accepted — this stops a client from bypassing upload
// validation entirely by POSTing arbitrary external image URLs.
const cloudinaryUrl = zod_1.z
    .string()
    .url()
    .refine((v) => v.startsWith("https://res.cloudinary.com/"), {
    message: "Photo URLs must come from the app's own upload endpoint",
});
exports.createPosterSchema = zod_1.z.object({
    templateId: objectIdString,
    formData: formDataSchema,
    uploadedPhotoUrls: zod_1.z
        .array(cloudinaryUrl)
        .min(1, "At least one photo is required")
        .max(3, "At most 3 photos are allowed"),
});
exports.quickPreviewSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(120),
    designation: zod_1.z.string().trim().min(1, "Designation is required").max(120),
    party: zod_1.z.string().trim().max(120).default(""),
    district: zod_1.z.string().trim().max(120).default(""),
    thana: zod_1.z.string().trim().max(120).default(""),
    union: zod_1.z.string().trim().max(120).default(""),
    headlineText: zod_1.z.string().trim().min(1, "Headline is required").max(200),
});
