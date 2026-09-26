import { Router } from "express";
import { User } from "../models/User";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { registerSchema, loginSchema } from "../schemas/authSchemas";
import {
  hashPassword,
  comparePassword,
  signToken,
  toPublicUser,
} from "../services/authService";

const router = Router();

router.post(
  "/register",
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

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  })
);

export default router;
