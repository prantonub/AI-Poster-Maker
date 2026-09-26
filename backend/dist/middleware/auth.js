"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
exports.verifyAdmin = verifyAdmin;
const errorHandler_1 = require("./errorHandler");
const authService_1 = require("../services/authService");
const User_1 = require("../models/User");
function verifyAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next(new errorHandler_1.ApiError(401, "Missing or malformed Authorization header"));
    }
    const token = header.slice("Bearer ".length);
    try {
        req.user = (0, authService_1.verifyToken)(token);
        next();
    }
    catch {
        next(new errorHandler_1.ApiError(401, "Invalid or expired token"));
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
function verifyAdmin(req, _res, next) {
    if (!req.user) {
        return next(new errorHandler_1.ApiError(401, "Authentication required"));
    }
    User_1.User.findById(req.user.sub)
        .select("role isActive")
        .lean()
        .then((user) => {
        if (!user) {
            return next(new errorHandler_1.ApiError(401, "Account no longer exists"));
        }
        if (user.isActive === false) {
            return next(new errorHandler_1.ApiError(403, "This account has been suspended"));
        }
        if (user.role !== "admin") {
            return next(new errorHandler_1.ApiError(403, "Admin access required"));
        }
        // Keep the request payload in sync with the authoritative DB state.
        req.user.role = user.role;
        next();
    })
        .catch(next);
}
