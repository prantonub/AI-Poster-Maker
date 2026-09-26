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
