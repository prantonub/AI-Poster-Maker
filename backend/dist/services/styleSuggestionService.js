"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStyleSuggestion = resolveStyleSuggestion;
exports.toCachedSuggestion = toCachedSuggestion;
const geminiService_1 = require("./geminiService");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — Gemini informs template-level styling, not per-poster
function isCacheFresh(template) {
    const cached = template.lastGeminiSuggestion;
    if (!cached)
        return false;
    const age = Date.now() - new Date(cached.resolvedAt).getTime();
    return age < CACHE_TTL_MS;
}
// Maps a template's own default decorative element to the closest Gemini
// motif enum value, so the fallback suggestion still looks intentional
// rather than generic.
function fallbackMotif(elements) {
    const asset = elements[0]?.asset;
    switch (asset) {
        case "rice-paddy-bg":
            return "rice-paddy";
        case "flag":
            return "national-flag";
        case "doves":
            return "doves";
        case "floral-border":
        default:
            return "floral-border";
    }
}
function buildFallbackSuggestion(template, numPhotos) {
    const { colorScheme, decorativeElements } = template.layoutConfig;
    return {
        colorScheme: {
            primary: colorScheme.primary,
            secondary: colorScheme.secondary,
            accent: colorScheme.accent,
        },
        photoArrangement: numPhotos >= 3 ? "grid-3" : numPhotos === 2 ? "row-2" : "single-center",
        decorativeMotif: fallbackMotif(decorativeElements),
        headlineFontWeight: "bold",
    };
}
// Main entry point. Never throws: any failure (missing API key, network
// error, malformed JSON, schema mismatch) resolves to the template's own
// default styling instead. The caller (posterRenderer, Phase 7) is
// responsible for persisting a GenerationLog row from geminiAttempt, since
// that requires a posterId this service doesn't have.
async function resolveStyleSuggestion(template, params) {
    if (isCacheFresh(template) && template.lastGeminiSuggestion) {
        const cached = template.lastGeminiSuggestion;
        return {
            source: "cache",
            suggestion: {
                colorScheme: cached.colorScheme,
                photoArrangement: cached.photoArrangement,
                decorativeMotif: cached.decorativeMotif,
                headlineFontWeight: cached.headlineFontWeight,
            },
        };
    }
    const prompt = (0, geminiService_1.buildStylePrompt)({
        ...params,
        templateLayoutConfig: template.layoutConfig,
    });
    try {
        const { rawText, tokensUsed, latencyMs } = await (0, geminiService_1.callGemini)(prompt);
        const parsed = (0, geminiService_1.parseGeminiStyleResponse)(rawText);
        if (!parsed) {
            return {
                source: "fallback",
                suggestion: buildFallbackSuggestion(template, params.numPhotos),
                geminiAttempt: {
                    promptUsed: prompt,
                    tokensUsed,
                    latencyMs,
                    success: false,
                    errorMessage: "Gemini response failed JSON parse/schema validation",
                },
            };
        }
        return {
            source: "gemini",
            suggestion: parsed,
            geminiAttempt: { promptUsed: prompt, tokensUsed, latencyMs, success: true },
        };
    }
    catch (err) {
        return {
            source: "fallback",
            suggestion: buildFallbackSuggestion(template, params.numPhotos),
            geminiAttempt: {
                promptUsed: prompt,
                latencyMs: 0,
                success: false,
                errorMessage: err instanceof Error ? err.message : "Unknown Gemini error",
            },
        };
    }
}
// Persists a resolved (non-cache) suggestion onto the template for the TTL window.
function toCachedSuggestion(suggestion) {
    return { ...suggestion, resolvedAt: new Date() };
}
