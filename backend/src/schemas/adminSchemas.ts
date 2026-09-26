import { z } from "zod";
import mongoose from "mongoose";

const objectIdString = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const idList = z
  .array(objectIdString)
  .min(1, "Select at least one item")
  .max(500, "Too many items selected at once");

// --- users ---

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  email: z.string().trim().toLowerCase().email("Invalid email").optional(),
  phone: z.string().trim().min(6, "Invalid phone number").max(20).optional(),
});

export const setUserRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export const setUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const setUserPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const bulkUserActionSchema = z.object({
  action: z.enum(["activate", "suspend", "make_admin", "make_user", "delete"]),
  ids: idList,
  reason: z.string().trim().max(200).optional(),
});

// --- posters ---

export const setPosterStatusSchema = z.object({
  status: z.enum(["draft", "generating", "completed", "failed"]),
});

export const bulkDeleteSchema = z.object({
  ids: idList,
});

// --- templates ---

const layoutConfigSchema = z.object({
  photoSlots: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      shape: z.enum(["circle", "rect"]),
    })
  ),
  textSlots: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      fontSize: z.number(),
      fontFamily: z.string(),
      color: z.string(),
      align: z.enum(["left", "center", "right"]),
      maxLength: z.number(),
    })
  ),
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
  }),
  decorativeElements: z.array(
    z.object({
      asset: z.enum(["flag", "doves", "floral-border", "rice-paddy-bg"]),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      opacity: z.number(),
    })
  ),
});

export const EMPTY_LAYOUT_CONFIG = {
  photoSlots: [],
  textSlots: [],
  colorScheme: { primary: "#006A4E", secondary: "#F42A41", accent: "#F4C430", background: "#F4F9F6" },
  decorativeElements: [],
};

export const createTemplateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  occasionType: z.enum(["victory_day", "tribute", "campaign", "greeting", "eid_festival"]),
  thumbnailUrl: z.string().trim().min(1, "Thumbnail URL is required").max(500),
  htmlTemplatePath: z
    .string()
    .trim()
    .regex(/\.html$/i, "Template file must be a .html file")
    .max(200),
  // Optional: the admin UI creates templates from just a name + HTML file, and
  // the server seeds a neutral layout the operator can refine later.
  layoutConfig: layoutConfigSchema.optional(),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const bulkTemplateActionSchema = z.object({
  action: z.enum(["activate", "deactivate", "delete"]),
  ids: idList,
});

// --- logs / audit ---

export const purgeLogsSchema = z.object({
  olderThanDays: z.number().int().min(0).max(3650),
});

// --- settings ---

export const updateSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  registrationOpen: z.boolean().optional(),
  generationEnabled: z.boolean().optional(),
  siteNotice: z.string().max(300).optional(),
  supportEmail: z.union([z.string().trim().toLowerCase().email("Invalid email"), z.literal("")]).optional(),
  dailyPosterLimitPerUser: z.number().int().min(0).max(1000).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>;
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
export type SetPosterStatusInput = z.infer<typeof setPosterStatusSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type BulkTemplateActionInput = z.infer<typeof bulkTemplateActionSchema>;
export type PurgeLogsInput = z.infer<typeof purgeLogsSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;