import { Router } from "express";
import { crudRouter } from "../db/repositories/crud";
import { getDb } from "../db/connection";
import { authRequired, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use("/customers", crudRouter("customers", { writableRoles: ["owner", "admin", "tech"] }));
router.use("/properties", crudRouter("properties", { writableRoles: ["owner", "admin", "tech"] }));
router.use("/technicians", crudRouter("technicians", { writableRoles: ["owner", "admin"] }));
router.use("/estimates", crudRouter("estimates", { writableRoles: ["owner", "admin", "tech"] }));
router.use("/jobs", crudRouter("jobs", { writableRoles: ["owner", "admin", "tech"] }));
router.use("/invoices", crudRouter("invoices", { writableRoles: ["owner", "admin"] }));
router.use("/payments", crudRouter("payments", { writableRoles: ["owner", "admin"] }));

router.get("/dashboard", authRequired, async (req: AuthedRequest, res) => {
  const db = getDb(), t = req.tenantId;
  const one = async (s: string): Promise<number> => { const r = await db.one(s, [t]); return r ? r.n ?? 0 : 0; };
  const sum = async (s: string): Promise<number> => { const r = await db.one(s, [t]); return r && r.s ? r.s : 0; };
  res.json({
    customers: await one("SELECT COUNT(*)::int AS n FROM customers WHERE tenant_id=$1"),
    properties: await one("SELECT COUNT(*)::int AS n FROM properties WHERE tenant_id=$1"),
    jobs: await one("SELECT COUNT(*)::int AS n FROM jobs WHERE tenant_id=$1"),
    activeJobs: await one("SELECT COUNT(*)::int AS n FROM jobs WHERE tenant_id=$1 AND status IN ('scheduled','in_progress')"),
    technicians: await one("SELECT COUNT(*)::int AS n FROM technicians WHERE tenant_id=$1"),
    revenue: (await sum("SELECT COALESCE(SUM(amount),0)::float8 AS s FROM payments WHERE tenant_id=$1 AND status='succeeded'")) || 0,
    outstanding: (await sum("SELECT COALESCE(SUM(amount),0)::float8 AS s FROM invoices WHERE tenant_id=$1 AND status IN ('pending','overdue')")) || 0
  });
});

export default router;
