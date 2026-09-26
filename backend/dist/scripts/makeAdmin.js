"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Promotes an existing user to role: 'admin' by email.
 *
 * Usage: npm run make:admin -- someone@example.com
 *   (from /backend, or via the root workspace script)
 */
const db_1 = require("../config/db");
const User_1 = require("../models/User");
const mongoose_1 = __importDefault(require("mongoose"));
async function main() {
    const email = process.argv[2];
    if (!email) {
        // eslint-disable-next-line no-console
        console.error("Usage: npm run make:admin -- <email>");
        process.exit(1);
    }
    await (0, db_1.connectDB)();
    const user = await User_1.User.findOneAndUpdate({ email: email.toLowerCase().trim() }, { role: "admin" }, { new: true });
    if (!user) {
        // eslint-disable-next-line no-console
        console.error(`[make:admin] No user found with email: ${email}`);
        process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`[make:admin] ${user.email} is now an admin (id: ${user._id})`);
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[make:admin] failed:", err);
    process.exit(1);
});
