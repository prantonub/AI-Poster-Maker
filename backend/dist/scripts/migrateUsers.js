"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * One-time data migration for the User model fields added with the admin panel.
 *
 * Accounts created before `isActive` / `lastLoginAt` / `loginCount` existed have
 * those fields missing (undefined). The code treats undefined as "active", but
 * backfilling makes the data explicit and keeps future queries simple.
 *
 * Safe to re-run: it only sets fields that are currently missing.
 *
 * Usage: npm run migrate:users
 */
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const User_1 = require("../models/User");
async function main() {
    await (0, db_1.connectDB)();
    const missingIsActive = await User_1.User.countDocuments({ isActive: { $exists: false } });
    const missingRole = await User_1.User.countDocuments({ role: { $exists: false } });
    const missingLoginCount = await User_1.User.countDocuments({ loginCount: { $exists: false } });
    // eslint-disable-next-line no-console
    console.log(`[migrate] users missing isActive:      ${missingIsActive}`);
    // eslint-disable-next-line no-console
    console.log(`[migrate] users missing role:          ${missingRole}`);
    // eslint-disable-next-line no-console
    console.log(`[migrate] users missing loginCount:    ${missingLoginCount}`);
    const result = await User_1.User.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
    const roles = await User_1.User.updateMany({ role: { $exists: false } }, { $set: { role: "user" } });
    const logins = await User_1.User.updateMany({ loginCount: { $exists: false } }, { $set: { loginCount: 0 } });
    const lastLogins = await User_1.User.updateMany({ lastLoginAt: { $exists: false } }, { $set: { lastLoginAt: null } });
    // eslint-disable-next-line no-console
    console.log(`[migrate] set isActive on   ${result.modifiedCount} user(s)`);
    // eslint-disable-next-line no-console
    console.log(`[migrate] set role on       ${roles.modifiedCount} user(s)`);
    // eslint-disable-next-line no-console
    console.log(`[migrate] set loginCount on ${logins.modifiedCount} user(s)`);
    // eslint-disable-next-line no-console
    console.log(`[migrate] set lastLoginAt on ${lastLogins.modifiedCount} user(s)`);
    const admins = await User_1.User.find({ role: "admin" }).select("email isActive").lean();
    // eslint-disable-next-line no-console
    console.log(`\n[migrate] ${admins.length} admin account(s):`);
    for (const admin of admins) {
        // eslint-disable-next-line no-console
        console.log(`  - ${admin.email} (isActive: ${admin.isActive})`);
    }
    await mongoose_1.default.disconnect();
    // eslint-disable-next-line no-console
    console.log("[migrate] done");
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[migrate] failed:", err);
    process.exit(1);
});
