export type OccasionType =
  | "victory_day"
  | "tribute"
  | "campaign"
  | "greeting"
  | "eid_festival";

export const OCCASION_LABELS: Record<OccasionType, string> = {
  victory_day: "বিজয় দিবস",
  tribute: "শোক/স্মরণ",
  campaign: "নির্বাচনী প্রচার",
  greeting: "উৎসব শুভেচ্ছা",
  eid_festival: "ঈদ/উৎসব",
};

export interface TemplateDTO {
  _id: string;
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  layoutConfig: {
    photoSlots: { x: number; y: number; width: number; height: number; shape: string }[];
    textSlots: unknown[];
    colorScheme: { primary: string; secondary: string; accent: string; background: string };
    decorativeElements: unknown[];
  };
  isActive: boolean;
  createdAt: string;
}

export interface PosterFormData {
  name: string;
  designation: string;
  party: string;
  district: string;
  thana: string;
  union: string;
  occasion: OccasionType;
  headlineText: string;
}

export type PosterStatus = "draft" | "generating" | "completed" | "failed";

export interface PosterDTO {
  _id: string;
  userId: string;
  templateId: string;
  formData: PosterFormData;
  uploadedPhotoUrls: string[];
  generatedImageUrl?: string;
  status: PosterStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPosters {
  items: PosterDTO[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- AI prompt-to-image poster generation (/api/generate-poster) ---

export const AI_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type AiAspectRatio = (typeof AI_ASPECT_RATIOS)[number];

export const AI_ASPECT_RATIO_LABELS: Record<AiAspectRatio, { label: string; hint: string }> = {
  "1:1": { label: "1:1", hint: "স্কয়ার পোস্ট" },
  "4:5": { label: "4:5", hint: "পোর্ট্রেট পোস্ট" },
  "9:16": { label: "9:16", hint: "স্টোরি / রিলস" },
  "16:9": { label: "16:9", hint: "ওয়াইড / থাম্বনেইল" },
};

export interface GenerateAiPosterResponse {
  imageUrl: string;
  prompt: string;
  aspectRatio: AiAspectRatio;
}
