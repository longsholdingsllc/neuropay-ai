import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../services/auth";

export interface AuthedRequest extends Request { user?: JwtPayload; tenantId?: string; }

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return void res.status(401).json({ error: "Missing auth token" });
  try {
    const payload = verifyToken(token);
    req.user = payload;
    req.tenantId = payload.tenantId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function roleRequired(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) return void res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return void res.status(403).json({ error: "Insufficient role" });
    next();
  };
}
