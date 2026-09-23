import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  // eslint-disable-next-line no-console
  console.log("[db] MongoDB connected");

  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[db] connection error:", err);
  });
}
