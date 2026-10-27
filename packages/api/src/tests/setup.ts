import { PGlite } from "@electric-sql/pglite";
import { Db, QueryResult, setDbForTesting } from "../db/connection";
import { runMigrations } from "../db/migrate";

// Booting a real (WASM) Postgres + migrations + bcrypt is slower than the old
// in-memory SQLite setup; give hooks and tests room to breathe.
jest.setTimeout(120_000);

/**
 * Test database: a real in-process Postgres (PGlite, WASM build of Postgres)
 * implementing the same Db interface as the production pg pool. The suite
 * therefore runs against the exact production SQL dialect — the SQLite
 * in-memory database went away with the Postgres port.
 */
class PgliteDb implements Db {
  constructor(private pg: PGlite) {}

  async query(text: string, params: any[] = []): Promise<QueryResult> {
    const res: any = await this.pg.query(text, params);
    return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
  }

  async one(text: string, params: any[] = []): Promise<any | null> {
    const { rows } = await this.query(text, params);
    return rows[0] ?? null;
  }

  async all(text: string, params: any[] = []): Promise<any[]> {
    const { rows } = await this.query(text, params);
    return rows;
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx: any) => {
      const txDb: Db = {
        query: async (text: string, params: any[] = []) => {
          const res: any = await tx.query(text, params);
          return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
        },
        one: async (text: string, params: any[] = []) => {
          const res: any = await tx.query(text, params);
          return res.rows[0] ?? null;
        },
        all: async (text: string, params: any[] = []) => {
          const res: any = await tx.query(text, params);
          return res.rows;
        },
        transaction: async (inner: (t: Db) => Promise<any>) => inner(txDb),
        close: async () => undefined
      };
      return fn(txDb);
    });
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

export async function initTestDb(): Promise<Db> {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-0123456789abcdef";
  process.env.NODE_ENV = "test";
  const pg = new PGlite();
  await pg.waitReady;
  const db = new PgliteDb(pg);
  setDbForTesting(db);
  await runMigrations();
  return db;
}

export async function getTestApp(): Promise<any> {
  delete require.cache[require.resolve("../index")];
  const mod = await import("../index");
  return mod.createApp();
}
