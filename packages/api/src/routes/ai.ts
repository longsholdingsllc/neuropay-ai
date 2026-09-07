import { Router } from "express";
import { getDb } from "../db/connection";
import { authRequired, AuthedRequest, roleRequired } from "../middleware/auth";
import { createAIEstimate } from "../ai/estimator";

const router = Router();
router.use(authRequired);

router.post("/estimate", roleRequired("owner", "admin", "tech"), (req: AuthedRequest, res) => {
  const { jobId } = req.body || {};
  if (!jobId) return void res.status(400).json({ error: "jobId required" });
  const job = getDb().prepare("SELECT * FROM jobs WHERE id=? AND tenant_id=?").get(jobId, req.tenantId);
  if (!job) return void res.status(404).json({ error: "Job not found" });
  res.status(201).json(createAIEstimate(job));
});

router.get("/jobs", (req: AuthedRequest, res) => {
  const rows = getDb().prepare("SELECT * FROM ai_jobs WHERE tenant_id=? ORDER BY created_at DESC").all(req.tenantId);
  res.json(rows);
});

export default router;
