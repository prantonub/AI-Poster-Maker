import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";
import { getSettings } from "../services/settingsService";

/**
 * Blocks the poster/image generation endpoints while the platform is in
 * maintenance mode, or when an admin has switched generation off (e.g. to cap
 * Hugging Face spend). Mounted after verifyAuth.
 */
export function requireGenerationEnabled(_req: Request, _res: Response, next: NextFunction) {
  getSettings()
    .then((settings) => {
      if (settings.maintenanceMode) {
        return next(
          new ApiError(503, "The platform is temporarily under maintenance. Please try again later.")
        );
      }
      if (!settings.generationEnabled) {
        return next(
          new ApiError(503, "Poster generation is temporarily disabled by the administrator.")
        );
      }
      next();
    })
    .catch(next);
}

/** Blocks /auth/register when sign-ups have been closed by an admin. */
export function requireRegistrationOpen(_req: Request, _res: Response, next: NextFunction) {
  getSettings()
    .then((settings) => {
      if (!settings.registrationOpen) {
        return next(new ApiError(503, "New registrations are currently closed."));
      }
      next();
    })
    .catch(next);
}