import { Pool, PoolClient } from "pg";
import { loadConfig } from "../config";

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

/**
 * The single data-layer interface for the whole app.
 *
 * Production implementation: a `pg` connection pool against DATABASE_URL
 * (any hosted Postgres — the app was ported off embedded SQLite so it can run
 * on hosts with no persistent disk). Tests inject an in-process Postgres
 * (PGlite) implementing this same interface — one data layer, no dialect fork:
 * all SQL in the app is Postgres SQL with $n placeholders.
 */
export interface Db {
  query(text: string, params?: any[]): Promise<QueryResult>;
  one(text: string, params?: any[]): Promise<any | null>;
  all(text: string, params?: any[]): Promise<any[]>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PgDb implements Db {
  private pool: Pool;

  constructor(connectionString: string) {
    // Hosted Postgres (Supabase etc.) requires TLS; local dev does not.
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(connectionString);
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false }
    });
  }

  async query(text: string, params: any[] = []): Promise<QueryResult> {
    const res = await this.pool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
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
    const client: PoolClient = await this.pool.connect();
    const txDb: Db = {
      query: async (text, params = []) => {
        const res = await client.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      one: async (text, params = []) => {
        const res = await client.query(text, params);
        return res.rows[0] ?? null;
      },
      all: async (text, params = []) => (await client.query(text, params)).rows,
      transaction: async (inner) => inner(txDb),
      close: async () => undefined
    };
    try {
      await client.query("BEGIN");
      const out = await fn(txDb);
      await client.query("COMMIT");
      return out;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

let dbInstance: Db | null = null;

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  const cfg = loadConfig();
  dbInstance = new PgDb(cfg.dbUrl);
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    const db = dbInstance;
    dbInstance = null;
    await db.close();
  }
}

export function setDbForTesting(db: Db): void {
  if (dbInstance && dbInstance !== db) void dbInstance.close().catch(() => undefined);
  dbInstance = db;
}
