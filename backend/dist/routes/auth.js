"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const authSchemas_1 = require("../schemas/authSchemas");
const authService_1 = require("../services/authService");
const router = (0, express_1.Router)();
router.post("/register", (0, validate_1.validateBody)(authSchemas_1.registerSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    const valid = await (0, authService_1.comparePassword)(password, user.passwordHash);
    if (!valid) {
        throw new errorHandler_1.ApiError(401, "Invalid email or password");
    }
    const token = (0, authService_1.signToken)(user);
    res.json({ token, user: (0, authService_1.toPublicUser)(user) });
}));
exports.default = router;
