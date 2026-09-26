import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import {
  geminiStyleSuggestionSchema,
  GeminiStyleSuggestion,
} from "../schemas/geminiSchemas";
import { OccasionType, LayoutConfig } from "../models/Template";

export interface StylePromptParams {
  occasionType: OccasionType;
  headlineText: string;
  numPhotos: number;
  templateLayoutConfig: LayoutConfig;
}

export interface GeminiCallResult {
  rawText: string;
  tokensUsed?: number;
  latencyMs: number;
}

// Gemini is asked ONLY for a small styling JSON object — never for final
// poster text/pixels. Bangla text is always drawn by the HTML template with
// the user's exact input, so misspellings from a generative model can never
// reach the final poster.
export function buildStylePrompt(params: StylePromptParams): string {
  const { occasionType, headlineText, numPhotos, templateLayoutConfig } = params;

  return [
    "You are a design assistant for Bangladeshi political posters.",
    "You suggest ONLY styling — never generate or alter any poster text.",
    "",
    `Occasion: ${occasionType}`,
    `Headline (for tone/context only, do not repeat it back): ${headlineText}`,
    `Number of uploaded photos: ${numPhotos}`,
    `Template's default color scheme: ${JSON.stringify(templateLayoutConfig.colorScheme)}`,
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

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return client;
}

export async function callGemini(prompt: string): Promise<GeminiCallResult> {
  const start = Date.now();
  const model = getClient().getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const latencyMs = Date.now() - start;

  const rawText = result.response.text();
  const tokensUsed = result.response.usageMetadata?.totalTokenCount;

  return { rawText, tokensUsed, latencyMs };
}

// Defensive parse: Gemini sometimes wraps JSON in ```json fences or adds
// stray whitespace/preamble despite instructions. Strip fences, try/catch
// the parse, then validate the shape with zod. Never throws — callers
// decide what to do with a null result (fall back to template defaults).
export function parseGeminiStyleResponse(
  rawText: string
): GeminiStyleSuggestion | null {
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const validated = geminiStyleSuggestionSchema.safeParse(parsed);
  if (!validated.success) {
    return null;
  }

  return validated.data;
}
