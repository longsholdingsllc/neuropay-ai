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

router.get("/dashboard", authRequired, (req: AuthedRequest, res) => {
  const db = getDb(), t = req.tenantId;
  const one = (s: string): number => { const r = db.prepare(s).get(t) as any; return r ? r.n ?? 0 : 0; };
  const sum = (s: string): number => { const r = db.prepare(s).get(t) as any; return r && r.s ? r.s : 0; };
  res.json({
    customers: one("SELECT COUNT(*) n FROM customers WHERE tenant_id=?"),
    properties: one("SELECT COUNT(*) n FROM properties WHERE tenant_id=?"),
    jobs: one("SELECT COUNT(*) n FROM jobs WHERE tenant_id=?"),
    activeJobs: one("SELECT COUNT(*) n FROM jobs WHERE tenant_id=? AND status IN ('scheduled','in_progress')"),
    technicians: one("SELECT COUNT(*) n FROM technicians WHERE tenant_id=?"),
    revenue: sum("SELECT SUM(amount) s FROM payments WHERE tenant_id=? AND status='succeeded'") || 0,
    outstanding: sum("SELECT SUM(amount) s FROM invoices WHERE tenant_id=? AND status IN ('pending','overdue')") || 0
  });
});

export default router;
