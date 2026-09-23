import { Schema, model, Document, Types } from "mongoose";

export interface IGenerationLog extends Document {
  _id: Types.ObjectId;
  posterId: Types.ObjectId;
  userId: Types.ObjectId;
  geminiPromptUsed?: string;
  tokensUsed?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

const generationLogSchema = new Schema<IGenerationLog>({
  posterId: { type: Schema.Types.ObjectId, ref: "Poster", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  geminiPromptUsed: { type: String },
  tokensUsed: { type: Number },
  latencyMs: { type: Number },
  success: { type: Boolean, required: true },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const GenerationLog = model<IGenerationLog>("GenerationLog", generationLogSchema);
