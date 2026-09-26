"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = getBrowser;
exports.closeBrowser = closeBrowser;
const puppeteer_1 = __importDefault(require("puppeteer"));
let browserPromise = null;
// CRITICAL: never call puppeteer.launch() per job — a Chromium process per
// poster is far too expensive. Launch once, share the instance, open a
// fresh page per job and close only the page when done.
function getBrowser() {
    if (!browserPromise) {
        browserPromise = puppeteer_1.default.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                // Chromium's default 64 MB /dev/shm inside Docker is too small to
                // render a 1200x1600 poster reliably; a full shm stalls the renderer
                // and surfaces as a navigation timeout. Use container tmpfs instead.
                "--disable-dev-shm-usage",
            ],
            // In the Docker deploy image we point this at the apt-installed
            // Chromium instead of Puppeteer's own bundled download. Locally
            // this env var is unset, so Puppeteer uses its bundled binary.
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });
    }
    return browserPromise;
}
async function closeBrowser() {
    if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
        browserPromise = null;
    }
}
// Graceful shutdown so a dev-server restart doesn't leak Chromium processes.
process.on("SIGTERM", () => {
    closeBrowser().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
    closeBrowser().finally(() => process.exit(0));
});
