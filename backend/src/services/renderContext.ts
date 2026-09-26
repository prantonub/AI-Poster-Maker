import { PosterFormData } from "../models/Poster";
import { GeminiStyleSuggestion } from "../schemas/geminiSchemas";
import { sanitizeText } from "./sanitize";

export interface RenderContext {
  headlineText: string;
  headlineFontWeightNumeric: number;
  name: string;
  designation: string;
  party: string;
  district: string;
  thana: string;
  union: string;
  photoUrls: string[];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

function fontWeightToNumeric(weight: GeminiStyleSuggestion["headlineFontWeight"]): number {
  return weight === "extra-bold" ? 900 : 700;
}

export function buildRenderContext(
  formData: PosterFormData,
  photoUrls: string[],
  suggestion: GeminiStyleSuggestion,
  templateBackground: string
): RenderContext {
  return {
    headlineText: sanitizeText(formData.headlineText),
    headlineFontWeightNumeric: fontWeightToNumeric(suggestion.headlineFontWeight),
    name: sanitizeText(formData.name),
    designation: sanitizeText(formData.designation),
    party: sanitizeText(formData.party),
    district: sanitizeText(formData.district),
    thana: sanitizeText(formData.thana),
    union: sanitizeText(formData.union),
    photoUrls,
    primaryColor: suggestion.colorScheme.primary,
    secondaryColor: suggestion.colorScheme.secondary,
    accentColor: suggestion.colorScheme.accent,
    backgroundColor: templateBackground,
  };
}
