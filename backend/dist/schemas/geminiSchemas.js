"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiStyleSuggestionSchema = void 0;
const zod_1 = require("zod");
const hexColor = zod_1.z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");
exports.geminiStyleSuggestionSchema = zod_1.z.object({
    colorScheme: zod_1.z.object({
        primary: hexColor,
        secondary: hexColor,
        accent: hexColor,
    }),
    photoArrangement: zod_1.z.enum(["grid-3", "row-2", "single-center"]),
    decorativeMotif: zod_1.z.enum(["floral-border", "rice-paddy", "national-flag", "doves"]),
    headlineFontWeight: zod_1.z.enum(["bold", "extra-bold"]),
});
