import * as fs from "fs";
import * as path from "path";
import { getDb } from "./connection";

export function runMigrations(): string[] {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const applied = new Set((db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map(r => r.name));
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
    })();
    ran.push(file);
  }
  return ran;
}

if (require.main === module) {
  const ran = runMigrations();
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "No pending migrations.");
}
