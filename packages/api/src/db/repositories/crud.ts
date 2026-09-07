import { Router } from "express";
import { getDb } from "../connection";
import { authRequired, AuthedRequest, roleRequired } from "../../middleware/auth";
import * as crypto from "crypto";

const uid = () => crypto.randomUUID();

function sanitize(row: any): any {
  if (!row) return row;
  const out = { ...row };
  if ("password_hash" in out) delete out.password_hash;
  return out;
}

/** Tenant-isolated CRUD router — every query scoped by tenant_id from the JWT. */
export function crudRouter(table: string, opts: { writableRoles?: string[] } = {}): Router {
  const router = Router();
  const writable = opts.writableRoles || ["owner", "admin"];
  router.use(authRequired);

  router.get("/", (req: AuthedRequest, res) => {
    const rows = getDb().prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY created_at DESC`).all(req.tenantId);
    res.json(rows.map(sanitize));
  });

  router.post("/", (req: AuthedRequest, res) => {
    if (!writable.includes(req.user!.role)) return void res.status(403).json({ error: "Insufficient role" });
    const body: any = { ...req.body };
    delete body.tenant_id; delete body.id;
    const id = uid(), tenant_id = req.tenantId;
    const cols = ["id", "tenant_id", ...Object.keys(body)];
    const vals = [id, tenant_id, ...Object.values(body)];
    try {
      getDb().prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...vals);
      res.status(201).json(sanitize(getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(id, tenant_id)));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
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
    const body: any = { ...req.body };
    delete body.tenant_id; delete body.id;
    const set = Object.keys(body).map(k => `${k}=?`).join(",");
    try {
      getDb().prepare(`UPDATE ${table} SET ${set} WHERE id=? AND tenant_id=?`).run(...Object.values(body), req.params.id, req.tenantId);
      res.json(sanitize(getDb().prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).get(req.params.id, req.tenantId)));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  router.delete("/:id", roleRequired("owner", "admin"), (req: AuthedRequest, res) => {
    const r = getDb().prepare(`DELETE FROM ${table} WHERE id=? AND tenant_id=?`).run(req.params.id, req.tenantId);
    if (r.changes === 0) return void res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  return router;
}
