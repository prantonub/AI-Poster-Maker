"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireGenerationEnabled = requireGenerationEnabled;
exports.requireRegistrationOpen = requireRegistrationOpen;
const errorHandler_1 = require("./errorHandler");
const settingsService_1 = require("../services/settingsService");
/**
 * Blocks the poster/image generation endpoints while the platform is in
 * maintenance mode, or when an admin has switched generation off (e.g. to cap
 * Hugging Face spend). Mounted after verifyAuth.
 */
function requireGenerationEnabled(_req, _res, next) {
    (0, settingsService_1.getSettings)()
        .then((settings) => {
        if (settings.maintenanceMode) {
            return next(new errorHandler_1.ApiError(503, "The platform is temporarily under maintenance. Please try again later."));
        }
        if (!settings.generationEnabled) {
            return next(new errorHandler_1.ApiError(503, "Poster generation is temporarily disabled by the administrator."));
        }
        next();
    })
        .catch(next);
}
/** Blocks /auth/register when sign-ups have been closed by an admin. */
function requireRegistrationOpen(_req, _res, next) {
    (0, settingsService_1.getSettings)()
        .then((settings) => {
        if (!settings.registrationOpen) {
            return next(new errorHandler_1.ApiError(503, "New registrations are currently closed."));
        }
        next();
    })
        .catch(next);
}
