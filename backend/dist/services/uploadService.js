"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const cloudinary_1 = require("../config/cloudinary");
// Streams an in-memory buffer (from multer memoryStorage) to Cloudinary.
// Using upload_stream avoids writing temp files to disk.
function uploadBufferToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
            if (error || !result) {
                return reject(error ?? new Error("Cloudinary upload failed"));
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
        });
        uploadStream.end(buffer);
    });
}
