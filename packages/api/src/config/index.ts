import * as path from "path";

export interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  dbUrl: string;
  adminEmail: string;
  adminPassword: string;
  openaiApiKey?: string;
  aiModel: string;
  stripeSecretKey?: string;
  publicAppUrl: string;
  corsOrigin: string;
  seedOnBoot: boolean;
}

function env(name: string): string | undefined {
  return process.env[name];
}

function bool(name: string, fallback = false): boolean {
  const raw = env(name);
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function loadConfig(): Config {
  return {
    port: parseInt(env("PORT") || "8080", 10),
    nodeEnv: env("NODE_ENV") || "production",
    jwtSecret: env("JWT_SECRET") || "",
    jwtExpiresIn: env("JWT_EXPIRES_IN") || "7d",
    dbUrl: env("DATABASE_URL") || "file:./data/neuropay.db",
    adminEmail: env("ADMIN_EMAIL") || "",
    adminPassword: env("ADMIN_PASSWORD") || "",
    openaiApiKey: env("OPENAI_API_KEY") || undefined,
    aiModel: env("AI_MODEL") || "gpt-4o-mini",
    stripeSecretKey: env("STRIPE_SECRET_KEY") || undefined,
    publicAppUrl: env("PUBLIC_APP_URL") || "http://localhost:8080",
    corsOrigin: env("CORS_ORIGIN") || "*",
    seedOnBoot: bool("SEED_ON_BOOT", false)
  };
}

export function resolveDbPath(dbUrl: string, baseDir: string): string {
  if (dbUrl.startsWith("file:")) {
    const rest = dbUrl.slice("file:".length);
    return rest.startsWith("./") ? path.resolve(baseDir, rest.slice(2)) : rest;
  }
  return dbUrl;
}
