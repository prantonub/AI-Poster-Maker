"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = require("mongoose");
const auditLogSchema = new mongoose_1.Schema({
    adminId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    summary: { type: String },
    meta: { type: mongoose_1.Schema.Types.Mixed },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
});
auditLogSchema.index({ createdAt: -1 });
exports.AuditLog = (0, mongoose_1.model)("AuditLog", auditLogSchema);
