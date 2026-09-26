"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
const errorHandler_1 = require("./errorHandler");
// Validates req.body against a zod schema, replaces req.body with the
// parsed (and coerced/trimmed) result, or forwards a 400 ApiError.
function validateBody(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return next(new errorHandler_1.ApiError(400, "Validation failed", result.error.flatten()));
        }
        req.body = result.data;
        next();
    };
}
