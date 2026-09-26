import { Schema, model, Document, Types } from "mongoose";
import { OccasionType } from "./Template";

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

export interface IPoster extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  templateId: Types.ObjectId;
  formData: PosterFormData;
  uploadedPhotoUrls: string[];
  generatedImageUrl?: string;
  status: PosterStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const formDataSchema = new Schema<PosterFormData>(
  {
    name: { type: String, required: true },
    // Not collected by the create form anymore — optional, defaults to "".
    designation: { type: String, default: "" },
    party: { type: String, default: "" },
    district: { type: String, default: "" },
    thana: { type: String, default: "" },
    union: { type: String, default: "" },
    occasion: {
      type: String,
      enum: ["victory_day", "tribute", "campaign", "greeting", "eid_festival"],
      required: true,
    },
    headlineText: { type: String, required: true },
  },
  { _id: false }
);

const posterSchema = new Schema<IPoster>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: "Template", required: true },
    formData: { type: formDataSchema, required: true },
    uploadedPhotoUrls: { type: [String], default: [] },
    generatedImageUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "generating", "completed", "failed"],
      default: "draft",
    },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Poster = model<IPoster>("Poster", posterSchema);
