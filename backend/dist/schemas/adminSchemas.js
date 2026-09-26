"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettingsSchema = exports.purgeLogsSchema = exports.bulkTemplateActionSchema = exports.updateTemplateSchema = exports.createTemplateSchema = exports.EMPTY_LAYOUT_CONFIG = exports.bulkDeleteSchema = exports.setPosterStatusSchema = exports.bulkUserActionSchema = exports.setUserPasswordSchema = exports.setUserStatusSchema = exports.setUserRoleSchema = exports.updateUserSchema = void 0;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const objectIdString = zod_1.z
    .string()
    .refine((v) => mongoose_1.default.isValidObjectId(v), { message: "Invalid id" });
const idList = zod_1.z
    .array(objectIdString)
    .min(1, "Select at least one item")
    .max(500, "Too many items selected at once");
// --- users ---
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(120).optional(),
    email: zod_1.z.string().trim().toLowerCase().email("Invalid email").optional(),
    phone: zod_1.z.string().trim().min(6, "Invalid phone number").max(20).optional(),
});
exports.setUserRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(["user", "admin"]),
});
exports.setUserStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
    reason: zod_1.z.string().trim().max(200).optional(),
});
exports.setUserPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(8, "Password must be at least 8 characters").max(128),
});
exports.bulkUserActionSchema = zod_1.z.object({
    action: zod_1.z.enum(["activate", "suspend", "make_admin", "make_user", "delete"]),
    ids: idList,
    reason: zod_1.z.string().trim().max(200).optional(),
});
// --- posters ---
exports.setPosterStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["draft", "generating", "completed", "failed"]),
});
exports.bulkDeleteSchema = zod_1.z.object({
    ids: idList,
});
// --- templates ---
const layoutConfigSchema = zod_1.z.object({
    photoSlots: zod_1.z.array(zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        width: zod_1.z.number(),
        height: zod_1.z.number(),
        shape: zod_1.z.enum(["circle", "rect"]),
    })),
    textSlots: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        fontSize: zod_1.z.number(),
        fontFamily: zod_1.z.string(),
        color: zod_1.z.string(),
        align: zod_1.z.enum(["left", "center", "right"]),
        maxLength: zod_1.z.number(),
    })),
    colorScheme: zod_1.z.object({
        primary: zod_1.z.string(),
        secondary: zod_1.z.string(),
        accent: zod_1.z.string(),
        background: zod_1.z.string(),
    }),
    decorativeElements: zod_1.z.array(zod_1.z.object({
        asset: zod_1.z.enum(["flag", "doves", "floral-border", "rice-paddy-bg"]),
        x: zod_1.z.number().optional(),
        y: zod_1.z.number().optional(),
        width: zod_1.z.number().optional(),
        height: zod_1.z.number().optional(),
        opacity: zod_1.z.number(),
    })),
});
exports.EMPTY_LAYOUT_CONFIG = {
    photoSlots: [],
    textSlots: [],
    colorScheme: { primary: "#006A4E", secondary: "#F42A41", accent: "#F4C430", background: "#F4F9F6" },
    decorativeElements: [],
};
exports.createTemplateSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, "Title is required").max(120),
    occasionType: zod_1.z.enum(["victory_day", "tribute", "campaign", "greeting", "eid_festival"]),
    thumbnailUrl: zod_1.z.string().trim().min(1, "Thumbnail URL is required").max(500),
    htmlTemplatePath: zod_1.z
        .string()
        .trim()
        .regex(/\.html$/i, "Template file must be a .html file")
        .max(200),
    // Optional: the admin UI creates templates from just a name + HTML file, and
    // the server seeds a neutral layout the operator can refine later.
    layoutConfig: layoutConfigSchema.optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateTemplateSchema = exports.createTemplateSchema.partial();
exports.bulkTemplateActionSchema = zod_1.z.object({
    action: zod_1.z.enum(["activate", "deactivate", "delete"]),
    ids: idList,
});
// --- logs / audit ---
exports.purgeLogsSchema = zod_1.z.object({
    olderThanDays: zod_1.z.number().int().min(0).max(3650),
});
// --- settings ---
exports.updateSettingsSchema = zod_1.z.object({
    maintenanceMode: zod_1.z.boolean().optional(),
    registrationOpen: zod_1.z.boolean().optional(),
    generationEnabled: zod_1.z.boolean().optional(),
    siteNotice: zod_1.z.string().max(300).optional(),
    supportEmail: zod_1.z.union([zod_1.z.string().trim().toLowerCase().email("Invalid email"), zod_1.z.literal("")]).optional(),
    dailyPosterLimitPerUser: zod_1.z.number().int().min(0).max(1000).optional(),
});
