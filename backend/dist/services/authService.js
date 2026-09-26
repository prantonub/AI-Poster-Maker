"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.toPublicUser = toPublicUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";
async function hashPassword(plain) {
    return bcryptjs_1.default.hash(plain, SALT_ROUNDS);
}
async function comparePassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
function signToken(user) {
    const payload = {
        sub: user._id.toString(),
        role: user.role,
    };
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
}
function toPublicUser(user) {
    return {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
    };
}
