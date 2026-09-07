import { Router } from "express";
import { loadConfig } from "../config";
import { authRequired, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authRequired);

router.get("/boundaries", (req: AuthedRequest, res) => {
  const cfg = loadConfig();
  res.json({
    ai: { mode: cfg.openaiApiKey ? "openai" : "local-heuristic", model: cfg.aiModel },
    payments: { mode: cfg.stripeSecretKey ? "stripe" : "manual" },
    tenantId: req.tenantId
  });
});

export default router;
