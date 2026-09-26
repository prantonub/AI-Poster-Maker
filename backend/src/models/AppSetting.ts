import { Schema, model, Document, Types } from "mongoose";

// Simple key/value store for operator-tunable platform settings. Each key is
// its own document so an update only ever rewrites one value.
export interface IAppSetting extends Document {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const appSettingSchema = new Schema<IAppSetting>({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: Schema.Types.Mixed },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now },
});

export const AppSetting = model<IAppSetting>("AppSetting", appSettingSchema);