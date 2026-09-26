"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
const mongoose_1 = require("mongoose");
const photoSlotSchema = new mongoose_1.Schema({
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    shape: { type: String, enum: ["circle", "rect"] },
}, { _id: false });
const textSlotSchema = new mongoose_1.Schema({
    id: String,
    x: Number,
    y: Number,
    fontSize: Number,
    fontFamily: String,
    color: String,
    align: { type: String, enum: ["left", "center", "right"] },
    maxLength: Number,
}, { _id: false });
const colorSchemeSchema = new mongoose_1.Schema({
    primary: String,
    secondary: String,
    accent: String,
    background: String,
}, { _id: false });
const decorativeElementSchema = new mongoose_1.Schema({
    asset: {
        type: String,
        enum: ["flag", "doves", "floral-border", "rice-paddy-bg"],
    },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    opacity: Number,
}, { _id: false });
const cachedGeminiSuggestionSchema = new mongoose_1.Schema({
    colorScheme: {
        primary: String,
        secondary: String,
        accent: String,
    },
    photoArrangement: {
        type: String,
        enum: ["grid-3", "row-2", "single-center"],
    },
    decorativeMotif: {
        type: String,
        enum: ["floral-border", "rice-paddy", "national-flag", "doves"],
    },
    headlineFontWeight: { type: String, enum: ["bold", "extra-bold"] },
    resolvedAt: Date,
}, { _id: false });
const templateSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    occasionType: {
        type: String,
        enum: ["victory_day", "tribute", "campaign", "greeting", "eid_festival"],
        required: true,
    },
    thumbnailUrl: { type: String, required: true },
    htmlTemplatePath: { type: String, required: true },
    layoutConfig: {
        photoSlots: [photoSlotSchema],
        textSlots: [textSlotSchema],
        colorScheme: colorSchemeSchema,
        decorativeElements: [decorativeElementSchema],
    },
    isActive: { type: Boolean, default: true },
    lastGeminiSuggestion: cachedGeminiSuggestionSchema,
    createdAt: { type: Date, default: Date.now },
});
exports.Template = (0, mongoose_1.model)("Template", templateSchema);
