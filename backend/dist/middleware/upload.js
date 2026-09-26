"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = uploadMiddleware;
const multer_1 = __importStar(require("multer"));
const errorHandler_1 = require("./errorHandler");
const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const multerArray = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE_BYTES,
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new errorHandler_1.ApiError(400, `Unsupported file type: ${file.mimetype}`));
        }
        cb(null, true);
    },
}).array("photos", MAX_FILES);
// Wraps multer so its own MulterError (file-too-large, too-many-files, etc.)
// comes back as a clean 400 ApiError instead of a raw multer error shape.
function uploadMiddleware(req, res, next) {
    multerArray(req, res, (err) => {
        if (!err)
            return next();
        if (err instanceof errorHandler_1.ApiError)
            return next(err);
        if (err instanceof multer_1.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? `Each photo must be under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
                : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
                    ? `You can upload at most ${MAX_FILES} photos`
                    : err.message;
            return next(new errorHandler_1.ApiError(400, message));
        }
        next(err);
    });
}
