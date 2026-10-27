import request from "supertest";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { initTestDb, getTestApp } from "./setup";
import { closeDb, Db } from "../db/connection";

const uid = () => crypto.randomUUID();
let db: Db, app: any, tenantId: string, ownerToken: string;

beforeAll(async () => {
  db = await initTestDb(); app = await getTestApp();
  tenantId = uid();
  const email = `owner-${Date.now()}@test.com`;
  await db.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [tenantId, "WF Tenant", `wf-${Date.now()}`]);
  await db.query("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5,$6)", [uid(), tenantId, email, bcrypt.hashSync("Passw0rd!", 10), "Owner", "owner"]);
  const login = await request(app).post("/api/auth/login").send({ email, password: "Passw0rd!" });
  expect(login.status).toBe(200);
  ownerToken = login.body.token;
});
afterAll(async () => { await closeDb(); });
const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

describe("Core field-service workflow", () => {
  it("creates customer, property, technician, job end to end", async () => {
    const cust = await request(app).post("/api/customers").set(auth()).send({ name: "WF Customer", email: "wf@test.com" });
    expect(cust.status).toBe(201);
    const prop = await request(app).post("/api/properties").set(auth()).send({ customer_id: cust.body.id, name: "Main", type: "commercial" });
    expect(prop.status).toBe(201);
    const tech = await request(app).post("/api/technicians").set(auth()).send({ name: "Jane Tech", specialty: "Electrical", active: 1 });
    expect(tech.status).toBe(201);
    const job = await request(app).post("/api/jobs").set(auth()).send({ customer_id: cust.body.id, property_id: prop.body.id, technician_id: tech.body.id, title: "Urgent electrical repair", priority: "urgent" });
    expect(job.status).toBe(201);
    const dash = await request(app).get("/api/dashboard").set(auth());
    expect(dash.body.customers).toBeGreaterThanOrEqual(1);
    expect(dash.body.jobs).toBeGreaterThanOrEqual(1);
  });
  it("AI estimate generates a scoped estimate", async () => {
    const jid = uid();
    await db.query("INSERT INTO jobs (id,tenant_id,title,description,status) VALUES ($1,$2,$3,$4,$5)", [jid, tenantId, "HVAC install", "Full HVAC installation commercial", "scheduled"]);
    const res = await request(app).post("/api/ai/estimate").set(auth()).send({ jobId: jid });
    expect(res.status).toBe(201);
    const parsed = JSON.parse(res.body.output);
    expect(parsed.estimate).toBeGreaterThan(0);
  });
  it("AI estimate rejects another tenant's job", async () => {
    const ot = uid(), jid = uid();
    await db.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [ot, "Other", "other-x"]);
    await db.query("INSERT INTO jobs (id,tenant_id,title) VALUES ($1,$2,$3)", [jid, ot, "Other job"]);
    const res = await request(app).post("/api/ai/estimate").set(auth()).send({ jobId: jid });
    expect(res.status).toBe(404);
  });
});
