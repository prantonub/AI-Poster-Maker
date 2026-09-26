"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRenderContext = buildRenderContext;
const sanitize_1 = require("./sanitize");
function fontWeightToNumeric(weight) {
    return weight === "extra-bold" ? 900 : 700;
}
function buildRenderContext(formData, photoUrls, suggestion, templateBackground) {
    return {
        headlineText: (0, sanitize_1.sanitizeText)(formData.headlineText),
        headlineFontWeightNumeric: fontWeightToNumeric(suggestion.headlineFontWeight),
        name: (0, sanitize_1.sanitizeText)(formData.name),
        designation: (0, sanitize_1.sanitizeText)(formData.designation),
        party: (0, sanitize_1.sanitizeText)(formData.party),
        district: (0, sanitize_1.sanitizeText)(formData.district),
        thana: (0, sanitize_1.sanitizeText)(formData.thana),
        union: (0, sanitize_1.sanitizeText)(formData.union),
        photoUrls,
        primaryColor: suggestion.colorScheme.primary,
        secondaryColor: suggestion.colorScheme.secondary,
        accentColor: suggestion.colorScheme.accent,
        backgroundColor: templateBackground,
    };
}
