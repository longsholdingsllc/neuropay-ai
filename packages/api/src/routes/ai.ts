import { Router } from "express";
import { getDb } from "../db/connection";
import { authRequired, AuthedRequest, roleRequired } from "../middleware/auth";
import { createAIEstimate } from "../ai/estimator";

const router = Router();
router.use(authRequired);

router.post("/estimate", roleRequired("owner", "admin", "tech"), async (req: AuthedRequest, res) => {
  const { jobId } = req.body || {};
  if (!jobId) return void res.status(400).json({ error: "jobId required" });
  const job = await getDb().one("SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2", [jobId, req.tenantId]);
  if (!job) return void res.status(404).json({ error: "Job not found" });
  res.status(201).json(await createAIEstimate(job));
});

router.get("/jobs", async (req: AuthedRequest, res) => {
  const rows = await getDb().all("SELECT * FROM ai_jobs WHERE tenant_id=$1 ORDER BY created_at DESC", [req.tenantId]);
  res.json(rows);
});

export default router;
