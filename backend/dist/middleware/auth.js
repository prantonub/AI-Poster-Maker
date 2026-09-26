"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
exports.verifyAdmin = verifyAdmin;
const errorHandler_1 = require("./errorHandler");
const authService_1 = require("../services/authService");
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
function verifyAdmin(req, _res, next) {
    if (!req.user) {
        return next(new errorHandler_1.ApiError(401, "Authentication required"));
    }
    if (req.user.role !== "admin") {
        return next(new errorHandler_1.ApiError(403, "Admin access required"));
    }
    next();
}
