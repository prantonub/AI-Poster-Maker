import { Schema, model, Document, Types } from "mongoose";

// Every mutating action an admin takes is written here, so the panel has a
// real accountability trail ("who changed what, when, and from where").
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  adminEmail: string;
  // Dotted action key, e.g. "user.role.update", "template.delete".
  action: string;
  // Entity type the action targeted: "user" | "poster" | "template" | "settings" | ...
  entity: string;
  entityId?: string;
  // Short human-readable Bengali/English summary rendered in the audit table.
  summary?: string;
  // Structured before/after or extra context (never secrets/passwords).
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true, index: true },
  entityId: { type: String, index: true },
  summary: { type: String },
  meta: { type: Schema.Types.Mixed },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);