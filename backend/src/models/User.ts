import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "user" | "admin";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  // Admin-manageable account state. A suspended account keeps all of its data
  // and can be reactivated at any time, but cannot sign in until then.
  isActive: boolean;
  lastLoginAt?: Date | null;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
