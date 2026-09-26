import { z } from "zod";

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

export const geminiStyleSuggestionSchema = z.object({
  colorScheme: z.object({
    primary: hexColor,
    secondary: hexColor,
    accent: hexColor,
  }),
  photoArrangement: z.enum(["grid-3", "row-2", "single-center"]),
  decorativeMotif: z.enum(["floral-border", "rice-paddy", "national-flag", "doves"]),
  headlineFontWeight: z.enum(["bold", "extra-bold"]),
});

export type GeminiStyleSuggestion = z.infer<typeof geminiStyleSuggestionSchema>;
