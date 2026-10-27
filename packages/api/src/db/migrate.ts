import * as fs from "fs";
import * as path from "path";
import { getDb } from "./connection";

export async function runMigrations(): Promise<string[]> {
  const db = getDb();
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  );
  const appliedRows = await db.all("SELECT name FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.name as string));
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    // Execute statement-by-statement (no multi-statement strings) so the same
    // code path works on every Postgres driver, pooled or in-process.
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await db.transaction(async (tx) => {
      for (const stmt of statements) await tx.query(stmt);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}

if (require.main === module) {
  runMigrations()
    .then((ran) => {
      console.log(ran.length ? `Applied: ${ran.join(", ")}` : "No pending migrations.");
      process.exit(0);
    })
    .catch((e) => {
      console.error("Migration failed:", e);
      process.exit(1);
    });
}
