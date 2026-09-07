import { getDb } from "../db/connection";
import * as crypto from "crypto";

const uid = () => crypto.randomUUID();

/** Offline heuristic estimate — works without an OpenAI key; the boundary is OpenAI-ready. */
export function generateJobEstimate(job: { title: string; description?: string }): any {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  let base = 250;
  if (/(hvac|furnace|ac|air\s*condition|heating)/.test(text)) base = 450;
  else if (/(plumb|pipe|drain|water\s*heater)/.test(text)) base = 380;
  else if (/(electrical|wiring|panel|outlet)/.test(text)) base = 420;
  else if (/(roof|siding|gutter)/.test(text)) base = 700;
  else if (/(paint|drywall|floor)/.test(text)) base = 500;
  else if (/(landscap|lawn|tree)/.test(text)) base = 320;
  if (/(urgent|emergency|asap)/.test(text)) base = Math.round(base * 1.25);
  const parts = (job.description || "").split(/\s+/).filter(Boolean).length;
  if (parts > 40) base = Math.round(base * 1.15);
  const estimate = Math.round(base / 10) * 10;
  return {
    estimate,
    line_items: [
      { desc: "Labor & direct work", qty: 1, rate: Math.round(estimate * 0.6) },
      { desc: "Materials & parts", qty: 1, rate: Math.round(estimate * 0.3) },
      { desc: "Scheduling & admin", qty: 1, rate: Math.round(estimate * 0.1) }
    ],
    note: "AI-assisted estimate (offline heuristic model). Wire OPENAI_API_KEY for generative estimates."
  };
}

export function createAIEstimate(job: any): any {
  const output = JSON.stringify(generateJobEstimate({ title: job.title, description: job.description }));
  const id = uid();
  const db = getDb();
  db.prepare("INSERT INTO ai_jobs (id,tenant_id,job_id,kind,input,output,status) VALUES (?,?,?,?,?,?,?)")
    .run(id, job.tenant_id, job.id, "estimate", JSON.stringify({ title: job.title, description: job.description }), output, "done");
  return { id, kind: "estimate", output, status: "done" };
}
