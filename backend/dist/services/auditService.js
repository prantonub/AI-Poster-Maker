"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
exports.recordSystemAudit = recordSystemAudit;
const AuditLog_1 = require("../models/AuditLog");
const User_1 = require("../models/User");
/**
 * Writes one audit entry for the admin whose JWT is on the request.
 *
 * Deliberately swallows its own errors: losing an audit line must never fail
 * the actual admin operation the user asked for. Failures are logged instead.
 */
async function recordAudit(req, input) {
    try {
        await AuditLog_1.AuditLog.create({
            adminId: req.user?.sub,
            adminEmail: req.user?.sub ? await resolveEmail(req.user.sub) : "unknown",
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            summary: input.summary,
            meta: input.meta,
            ip: req.ip,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[audit] failed to record admin action:", err);
    }
}
/**
 * AuditLog.adminEmail is denormalised for readable listings, but the JWT only
 * carries the user id + role — so resolve the address on write (cheap: one
 * indexed lookup, and only on admin mutations).
 */
async function resolveEmail(userId) {
    const user = await User_1.User.findById(userId).select("email").lean();
    return user?.email ?? userId;
}
/** Variant for non-request contexts (scripts, background jobs). */
async function recordSystemAudit(adminEmail, adminId, input) {
    try {
        await AuditLog_1.AuditLog.create({
            adminId,
            adminEmail,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            summary: input.summary,
            meta: input.meta,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[audit] failed to record system action:", err);
    }
}
