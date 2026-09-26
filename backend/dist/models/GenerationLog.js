"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationLog = void 0;
const mongoose_1 = require("mongoose");
const generationLogSchema = new mongoose_1.Schema({
    posterId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Poster", required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    geminiPromptUsed: { type: String },
    tokensUsed: { type: Number },
    latencyMs: { type: Number },
    success: { type: Boolean, required: true },
    errorMessage: { type: String },
    createdAt: { type: Date, default: Date.now },
});
exports.GenerationLog = (0, mongoose_1.model)("GenerationLog", generationLogSchema);
