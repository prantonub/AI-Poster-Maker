"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStylePrompt = buildStylePrompt;
exports.callGemini = callGemini;
exports.parseGeminiStyleResponse = parseGeminiStyleResponse;
const env_1 = require("../config/env");
const geminiSchemas_1 = require("../schemas/geminiSchemas");
const HF_ROUTER = "https://router.huggingface.co";
const HF_TIMEOUT_MS = 45000;
// The AI is asked ONLY for a small styling JSON object — never for final
// poster text/pixels. Bangla text is always drawn by the HTML template with
// the user's exact input, so misspellings from a generative model can never
// reach the final poster.
function buildStylePrompt(params) {
    return [
        "You are a design assistant for Bangladeshi political posters.",
        "You suggest ONLY styling — never generate or alter any poster text.",
        "",
        `Occasion: ${params.occasionType}`,
        `Headline (for tone/context only, do not repeat it back): ${params.headlineText}`,
        `Number of uploaded photos: ${params.numPhotos}`,
        `Template's default color scheme: ${JSON.stringify(params.templateLayoutConfig.colorScheme)}`,
        "",
        "Return STRICT JSON ONLY. No markdown code fences. No preamble. No explanation.",
        "The JSON must match exactly this shape:",
        "{",
        '  "colorScheme": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" },',
        '  "photoArrangement": "grid-3" | "row-2" | "single-center",',
        '  "decorativeMotif": "floral-border" | "rice-paddy" | "national-flag" | "doves",',
        '  "headlineFontWeight": "bold" | "extra-bold"',
        "}",
    ].join("\n");
}
// Text call via the Hugging Face Inference router (OpenAI-compatible
// /v1/chat/completions). Throws on failure so callers can fall back to the
// template's own default styling.
async function callGemini(prompt) {
    if (!env_1.env.hfApiKey) {
        throw new Error("HF_API_KEY is not configured");
    }
    const start = Date.now();
    const res = await fetch(`${HF_ROUTER}/v1/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_1.env.hfApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: env_1.env.hfTextModel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
        }),
        signal: AbortSignal.timeout(HF_TIMEOUT_MS),
    });
    if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        throw new Error(`Hugging Face text request failed (${res.status}): ${detail}`);
    }
    const json = (await res.json());
    const rawText = json.choices?.[0]?.message?.content;
    if (typeof rawText !== "string") {
        throw new Error("Hugging Face returned no text content");
    }
    return { rawText, tokensUsed: json.usage?.total_tokens, latencyMs: Date.now() - start };
}
// Defensive parse: Gemini sometimes wraps JSON in ```json fences or adds
// stray whitespace/preamble despite instructions. Strip fences, try/catch
// the parse, then validate the shape with zod. Never throws — callers
// decide what to do with a null result (fall back to template defaults).
function parseGeminiStyleResponse(rawText) {
    let cleaned = rawText.trim();
    // Strip ```json ... ``` or ``` ... ``` fences if present.
    const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }
    // If there's still leading/trailing prose, try to isolate the first {...} block.
    if (!cleaned.startsWith("{")) {
        const braceMatch = cleaned.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            cleaned = braceMatch[0];
        }
    }
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        return null;
    }
    const validated = geminiSchemas_1.geminiStyleSuggestionSchema.safeParse(parsed);
    if (!validated.success) {
        return null;
    }
    return validated.data;
}
