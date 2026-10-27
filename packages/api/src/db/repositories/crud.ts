import { Router } from "express";
import { getDb } from "../connection";
import { authRequired, AuthedRequest, roleRequired } from "../../middleware/auth";
import { TABLE_COLUMNS, isKnownTable } from "../schema";
import * as crypto from "crypto";

const uid = () => crypto.randomUUID();

function sanitize(row: any): any {
  if (!row) return row;
  const out = { ...row };
  if ("password_hash" in out) delete out.password_hash;
  return out;
}

/** $1..$n placeholder list for a column set. */
const placeholders = (cols: string[], offset = 0) => cols.map((_, i) => `$${offset + i + 1}`).join(",");

/**
 * Split a request body into whitelisted columns and rejected keys.
 * Anything not on the table's allow-list is dropped — the caller decides
 * whether a non-empty rejected set is a 400.
 */
function partitionBody(table: string, body: any): { accepted: Record<string, any>; rejected: string[] } {
  const allowed = TABLE_COLUMNS[table] || [];
  const accepted: Record<string, any> = {};
  const rejected: string[] = [];
  for (const key of Object.keys(body || {})) {
    if (allowed.includes(key)) accepted[key] = body[key];
    else rejected.push(key);
  }
  return { accepted, rejected };
}

/** Tenant-isolated CRUD router — every query scoped by tenant_id from the JWT. */
export function crudRouter(table: string, opts: { writableRoles?: string[] } = {}): Router {
  const router = Router();
  const writable = opts.writableRoles || ["owner", "admin"];

  if (!isKnownTable(table)) throw new Error(`crudRouter: unknown table "${table}"`);

  router.use(authRequired);

  router.get("/", async (req: AuthedRequest, res) => {
    try {
      const rows = await getDb().all(
        `SELECT * FROM ${table} WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [req.tenantId]
      );
      res.json(rows.map(sanitize));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/", async (req: AuthedRequest, res) => {
    if (!writable.includes(req.user!.role)) return void res.status(403).json({ error: "Insufficient role" });

    const { accepted, rejected } = partitionBody(table, req.body);
    if (rejected.length) {
      return void res.status(400).json({ error: `Unsupported fields: ${rejected.join(", ")}` });
    }
    const cols = Object.keys(accepted);
    if (!cols.length) return void res.status(400).json({ error: "No writable fields provided" });

    const id = uid();
    const tenant_id = req.tenantId;
    const allCols = ["id", "tenant_id", ...cols];
    const vals = [id, tenant_id, ...cols.map((c) => accepted[c])];

    try {
      await getDb().query(
        `INSERT INTO ${table} (${allCols.join(",")}) VALUES (${placeholders(allCols)})`,
        vals
      );
      const row = await getDb().one(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [id, tenant_id]);
      res.status(201).json(sanitize(row));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/:id", async (req: AuthedRequest, res) => {
    try {
      const row = await getDb().one(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
      if (!row) return void res.status(404).json({ error: "Not found" });
      res.json(sanitize(row));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put("/:id", async (req: AuthedRequest, res) => {
    if (!writable.includes(req.user!.role)) return void res.status(403).json({ error: "Insufficient role" });

    try {
      const existing = await getDb().one(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
      if (!existing) return void res.status(404).json({ error: "Not found" });

      const { accepted, rejected } = partitionBody(table, req.body);
      if (rejected.length) {
        return void res.status(400).json({ error: `Unsupported fields: ${rejected.join(", ")}` });
      }
      const cols = Object.keys(accepted);
      if (!cols.length) return void res.status(400).json({ error: "No writable fields provided" });

      const set = cols.map((c, i) => `${c}=$${i + 1}`).join(",");
      await getDb().query(
        `UPDATE ${table} SET ${set} WHERE id=$${cols.length + 1} AND tenant_id=$${cols.length + 2}`,
        [...cols.map((c) => accepted[c]), req.params.id, req.tenantId]
      );
      const row = await getDb().one(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
      res.json(sanitize(row));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete("/:id", roleRequired("owner", "admin"), async (req: AuthedRequest, res) => {
    try {
      const r = await getDb().query(`DELETE FROM ${table} WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
      if (r.rowCount === 0) return void res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
