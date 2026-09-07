import jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { getDb } from "../db/connection";
import { loadConfig } from "../config";

export interface AuthUser { id: string; tenantId: string; email: string; role: string; fullName?: string; }
export interface JwtPayload extends AuthUser { iat?: number; exp?: number; }

export function signToken(user: AuthUser): string {
  const cfg = loadConfig();
  const payload: JwtPayload = { id: user.id, tenantId: user.tenantId, email: user.email, role: user.role, fullName: user.fullName };
  return jwt.sign(payload, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn } as jwt.SignOptions);
}
export function verifyToken(token: string): JwtPayload {
  const cfg = loadConfig();
  return jwt.verify(token, cfg.jwtSecret) as JwtPayload;
}
export function authenticate(email: string, password: string): AuthUser | null {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim()) as any;
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, tenantId: user.tenant_id, email: user.email, role: user.role, fullName: user.full_name };
}
