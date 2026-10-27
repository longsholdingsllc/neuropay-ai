import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { getDb } from "./connection";
import { runMigrations } from "./migrate";
import { loadConfig } from "../config";

const uid = () => crypto.randomUUID();

export async function seed(tenantName = "NeuroPay Demo", slug = "demo"): Promise<void> {
  const db = getDb();
  await runMigrations();
  const cfg = loadConfig();
  if (await db.one("SELECT id FROM tenants WHERE slug = $1", [slug])) {
    console.log("Seed: tenant exists, skipping."); return;
  }
  const tenantId = uid(), ownerId = uid();
  const email = cfg.adminEmail || "admin@example.com";
  const password = cfg.adminPassword || "ChangeMe123!";
  const hash = bcrypt.hashSync(password, 10);
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [tenantId, tenantName, slug]);
    await tx.query(
      "INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5,$6)",
      [ownerId, tenantId, email, hash, "Owner", "owner"]
    );
    const c1 = uid();
    await tx.query(
      "INSERT INTO customers (id,tenant_id,name,email,phone) VALUES ($1,$2,$3,$4,$5)",
      [c1, tenantId, "Acme Realty", "billing@acmerealty.com", "555-0100"]
    );
    const p1 = uid();
    await tx.query(
      "INSERT INTO properties (id,tenant_id,customer_id,name,address,type) VALUES ($1,$2,$3,$4,$5,$6)",
      [p1, tenantId, c1, "Acme HQ", "100 Main St", "commercial"]
    );
    const t1 = uid();
    await tx.query(
      "INSERT INTO technicians (id,tenant_id,name,email,specialty,active) VALUES ($1,$2,$3,$4,$5,1)",
      [t1, tenantId, "Jordan Ellis", "jordan@neuropay.ai", "HVAC"]
    );
    await tx.query(
      "INSERT INTO jobs (id,tenant_id,customer_id,property_id,technician_id,title,status,priority,estimate_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [uid(), tenantId, c1, p1, t1, "HVAC tune-up", "scheduled", "normal", 350]
    );
  });
  console.log(`Seed complete. Tenant: ${slug} | Owner: ${email}`);
}

if (require.main === module) {
  seed(process.argv[2] || "NeuroPay Demo")
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    });
}
