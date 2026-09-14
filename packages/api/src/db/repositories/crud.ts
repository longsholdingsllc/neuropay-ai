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

  router.get("/", (req: AuthedRequest, res) => {
    const rows = getDb()
      .prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY created_at DESC`)
      .all(req.tenantId);
    res.json(rows.map(sanitize));
  });

  router.post("/", (req: AuthedRequest, res) => {
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
      getDb()
        .prepare(`INSERT INTO ${table} (${allCols.join(",")}) VALUES (${allCols.map(() => "?").join(",")})`)
        .run(...vals);
      res.status(201).json(sanitize(getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(id, tenant_id)));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/:id", (req: AuthedRequest, res) => {
    const row = getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(req.params.id, req.tenantId);
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json(sanitize(row));
  });

  router.put("/:id", (req: AuthedRequest, res) => {
    if (!writable.includes(req.user!.role)) return void res.status(403).json({ error: "Insufficient role" });

    const existing = getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(req.params.id, req.tenantId);
    if (!existing) return void res.status(404).json({ error: "Not found" });

    const { accepted, rejected } = partitionBody(table, req.body);
    if (rejected.length) {
      return void res.status(400).json({ error: `Unsupported fields: ${rejected.join(", ")}` });
    }
    const cols = Object.keys(accepted);
    if (!cols.length) return void res.status(400).json({ error: "No writable fields provided" });

    const set = cols.map((c) => `${c}=?`).join(",");
    try {
      getDb()
        .prepare(`UPDATE ${table} SET ${set} WHERE id=? AND tenant_id=?`)
        .run(...cols.map((c) => accepted[c]), req.params.id, req.tenantId);
      res.json(sanitize(getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(req.params.id, req.tenantId)));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete("/:id", roleRequired("owner", "admin"), (req: AuthedRequest, res) => {
    const r = getDb().prepare(`DELETE FROM ${table} WHERE id=? AND tenant_id=?`).run(req.params.id, req.tenantId);
    if (r.changes === 0) return void res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  return router;
}
