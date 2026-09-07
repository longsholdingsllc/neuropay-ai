import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { setDbForTesting } from "../db/connection";

export function initTestDb(): Database.Database {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-0123456789abcdef";
  process.env.NODE_ENV = "test";
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const dir = path.join(__dirname, "..", "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  for (const f of files) db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  setDbForTesting(db);
  return db;
}

export async function getTestApp(): Promise<any> {
  delete require.cache[require.resolve("../index")];
  const mod = await import("../index");
  return mod.createApp();
}
