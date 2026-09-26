import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { IUser } from "../models/User";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";

export interface AuthTokenPayload extends JwtPayload {
  sub: string; // user id
  role: "user" | "admin";
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: IUser): string {
  const payload: AuthTokenPayload = {
    sub: user._id.toString(),
    role: user.role,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

export function toPublicUser(user: IUser) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}
