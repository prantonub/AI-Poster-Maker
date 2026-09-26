import { Router } from "express";
import { verifyAuth, verifyAdmin } from "../../middleware/auth";
import analyticsRoutes from "./analytics";
import logRoutes from "./logs";
import posterRoutes from "./posters";
import settingsRoutes from "./settings";
import systemRoutes from "./system";
import templateRoutes from "./templates";
import userRoutes from "./users";

const router = Router();

// Every route under /api/admin is admin-only. verifyAdmin re-checks the role
// and account status in the database on each request.
router.use(verifyAuth, verifyAdmin);

router.use(analyticsRoutes);
router.use("/users", userRoutes);
router.use("/posters", posterRoutes);
router.use("/templates", templateRoutes);
router.use(logRoutes);
router.use(systemRoutes);
router.use(settingsRoutes);

export default router;