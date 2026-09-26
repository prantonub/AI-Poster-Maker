import { Router } from "express";
import { User } from "../models/User";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { requireRegistrationOpen } from "../middleware/platformSettings";
import { registerSchema, loginSchema } from "../schemas/authSchemas";
import { getSettings } from "../services/settingsService";
import {
  hashPassword,
  comparePassword,
  signToken,
  toPublicUser,
} from "../services/authService";

const router = Router();

// GET /api/auth/config — public, non-sensitive platform state so the frontend
// can show maintenance / closed-registration / notice banners.
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({
      maintenanceMode: settings.maintenanceMode,
      registrationOpen: settings.registrationOpen,
      generationEnabled: settings.generationEnabled,
      siteNotice: settings.siteNotice,
      supportEmail: settings.supportEmail,
    });
  })
);

router.post(
  "/register",
  requireRegistrationOpen,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, phone, passwordHash });

    const token = signToken(user);
    res.status(201).json({ token, user: toPublicUser(user) });
  })
);

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Checked before the password comparison so a suspended account gets a
    // clear message, and so bcrypt never runs for a locked-out user.
    if (!user.isActive) {
      throw new ApiError(403, "This account has been suspended. Please contact support.");
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    user.lastLoginAt = new Date();
    user.loginCount += 1;
    await user.save();

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  })
);

export default router;
