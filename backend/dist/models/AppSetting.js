"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSetting = void 0;
const mongoose_1 = require("mongoose");
const appSettingSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose_1.Schema.Types.Mixed },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    updatedAt: { type: Date, default: Date.now },
});
exports.AppSetting = (0, mongoose_1.model)("AppSetting", appSettingSchema);
