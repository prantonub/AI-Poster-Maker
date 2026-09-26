import { AppSetting } from "../models/AppSetting";
import type { Types } from "mongoose";

// Operator-tunable platform settings. These live in MongoDB (not env vars) so
// an admin can flip them at runtime without a redeploy.
export interface AppSettings {
  // Blocks poster generation + AI image generation app-wide.
  maintenanceMode: boolean;
  // Blocks new sign-ups; existing users keep working.
  registrationOpen: boolean;
  // Master switch for the expensive AI image pipeline only.
  generationEnabled: boolean;
  // Site-wide banner text (empty = no banner).
  siteNotice: string;
  supportEmail: string;
  // How many posters a single user may create per day (0 = unlimited).
  dailyPosterLimitPerUser: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  maintenanceMode: false,
  registrationOpen: true,
  generationEnabled: true,
  siteNotice: "",
  supportEmail: "",
  dailyPosterLimitPerUser: 0,
};

export type SettingKey = keyof AppSettings;

const CACHE_TTL_MS = 30_000;

let cache: { value: AppSettings; expiresAt: number } | null = null;

/** Returns every setting, falling back to the default for anything unset. */
export async function getSettings(): Promise<AppSettings> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const docs = await AppSetting.find().lean();
  const value = { ...DEFAULT_SETTINGS };
  for (const doc of docs) {
    if (doc.key in DEFAULT_SETTINGS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (value as any)[doc.key] = doc.value;
    }
  }

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/** Reads a single setting without going through the whole settings object. */
export async function getSetting<K extends SettingKey>(key: K): Promise<AppSettings[K]> {
  const doc = await AppSetting.findOne({ key }).lean();
  if (!doc) return DEFAULT_SETTINGS[key];
  return doc.value as AppSettings[K];
}

/** Applies a partial update and invalidates the cache. */
export async function updateSettings(
  patch: Partial<AppSettings>,
  updatedBy?: string
): Promise<AppSettings> {
  const ops = Object.entries(patch)
    .filter(([key]) => key in DEFAULT_SETTINGS)
    .map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: {
          $set: {
            key,
            value,
            updatedAt: new Date(),
            // Cast: the value is a valid user id string; Mongoose casts it to
            // an ObjectId on write. TypeScript can't narrow Object.entries here.
            ...(updatedBy ? { updatedBy: updatedBy as unknown as Types.ObjectId } : {}),
          },
        },
        upsert: true,
      },
    }));

  if (ops.length > 0) {
    await AppSetting.bulkWrite(ops);
  }

  invalidateSettingsCache();
  return getSettings();
}

export function invalidateSettingsCache(): void {
  cache = null;
}

/** Type-safe identity for ObjectId refs used in audit logs. */
export type AdminRef = Types.ObjectId | string;