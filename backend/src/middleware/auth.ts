import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";
import { verifyToken, AuthTokenPayload } from "../services/authService";
import { User } from "../models/User";

// Extend Express's Request type so req.user is typed everywhere downstream.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function verifyAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

/**
 * Admin gate.
 *
 * Unlike the JWT-only check this used to be, the role and account status are
 * re-read from the database on every admin request. A JWT stays valid for up
 * to 7 days, so without this a demoted or suspended admin would keep full
 * control of the platform until their token expired.
 */
export function verifyAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  User.findById(req.user.sub)
    .select("role isActive")
    .lean()
    .then((user) => {
      if (!user) {
        return next(new ApiError(401, "Account no longer exists"));
      }
      if (user.isActive === false) {
        return next(new ApiError(403, "This account has been suspended"));
      }
      if (user.role !== "admin") {
        return next(new ApiError(403, "Admin access required"));
      }
      // Keep the request payload in sync with the authoritative DB state.
      req.user!.role = user.role;
      next();
    })
    .catch(next);
}
