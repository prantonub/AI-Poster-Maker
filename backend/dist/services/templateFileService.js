"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateFilePath = templateFilePath;
exports.readTemplateHtml = readTemplateHtml;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const TEMPLATES_DIR = path_1.default.join(__dirname, "..", "templates");
function templateFilePath(fileName) {
    return path_1.default.join(TEMPLATES_DIR, fileName);
}
function readTemplateHtml(fileName) {
    const filePath = templateFilePath(fileName);
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Template HTML file not found: ${filePath}`);
    }
    return fs_1.default.readFileSync(filePath, "utf-8");
}
