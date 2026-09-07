import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { getDb } from "./connection";
import { runMigrations } from "./migrate";
import { loadConfig } from "../config";

const uid = () => crypto.randomUUID();

export function seed(tenantName = "NeuroPay Demo", slug = "demo"): void {
  const db = getDb();
  runMigrations();
  const cfg = loadConfig();
  if (db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slug)) {
    console.log("Seed: tenant exists, skipping."); return;
  }
  const tenantId = uid(), ownerId = uid();
  const email = cfg.adminEmail || "admin@example.com";
  const password = cfg.adminPassword || "ChangeMe123!";
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(tenantId, tenantName, slug);
    db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)")
      .run(ownerId, tenantId, email, hash, "Owner", "owner");
    const c1 = uid();
    db.prepare("INSERT INTO customers (id,tenant_id,name,email,phone) VALUES (?,?,?,?,?)")
      .run(c1, tenantId, "Acme Realty", "billing@acmerealty.com", "555-0100");
    const p1 = uid();
    db.prepare("INSERT INTO properties (id,tenant_id,customer_id,name,address,type) VALUES (?,?,?,?,?,?)")
      .run(p1, tenantId, c1, "Acme HQ", "100 Main St", "commercial");
    const t1 = uid();
    db.prepare("INSERT INTO technicians (id,tenant_id,name,email,specialty,active) VALUES (?,?,?,?,?,1)")
      .run(t1, tenantId, "Jordan Ellis", "jordan@neuropay.ai", "HVAC");
    db.prepare("INSERT INTO jobs (id,tenant_id,customer_id,property_id,technician_id,title,status,priority,estimate_amount) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(uid(), tenantId, c1, p1, t1, "HVAC tune-up", "scheduled", "normal", 350);
  })();
  console.log(`Seed complete. Tenant: ${slug} | Owner: ${email}`);
}

if (require.main === module) seed(process.argv[2] || "NeuroPay Demo");
