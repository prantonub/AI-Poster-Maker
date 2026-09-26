import { Router } from "express";
import { verifyAuth } from "../middleware/auth";
import { uploadMiddleware } from "../middleware/upload";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { uploadBufferToCloudinary } from "../services/uploadService";

const router = Router();

router.post(
  "/",
  verifyAuth,
  uploadMiddleware,
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      throw new ApiError(400, "No photos were uploaded (field name: photos)");
    }

    const uploads = await Promise.all(
      files.map((file) =>
        uploadBufferToCloudinary(file.buffer, "poster-maker/uploads")
      )
    );

    res.status(201).json({ urls: uploads.map((u) => u.url) });
  })
);

export default router;
