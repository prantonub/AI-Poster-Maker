"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const upload_1 = __importDefault(require("./routes/upload"));
const templates_1 = __importDefault(require("./routes/templates"));
const posters_1 = __importDefault(require("./routes/posters"));
const generatePoster_1 = __importDefault(require("./routes/generatePoster"));
const admin_1 = __importDefault(require("./routes/admin"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.frontendOrigin,
        credentials: true,
    }));
    app.use((0, morgan_1.default)(env_1.env.isProd ? "combined" : "dev"));
    app.use(express_1.default.json({ limit: "2mb" }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.get("/api/health", (_req, res) => {
        res.json({ status: "ok", time: new Date().toISOString() });
    });
    app.use("/api/auth", auth_1.default);
    app.use("/api/upload", upload_1.default);
    app.use("/api/templates", templates_1.default);
    app.use("/api/posters", posters_1.default);
    app.use("/api/generate-poster", generatePoster_1.default);
    app.use("/api/admin", admin_1.default);
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
