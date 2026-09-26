"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePosterImage = generatePosterImage;
exports.editPosterImage = editPosterImage;
const genai_1 = require("@google/genai");
const env_1 = require("../config/env");
const errorHandler_1 = require("../middleware/errorHandler");
// Official Gemini image model (GA, "Nano Banana") — generates AND edits
// images from natural-language instructions in one model, and supports every
// aspect ratio this app offers (1:1, 4:5, 9:16, 16:9) via imageConfig.
// Override with GEMINI_IMAGE_MODEL if Google deprecates this one.
const IMAGE_MODEL = env_1.env.geminiImageModel;
// Internal professional design instruction: tells Gemini the *kind* of
// artifact to produce (a high-quality Bengali/social-media poster). The
// USER's prompt stays in control of the actual design (occasion, wording,
// colors, mood) — this instruction only sets professional design standards.
const DESIGN_INSTRUCTION = [
    "You are a professional graphic designer who creates high-quality Bengali social-media posters and banners.",
    "",
    "Rules you always follow:",
    "- The user's design brief below is the design direction: occasion, wording, colors, style and mood all come from the brief. Never replace it with your own idea.",
    "- Design a finished, ready-to-post poster — not a photo of a poster, not a device mockup, not a blank template with placeholder boxes.",
    "- Strong visual hierarchy: one clear focal point, balanced composition, generous margins, nothing cramped or overflowing.",
    "- Premium modern styling: cohesive color palette, subtle depth, refined decorative motifs that fit a Bengali/Bangladeshi audience.",
    "- If the brief includes wording, render it legibly. For Bangla wording use correct Bengali (Bangla) script. Keep the requested wording exactly.",
    "- Flat graphic-design illustration style with clean shapes and soft gradients.",
    "- No watermarks, no app UI, no placeholder/lorem-ipsum text.",
].join("\n");
const EDIT_INSTRUCTION = [
    "You are editing an existing high-quality Bengali social-media poster (the image attached below).",
    "Apply ONLY the requested change, and keep everything else as close to the original as possible: composition, wording and script, typography style, colors not mentioned in the change, and decorative elements.",
    "The result must stay a polished, ready-to-post poster design.",
].join("\n");
function buildGeneratePrompt(userPrompt) {
    return `${DESIGN_INSTRUCTION}\n\nUser's design brief:\n${userPrompt}`;
}
function buildEditPrompt(userInstruction) {
    return `${EDIT_INSTRUCTION}\n\nRequested change:\n${userInstruction}`;
}
// Lazily shared client — the API key lives ONLY in backend env vars
// (GEMINI_API_KEY) and is never sent to the frontend.
let client = null;
function getClient() {
    if (!env_1.env.geminiApiKey) {
        throw new errorHandler_1.ApiError(503, "AI image generation is not configured on the server (GEMINI_API_KEY is missing). Please contact the administrator.");
    }
    if (!client) {
        client = new genai_1.GoogleGenAI({ apiKey: env_1.env.geminiApiKey });
    }
    return client;
}
// Translates SDK/network failures into user-friendly ApiErrors so the
// frontend can show a helpful message instead of a raw Google error.
function mapGeminiError(err) {
    // eslint-disable-next-line no-console
    console.error("[posterImageService] Gemini image call failed:", err);
    if (err instanceof genai_1.ApiError) {
        const raw = err.message.toLowerCase();
        // Free-tier projects get limit: 0 on every image model — that's a plan/
        // billing issue, not something a retry fixes, so say so explicitly.
        if (err.status === 429 && (raw.includes("quota") || raw.includes("billing"))) {
            return new errorHandler_1.ApiError(429, "Your Gemini API plan does not include AI image generation yet. Please enable billing for your Gemini API project (aistudio.google.com → Settings → Billing) and try again.");
        }
        if (err.status === 429) {
            return new errorHandler_1.ApiError(429, "The AI service is busy right now (rate limit). Please wait a minute and try again.");
        }
        if (err.status === 401 || err.status === 403) {
            return new errorHandler_1.ApiError(502, "The AI service rejected the server's credentials. Please check GEMINI_API_KEY on the server.");
        }
        if (err.status === 400) {
            return new errorHandler_1.ApiError(400, "The AI service could not process this request. Please review your prompt and try again.");
        }
        if (err.status >= 500) {
            return new errorHandler_1.ApiError(502, "The AI service is temporarily unavailable. Please try again in a few moments.");
        }
        return new errorHandler_1.ApiError(502, `AI image generation failed: ${err.message}`);
    }
    return new errorHandler_1.ApiError(502, "AI image generation failed. Please check your connection and try again.");
}
// Pulls the generated image out of the response candidates. Friendly errors
// for safety blocks / empty responses instead of a generic crash.
function extractImage(response) {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
        const blockReason = response.promptFeedback?.blockReason;
        const finishReason = response.candidates?.[0]?.finishReason;
        if (blockReason || finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
            throw new errorHandler_1.ApiError(422, `Your prompt was blocked by the AI safety filter${blockReason ? ` (${blockReason})` : ""}. Please try a different prompt.`);
        }
        throw new errorHandler_1.ApiError(502, "The AI could not generate an image for this prompt. Please try rephrasing it.");
    }
    return {
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
        base64: imagePart.inlineData.data,
    };
}
// Generates a brand-new poster image from a natural-language prompt.
async function generatePosterImage(userPrompt, aspectRatio) {
    const ai = getClient();
    let response;
    try {
        response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: buildGeneratePrompt(userPrompt),
            config: {
                responseModalities: ["IMAGE"],
                imageConfig: { aspectRatio },
            },
        });
    }
    catch (err) {
        throw mapGeminiError(err);
    }
    return extractImage(response);
}
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
// Downloads the current poster (its Cloudinary URL was validated by the
// request schema) so Gemini can edit it in place.
async function fetchImageAsInlineData(imageUrl) {
    let res;
    try {
        res = await fetch(imageUrl);
    }
    catch {
        throw new errorHandler_1.ApiError(400, "Could not download the current poster image for editing. Please generate again.");
    }
    if (!res.ok) {
        throw new errorHandler_1.ApiError(400, `Could not download the current poster image for editing (HTTP ${res.status}).`);
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
        throw new errorHandler_1.ApiError(400, "The provided image URL does not point to an image.");
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_SOURCE_IMAGE_BYTES) {
        throw new errorHandler_1.ApiError(400, "The image to edit is too large (max 10 MB).");
    }
    return { inlineData: { mimeType: contentType, data: bytes.toString("base64") } };
}
// Applies a natural-language edit ("background dark green করো") to an
// existing generated poster using Gemini's image-editing workflow
// (original image + instruction sent as multimodal contents).
async function editPosterImage(imageUrl, instruction, aspectRatio) {
    const ai = getClient();
    const sourceImage = await fetchImageAsInlineData(imageUrl);
    let response;
    try {
        response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: [{ text: buildEditPrompt(instruction) }, sourceImage],
            config: {
                responseModalities: ["IMAGE"],
                imageConfig: { aspectRatio },
            },
        });
    }
    catch (err) {
        throw mapGeminiError(err);
    }
    return extractImage(response);
}
