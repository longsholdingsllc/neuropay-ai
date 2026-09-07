import * as path from "path";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { getDb } from "./db/connection";
import authRoutes from "./routes/auth";
import domainRoutes from "./routes/domain";
import aiRoutes from "./routes/ai";
import systemRoutes from "./routes/system";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "neuropay-ai", ts: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
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
  if (!cfg.jwtSecret) { console.error("FATAL: JWT_SECRET is not set. Refusing to start."); process.exit(1); }
  runMigrations();
  const app = createApp();
  app.listen(cfg.port, () => {
    const tenants = (getDb().prepare("SELECT COUNT(*) n FROM tenants").get() as any).n;
    console.log(`NeuroPay AI listening on :${cfg.port} | tenants: ${tenants}`);
  });
}
