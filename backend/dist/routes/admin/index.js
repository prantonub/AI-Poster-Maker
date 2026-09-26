"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const analytics_1 = __importDefault(require("./analytics"));
const logs_1 = __importDefault(require("./logs"));
const posters_1 = __importDefault(require("./posters"));
const settings_1 = __importDefault(require("./settings"));
const system_1 = __importDefault(require("./system"));
const templates_1 = __importDefault(require("./templates"));
const users_1 = __importDefault(require("./users"));
const router = (0, express_1.Router)();
// Every route under /api/admin is admin-only. verifyAdmin re-checks the role
// and account status in the database on each request.
router.use(auth_1.verifyAuth, auth_1.verifyAdmin);
router.use(analytics_1.default);
router.use("/users", users_1.default);
router.use("/posters", posters_1.default);
router.use("/templates", templates_1.default);
router.use(logs_1.default);
router.use(system_1.default);
router.use(settings_1.default);
exports.default = router;
