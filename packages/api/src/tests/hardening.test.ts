import request from "supertest";
import Database from "better-sqlite3";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { initTestDb, getTestApp } from "./setup";
import { closeDb } from "../db/connection";

const uid = () => crypto.randomUUID();
let db: Database.Database, app: any, tenantId: string, ownerToken: string;

beforeAll(async () => {
  db = initTestDb();
  app = await getTestApp();
  tenantId = uid();
  const email = `owner-${Date.now()}@test.com`;
  db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(tenantId, "Harden Tenant", `hard-${Date.now()}`);
  db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)").run(
    uid(), tenantId, email, bcrypt.hashSync("Passw0rd!", 10), "Owner", "owner"
  );
  const login = await request(app).post("/api/auth/login").send({ email, password: "Passw0rd!" });
  expect(login.status).toBe(200);
  ownerToken = login.body.token;
});
afterAll(() => closeDb());
const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

describe("Production hardening", () => {
  it("GET /ready reports the database is reachable", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.db).toBe("ok");
  });

  it("sets baseline security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects an unknown column instead of passing it to SQL", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set(auth())
      .send({ name: "Legit", "evil) VALUES ('x'); --": "boom" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported fields/);
  });

  it("ignores attempts to set tenant_id or id from the request body", async () => {
    const forgedTenant = uid();
    const res = await request(app)
      .post("/api/customers")
      .set(auth())
      .send({ name: "Scoped Customer", tenant_id: forgedTenant, id: "abc" });
    // tenant_id / id are not on the allow-list, so the write is refused outright.
    expect(res.status).toBe(400);
    const rows = db.prepare("SELECT * FROM customers WHERE tenant_id=?").all(forgedTenant);
    expect(rows.length).toBe(0);
  });

  it("accepts a body of only whitelisted columns", async () => {
    const res = await request(app).post("/api/customers").set(auth()).send({ name: "Good Customer", email: "g@test.com" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Good Customer");
    expect(res.body.tenant_id).toBe(tenantId);
  });

  it("rate-limits repeated login attempts", async () => {
    let limited = false;
    for (let i = 0; i < 130; i++) {
      const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.com", password: "wrong" });
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
