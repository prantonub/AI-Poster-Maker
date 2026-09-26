"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
async function main() {
    await (0, db_1.connectDB)();
    const app = (0, app_1.createApp)();
    app.listen(env_1.env.port, () => {
        // eslint-disable-next-line no-console
        console.log(`[server] listening on http://localhost:${env_1.env.port}`);
    });
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[fatal] failed to start server:", err);
    process.exit(1);
});
