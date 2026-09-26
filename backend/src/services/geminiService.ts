import { env } from "../config/env";
import {
  geminiStyleSuggestionSchema,
  GeminiStyleSuggestion,
} from "../schemas/geminiSchemas";
import { OccasionType, LayoutConfig } from "../models/Template";

const HF_ROUTER = "https://router.huggingface.co";
const HF_TIMEOUT_MS = 45_000;

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

// The AI is asked ONLY for a small styling JSON object — never for final
// poster text/pixels. Bangla text is always drawn by the HTML template with
// the user's exact input, so misspellings from a generative model can never
// reach the final poster.
export function buildStylePrompt(params: StylePromptParams): string {
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
export async function callGemini(prompt: string): Promise<GeminiCallResult> {
  if (!env.hfApiKey) {
    throw new Error("HF_API_KEY is not configured");
  }

  const start = Date.now();
  const res = await fetch(`${HF_ROUTER}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.hfApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.hfTextModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(HF_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Hugging Face text request failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
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
