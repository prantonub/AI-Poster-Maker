import { z } from "zod";
import mongoose from "mongoose";

const objectIdString = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const formDataSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  // No longer collected by the create form (only নাম + হেডলাইন টেক্সট are),
  // so it stays optional and defaults to an empty string.
  designation: z.string().trim().max(120).default(""),
  party: z.string().trim().max(120).default(""),
  district: z.string().trim().max(120).default(""),
  thana: z.string().trim().max(120).default(""),
  union: z.string().trim().max(120).default(""),
  occasion: z.enum(["victory_day", "tribute", "campaign", "greeting", "eid_festival"]),
  headlineText: z.string().trim().min(1, "Headline is required").max(200),
});

// Only URLs that actually came from our own /api/upload -> Cloudinary
// pipeline are accepted — this stops a client from bypassing upload
// validation entirely by POSTing arbitrary external image URLs.
const cloudinaryUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith("https://res.cloudinary.com/"), {
    message: "Photo URLs must come from the app's own upload endpoint",
  });

export const createPosterSchema = z.object({
  templateId: objectIdString,
  formData: formDataSchema,
  uploadedPhotoUrls: z
    .array(cloudinaryUrl)
    .min(1, "At least one photo is required")
    .max(3, "At most 3 photos are allowed"),
});

export type CreatePosterInput = z.infer<typeof createPosterSchema>;

export const quickPreviewSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  party: z.string().trim().max(120).default(""),
  district: z.string().trim().max(120).default(""),
  thana: z.string().trim().max(120).default(""),
  union: z.string().trim().max(120).default(""),
  headlineText: z.string().trim().min(1, "Headline is required").max(200),
});

export type QuickPreviewInput = z.infer<typeof quickPreviewSchema>;

// --- AI prompt-to-image poster generation (/api/generate-poster) ---

// Aspect ratios supported by the Gemini image model for this flow.
export const AI_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type AiAspectRatio = (typeof AI_ASPECT_RATIOS)[number];

export const generatePosterSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Prompt must be at least 3 characters")
    .max(2000, "Prompt must be at most 2000 characters"),
  aspectRatio: z.enum(AI_ASPECT_RATIOS).default("4:5"),
  // Optional: URL of the previously generated poster to edit. Same Cloudinary
  // origin rule as uploads — clients can't point us at arbitrary URLs (SSRF).
  image: cloudinaryUrl.optional(),
});

export type GeneratePosterInput = z.infer<typeof generatePosterSchema>;
