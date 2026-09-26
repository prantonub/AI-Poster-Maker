import { z } from "zod";
import mongoose from "mongoose";

const objectIdString = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const formDataSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  designation: z.string().trim().min(1, "Designation is required").max(120),
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
