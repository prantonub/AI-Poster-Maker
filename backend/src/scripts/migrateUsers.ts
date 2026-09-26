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
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/User";

async function main() {
  await connectDB();

  const missingIsActive = await User.countDocuments({ isActive: { $exists: false } });
  const missingRole = await User.countDocuments({ role: { $exists: false } });
  const missingLoginCount = await User.countDocuments({ loginCount: { $exists: false } });

  // eslint-disable-next-line no-console
  console.log(`[migrate] users missing isActive:      ${missingIsActive}`);
  // eslint-disable-next-line no-console
  console.log(`[migrate] users missing role:          ${missingRole}`);
  // eslint-disable-next-line no-console
  console.log(`[migrate] users missing loginCount:    ${missingLoginCount}`);

  const result = await User.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } }
  );
  const roles = await User.updateMany({ role: { $exists: false } }, { $set: { role: "user" } });
  const logins = await User.updateMany(
    { loginCount: { $exists: false } },
    { $set: { loginCount: 0 } }
  );
  const lastLogins = await User.updateMany(
    { lastLoginAt: { $exists: false } },
    { $set: { lastLoginAt: null } }
  );

  // eslint-disable-next-line no-console
  console.log(`[migrate] set isActive on   ${result.modifiedCount} user(s)`);
  // eslint-disable-next-line no-console
  console.log(`[migrate] set role on       ${roles.modifiedCount} user(s)`);
  // eslint-disable-next-line no-console
  console.log(`[migrate] set loginCount on ${logins.modifiedCount} user(s)`);
  // eslint-disable-next-line no-console
  console.log(`[migrate] set lastLoginAt on ${lastLogins.modifiedCount} user(s)`);

  const admins = await User.find({ role: "admin" }).select("email isActive").lean();
  // eslint-disable-next-line no-console
  console.log(`\n[migrate] ${admins.length} admin account(s):`);
  for (const admin of admins) {
    // eslint-disable-next-line no-console
    console.log(`  - ${admin.email} (isActive: ${admin.isActive})`);
  }

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log("[migrate] done");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[migrate] failed:", err);
  process.exit(1);
});
