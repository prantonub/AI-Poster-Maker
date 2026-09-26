"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.asyncHandler = asyncHandler;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
class ApiError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}
exports.ApiError = ApiError;
// Wrap async route handlers so thrown/rejected errors reach errorHandler
// instead of crashing the process or hanging the request.
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            message: err.message,
            details: err.details,
        });
    }
    // eslint-disable-next-line no-console
    console.error("[unhandled error]", err);
    return res.status(500).json({ message: "Internal server error" });
}
function notFoundHandler(req, res) {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}
