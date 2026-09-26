"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        // Fail fast and loud at startup rather than deep inside a request handler.
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
exports.env = {
    port: parseInt(process.env.PORT ?? "4000", 10),
    mongodbUri: required("MONGODB_URI"),
    jwtSecret: required("JWT_SECRET"),
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
        apiKey: process.env.CLOUDINARY_API_KEY ?? "",
        apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
    },
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    isProd: process.env.NODE_ENV === "production",
};
