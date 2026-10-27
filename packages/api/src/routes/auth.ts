import { Router } from "express";
import { authenticate, signToken } from "../services/auth";
import { getDb } from "../db/connection";
import { authRequired, AuthedRequest } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return void res.status(400).json({ error: "Email and password required" });
  const user = await authenticate(email, password);
  if (!user) return void res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken(user), user });
});

router.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const tenant = await getDb().one("SELECT id,name,slug FROM tenants WHERE id=$1", [req.tenantId]);
  res.json({ user: req.user, tenant });
});

export default router;
