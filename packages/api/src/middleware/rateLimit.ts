import { Request, Response, NextFunction } from "express";

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * Small dependency-free fixed-window rate limiter, keyed by client IP.
 * Used to blunt credential-stuffing against the login endpoint.
 */
export function createRateLimiter(opts: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, Entry>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();

    // Opportunistic sweep so the map cannot grow without bound.
    if (hits.size > 10000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    const key = req.ip || "unknown";
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return void next();
    }

    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return void res.status(429).json({ error: opts.message || "Too many requests" });
    }

    next();
  };
}
