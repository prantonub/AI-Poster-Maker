// Shared types between /frontend and /backend.
// Keep this file framework-agnostic (no Mongoose/Next imports here).

export type OccasionType =
  | "victory_day"
  | "tribute"
  | "campaign"
  | "greeting"
  | "eid_festival";

export type PosterStatus = "draft" | "generating" | "completed" | "failed";

export type UserRole = "user" | "admin";

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

export type DecorativeAssetKey =
  | "flag"
  | "doves"
  | "floral-border"
  | "rice-paddy-bg";

export interface DecorativeElement {
  asset: DecorativeAssetKey;
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

export interface TemplateDTO {
  _id: string;
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  layoutConfig: LayoutConfig;
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

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

// Gemini's role is strictly limited to STYLING suggestions.
// It must never be asked to render final text/pixels for the poster.
export interface GeminiStyleSuggestion {
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  photoArrangement: "grid-3" | "row-2" | "single-center";
  decorativeMotif: "floral-border" | "rice-paddy" | "national-flag" | "doves";
  headlineFontWeight: "bold" | "extra-bold";
}

// ---- API request/response payloads ----

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export interface CreatePosterRequest {
  templateId: string;
  formData: PosterFormData;
  uploadedPhotoUrls: string[];
}

export interface UploadResponse {
  urls: string[];
}

export interface ApiError {
  message: string;
  details?: unknown;
}
