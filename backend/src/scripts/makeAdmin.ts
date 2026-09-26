/**
 * Promotes an existing user to role: 'admin' by email.
 *
 * Usage: npm run make:admin -- someone@example.com
 *   (from /backend, or via the root workspace script)
 */
import { connectDB } from "../config/db";
import { User } from "../models/User";
import mongoose from "mongoose";

async function main() {
  const email = process.argv[2];
  if (!email) {
    // eslint-disable-next-line no-console
    console.error("Usage: npm run make:admin -- <email>");
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role: "admin" },
    { new: true }
  );

  if (!user) {
    // eslint-disable-next-line no-console
    console.error(`[make:admin] No user found with email: ${email}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`[make:admin] ${user.email} is now an admin (id: ${user._id})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[make:admin] failed:", err);
  process.exit(1);
});
