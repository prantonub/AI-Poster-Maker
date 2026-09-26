import { ITemplate, DecorativeElement } from "../models/Template";
import { GeminiStyleSuggestion } from "../schemas/geminiSchemas";
import {
  buildStylePrompt,
  callGemini,
  parseGeminiStyleResponse,
  StylePromptParams,
} from "./geminiService";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — Gemini informs template-level styling, not per-poster

export type SuggestionSource = "cache" | "gemini" | "fallback";

export interface ResolvedStyleSuggestion {
  suggestion: GeminiStyleSuggestion;
  source: SuggestionSource;
  // Present only when a live Gemini call was attempted (source is "gemini" or a failed attempt that fell back).
  geminiAttempt?: {
    promptUsed: string;
    tokensUsed?: number;
    latencyMs: number;
    success: boolean;
    errorMessage?: string;
  };
}

function isCacheFresh(template: ITemplate): boolean {
  const cached = template.lastGeminiSuggestion;
  if (!cached) return false;
  const age = Date.now() - new Date(cached.resolvedAt).getTime();
  return age < CACHE_TTL_MS;
}

// Maps a template's own default decorative element to the closest Gemini
// motif enum value, so the fallback suggestion still looks intentional
// rather than generic.
function fallbackMotif(elements: DecorativeElement[]): GeminiStyleSuggestion["decorativeMotif"] {
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

function buildFallbackSuggestion(
  template: ITemplate,
  numPhotos: number
): GeminiStyleSuggestion {
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
export async function resolveStyleSuggestion(
  template: ITemplate,
  params: Omit<StylePromptParams, "templateLayoutConfig">
): Promise<ResolvedStyleSuggestion> {
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

  const prompt = buildStylePrompt({
    ...params,
    templateLayoutConfig: template.layoutConfig,
  });

  try {
    const { rawText, tokensUsed, latencyMs } = await callGemini(prompt);
    const parsed = parseGeminiStyleResponse(rawText);

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
  } catch (err) {
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
export function toCachedSuggestion(suggestion: GeminiStyleSuggestion) {
  return { ...suggestion, resolvedAt: new Date() };
}
