import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { loadConfig, resolveDbPath } from "../config";

export type DB = Database.Database;
let dbInstance: DB | null = null;

export function getDb(): DB {
  if (dbInstance) return dbInstance;
  const cfg = loadConfig();
  const baseDir = path.resolve(__dirname, "..", "..");
  const dbPath = resolveDbPath(cfg.dbUrl, baseDir);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function setDbForTesting(db: DB): void {
  if (dbInstance && dbInstance !== db) dbInstance.close();
  dbInstance = db;
}
