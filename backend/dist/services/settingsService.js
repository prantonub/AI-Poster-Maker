"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
exports.getSettings = getSettings;
exports.getSetting = getSetting;
exports.updateSettings = updateSettings;
exports.invalidateSettingsCache = invalidateSettingsCache;
const AppSetting_1 = require("../models/AppSetting");
exports.DEFAULT_SETTINGS = {
    maintenanceMode: false,
    registrationOpen: true,
    generationEnabled: true,
    siteNotice: "",
    supportEmail: "",
    dailyPosterLimitPerUser: 0,
};
const CACHE_TTL_MS = 30000;
let cache = null;
/** Returns every setting, falling back to the default for anything unset. */
async function getSettings() {
    if (cache && cache.expiresAt > Date.now()) {
        return cache.value;
    }
    const docs = await AppSetting_1.AppSetting.find().lean();
    const value = { ...exports.DEFAULT_SETTINGS };
    for (const doc of docs) {
        if (doc.key in exports.DEFAULT_SETTINGS) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value[doc.key] = doc.value;
        }
    }
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
}
/** Reads a single setting without going through the whole settings object. */
async function getSetting(key) {
    const doc = await AppSetting_1.AppSetting.findOne({ key }).lean();
    if (!doc)
        return exports.DEFAULT_SETTINGS[key];
    return doc.value;
}
/** Applies a partial update and invalidates the cache. */
async function updateSettings(patch, updatedBy) {
    const ops = Object.entries(patch)
        .filter(([key]) => key in exports.DEFAULT_SETTINGS)
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
                    ...(updatedBy ? { updatedBy: updatedBy } : {}),
                },
            },
            upsert: true,
        },
    }));
    if (ops.length > 0) {
        await AppSetting_1.AppSetting.bulkWrite(ops);
    }
    invalidateSettingsCache();
    return getSettings();
}
function invalidateSettingsCache() {
    cache = null;
}
