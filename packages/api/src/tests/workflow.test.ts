import request from "supertest";
import Database from "better-sqlite3";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { initTestDb, getTestApp } from "./setup";
import { closeDb } from "../db/connection";

const uid = () => crypto.randomUUID();
let db: Database.Database, app: any, tenantId: string, ownerToken: string;

beforeAll(async () => {
  db = initTestDb(); app = await getTestApp();
  tenantId = uid();
  const email = `owner-${Date.now()}@test.com`;
  db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(tenantId, "WF Tenant", `wf-${Date.now()}`);
  db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)").run(uid(), tenantId, email, bcrypt.hashSync("Passw0rd!", 10), "Owner", "owner");
  const login = await request(app).post("/api/auth/login").send({ email, password: "Passw0rd!" });
  expect(login.status).toBe(200);
  ownerToken = login.body.token;
});
afterAll(() => closeDb());
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
    db.prepare("INSERT INTO jobs (id,tenant_id,title,description,status) VALUES (?,?,?,?,?)").run(jid, tenantId, "HVAC install", "Full HVAC installation commercial", "scheduled");
    const res = await request(app).post("/api/ai/estimate").set(auth()).send({ jobId: jid });
    expect(res.status).toBe(201);
    const parsed = JSON.parse(res.body.output);
    expect(parsed.estimate).toBeGreaterThan(0);
  });
  it("AI estimate rejects another tenant's job", async () => {
    const ot = uid(), jid = uid();
    db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(ot, "Other", "other-x");
    db.prepare("INSERT INTO jobs (id,tenant_id,title) VALUES (?,?,?)").run(jid, ot, "Other job");
    const res = await request(app).post("/api/ai/estimate").set(auth()).send({ jobId: jid });
    expect(res.status).toBe(404);
  });
});
