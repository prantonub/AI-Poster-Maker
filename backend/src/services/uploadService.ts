import { cloudinary } from "../config/cloudinary";

export interface UploadedImage {
  url: string;
  publicId: string;
}

// Streams an in-memory buffer (from multer memoryStorage) to Cloudinary.
// Using upload_stream avoids writing temp files to disk.
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}
