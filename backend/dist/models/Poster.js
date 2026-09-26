"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Poster = void 0;
const mongoose_1 = require("mongoose");
const formDataSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    // Not collected by the create form anymore — optional, defaults to "".
    designation: { type: String, default: "" },
    party: { type: String, default: "" },
    district: { type: String, default: "" },
    thana: { type: String, default: "" },
    union: { type: String, default: "" },
    occasion: {
        type: String,
        enum: ["victory_day", "tribute", "campaign", "greeting", "eid_festival"],
        required: true,
    },
    headlineText: { type: String, required: true },
}, { _id: false });
const posterSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    templateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Template", required: true },
    formData: { type: formDataSchema, required: true },
    uploadedPhotoUrls: { type: [String], default: [] },
    generatedImageUrl: { type: String },
    status: {
        type: String,
        enum: ["draft", "generating", "completed", "failed"],
        default: "draft",
    },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
}, { timestamps: true });
exports.Poster = (0, mongoose_1.model)("Poster", posterSchema);
