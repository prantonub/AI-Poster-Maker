"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const platformSettings_1 = require("../middleware/platformSettings");
const authSchemas_1 = require("../schemas/authSchemas");
const settingsService_1 = require("../services/settingsService");
const authService_1 = require("../services/authService");
const router = (0, express_1.Router)();
// GET /api/auth/config — public, non-sensitive platform state so the frontend
// can show maintenance / closed-registration / notice banners.
router.get("/config", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const settings = await (0, settingsService_1.getSettings)();
    res.json({
        maintenanceMode: settings.maintenanceMode,
        registrationOpen: settings.registrationOpen,
        generationEnabled: settings.generationEnabled,
        siteNotice: settings.siteNotice,
        supportEmail: settings.supportEmail,
    });
}));
router.post("/register", platformSettings_1.requireRegistrationOpen, (0, validate_1.validateBody)(authSchemas_1.registerSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, phone, password } = req.body;
    const existing = await User_1.User.findOne({ email });
    if (existing) {
        throw new errorHandler_1.ApiError(409, "An account with this email already exists");
    }
    const passwordHash = await (0, authService_1.hashPassword)(password);
    const user = await User_1.User.create({ name, email, phone, passwordHash });
    const token = (0, authService_1.signToken)(user);
    res.status(201).json({ token, user: (0, authService_1.toPublicUser)(user) });
}));
router.post("/login", (0, validate_1.validateBody)(authSchemas_1.loginSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    const user = await User_1.User.findOne({ email });
    if (!user) {
        throw new errorHandler_1.ApiError(401, "Invalid email or password");
    }
    // Checked before the password comparison so a suspended account gets a
    // clear message, and so bcrypt never runs for a locked-out user.
    // Note the strict `=== false`: accounts created before the isActive field
    // existed have it undefined, and those must keep working.
    if (user.isActive === false) {
        throw new errorHandler_1.ApiError(403, "This account has been suspended. Please contact support.");
    }
    const valid = await (0, authService_1.comparePassword)(password, user.passwordHash);
    if (!valid) {
        throw new errorHandler_1.ApiError(401, "Invalid email or password");
    }
    user.lastLoginAt = new Date();
    user.loginCount += 1;
    await user.save();
    const token = (0, authService_1.signToken)(user);
    res.json({ token, user: (0, authService_1.toPublicUser)(user) });
}));
exports.default = router;
