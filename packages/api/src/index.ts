import * as path from "path";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { getDb, closeDb } from "./db/connection";
import { seed } from "./db/seed";
import { createRateLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import domainRoutes from "./routes/domain";
import aiRoutes from "./routes/ai";
import systemRoutes from "./routes/system";

export function createApp() {
  const app = express();
  const cfg = loadConfig();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Baseline security headers.
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    );
    next();
  });

  app.use(cors(cfg.corsOrigin === "*" ? {} : { origin: cfg.corsOrigin.split(",").map((s) => s.trim()) }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) =>
    res.json({ status: "ok", service: "neuropay-ai", ts: new Date().toISOString() })
  );

  // Readiness — verifies the database is actually reachable, not just that the process is up.
  app.get("/ready", (_req, res) => {
    try {
      getDb().prepare("SELECT 1").get();
      res.json({ status: "ready", db: "ok", ts: new Date().toISOString() });
    } catch (e: any) {
      res.status(503).json({ status: "not-ready", db: "error", error: e.message });
    }
  });

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many login attempts. Try again later."
  });

  app.use("/api/auth", loginLimiter, authRoutes);
  app.use("/api", domainRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/system", systemRoutes);

  const webDist = path.resolve(__dirname, "..", "..", "web", "dist");
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) res.status(200).json({ status: "api-only", message: "Web dashboard not built yet." });
    });
  });

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  if (!cfg.jwtSecret || cfg.jwtSecret.length < 16) {
    console.error("FATAL: JWT_SECRET is not set or is too short (min 16 chars). Refusing to start.");
    process.exit(1);
  }

  runMigrations();

  // Optional first-boot provisioning of the initial tenant + owner account.
  if (cfg.seedOnBoot) {
    const count = (getDb().prepare("SELECT COUNT(*) n FROM tenants").get() as any).n;
    if (count === 0) {
      seed("NeuroPay Demo", "demo");
    } else {
      console.log("Seed on boot: tenants already exist, skipping.");
    }
  }

  const app = createApp();
  const server = app.listen(cfg.port, () => {
    const tenants = (getDb().prepare("SELECT COUNT(*) n FROM tenants").get() as any).n;
    console.log(`NeuroPay AI listening on :${cfg.port} | env: ${cfg.nodeEnv} | tenants: ${tenants}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received — shutting down gracefully.`);
    server.close(() => {
      closeDb();
      console.log("Shutdown complete.");
      process.exit(0);
    });
    // Do not hang forever on lingering keep-alive connections.
    setTimeout(() => process.exit(0), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
