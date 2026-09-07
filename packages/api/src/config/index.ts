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
}

function env(name: string): string | undefined {
  return process.env[name];
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
    publicAppUrl: env("PUBLIC_APP_URL") || "http://localhost:8080"
  };
}

export function resolveDbPath(dbUrl: string, baseDir: string): string {
  if (dbUrl.startsWith("file:")) {
    const rest = dbUrl.slice("file:".length);
    return rest.startsWith("./") ? path.resolve(baseDir, rest.slice(2)) : rest;
  }
  return dbUrl;
}
