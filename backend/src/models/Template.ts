import { Schema, model, Document, Types } from "mongoose";

export type OccasionType =
  | "victory_day"
  | "tribute"
  | "campaign"
  | "greeting"
  | "eid_festival";

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "circle" | "rect";
}

export interface TextSlot {
  id: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
  maxLength: number;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface DecorativeElement {
  asset: "flag" | "doves" | "floral-border" | "rice-paddy-bg";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity: number;
}

export interface LayoutConfig {
  photoSlots: PhotoSlot[];
  textSlots: TextSlot[];
  colorScheme: ColorScheme;
  decorativeElements: DecorativeElement[];
}

export interface CachedGeminiSuggestion {
  colorScheme: { primary: string; secondary: string; accent: string };
  photoArrangement: "grid-3" | "row-2" | "single-center";
  decorativeMotif: "floral-border" | "rice-paddy" | "national-flag" | "doves";
  headlineFontWeight: "bold" | "extra-bold";
  resolvedAt: Date;
}

export interface ITemplate extends Document {
  _id: Types.ObjectId;
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  htmlTemplatePath: string; // path to the .html file under src/templates
  layoutConfig: LayoutConfig;
  isActive: boolean;
  lastGeminiSuggestion?: CachedGeminiSuggestion;
  createdAt: Date;
}

const photoSlotSchema = new Schema<PhotoSlot>(
  {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    shape: { type: String, enum: ["circle", "rect"] },
  },
  { _id: false }
);

const textSlotSchema = new Schema<TextSlot>(
  {
    id: String,
    x: Number,
    y: Number,
    fontSize: Number,
    fontFamily: String,
    color: String,
    align: { type: String, enum: ["left", "center", "right"] },
    maxLength: Number,
  },
  { _id: false }
);

const colorSchemeSchema = new Schema<ColorScheme>(
  {
    primary: String,
    secondary: String,
    accent: String,
    background: String,
  },
  { _id: false }
);

const decorativeElementSchema = new Schema<DecorativeElement>(
  {
    asset: {
      type: String,
      enum: ["flag", "doves", "floral-border", "rice-paddy-bg"],
    },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    opacity: Number,
  },
  { _id: false }
);

const cachedGeminiSuggestionSchema = new Schema<CachedGeminiSuggestion>(
  {
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
  },
  { _id: false }
);

const templateSchema = new Schema<ITemplate>({
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

export const Template = model<ITemplate>("Template", templateSchema);
