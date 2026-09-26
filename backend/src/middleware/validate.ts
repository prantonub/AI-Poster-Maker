import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "./errorHandler";

// Validates req.body against a zod schema, replaces req.body with the
// parsed (and coerced/trimmed) result, or forwards a 400 ApiError.
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new ApiError(400, "Validation failed", result.error.flatten())
      );
    }
    req.body = result.data;
    next();
  };
}
