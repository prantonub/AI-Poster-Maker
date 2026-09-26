"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const errorHandler_1 = require("../middleware/errorHandler");
const uploadService_1 = require("../services/uploadService");
const router = (0, express_1.Router)();
router.post("/", auth_1.verifyAuth, upload_1.uploadMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
        throw new errorHandler_1.ApiError(400, "No photos were uploaded (field name: photos)");
    }
    const uploads = await Promise.all(files.map((file) => (0, uploadService_1.uploadBufferToCloudinary)(file.buffer, "poster-maker/uploads")));
    res.status(201).json({ urls: uploads.map((u) => u.url) });
}));
exports.default = router;
