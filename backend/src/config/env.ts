import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    // Fail fast and loud at startup rather than deep inside a request handler.
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Image model for the AI poster flow — overridable so a model can be
  // swapped without code edits if Google deprecates the default.
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
};
