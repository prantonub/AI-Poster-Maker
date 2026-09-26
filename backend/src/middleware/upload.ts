import multer, { MulterError } from "multer";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";

const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const multerArray = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
}).array("photos", MAX_FILES);

// Wraps multer so its own MulterError (file-too-large, too-many-files, etc.)
// comes back as a clean 400 ApiError instead of a raw multer error shape.
export function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  multerArray(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `Each photo must be under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
          : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? `You can upload at most ${MAX_FILES} photos`
          : err.message;
      return next(new ApiError(400, message));
    }
    next(err);
  });
}
