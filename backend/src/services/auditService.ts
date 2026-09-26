import { Request } from "express";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes one audit entry for the admin whose JWT is on the request.
 *
 * Deliberately swallows its own errors: losing an audit line must never fail
 * the actual admin operation the user asked for. Failures are logged instead.
 */
export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      adminId: req.user?.sub,
      adminEmail: req.user?.sub ? await resolveEmail(req.user.sub) : "unknown",
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      meta: input.meta,
      ip: req.ip,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record admin action:", err);
  }
}

/**
 * AuditLog.adminEmail is denormalised for readable listings, but the JWT only
 * carries the user id + role — so resolve the address on write (cheap: one
 * indexed lookup, and only on admin mutations).
 */
async function resolveEmail(userId: string): Promise<string> {
  const user = await User.findById(userId).select("email").lean();
  return user?.email ?? userId;
}

/** Variant for non-request contexts (scripts, background jobs). */
export async function recordSystemAudit(
  adminEmail: string,
  adminId: string,
  input: AuditInput
): Promise<void> {
  try {
    await AuditLog.create({
      adminId,
      adminEmail,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      meta: input.meta,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record system action:", err);
  }
}