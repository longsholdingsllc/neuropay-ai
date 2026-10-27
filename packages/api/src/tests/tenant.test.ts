import request from "supertest";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { initTestDb, getTestApp } from "./setup";
import { closeDb, Db } from "../db/connection";

const uid = () => crypto.randomUUID();
let db: Db, app: any;

beforeAll(async () => {
  db = await initTestDb(); app = await getTestApp();
  const hash = bcrypt.hashSync("Passw0rd!", 10);
  const t1 = uid(), t2 = uid(), u1 = uid(), u2 = uid();
  await db.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [t1, "Tenant One", "t-one"]);
  await db.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [t2, "Tenant Two", "t-two"]);
  await db.query("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5,$6)", [u1, t1, "one@test.com", hash, "Owner One", "owner"]);
  await db.query("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5,$6)", [u2, t2, "two@test.com", hash, "Owner Two", "owner"]);
  await db.query("INSERT INTO customers (id,tenant_id,name,email) VALUES ($1,$2,$3,$4)", [uid(), t1, "Tenant One Customer", "c1@test.com"]);
  await db.query("INSERT INTO customers (id,tenant_id,name,email) VALUES ($1,$2,$3,$4)", [uid(), t2, "Tenant Two Customer", "c2@test.com"]);
});
afterAll(async () => { await closeDb(); });

const login = async (email: string) => {
  const res = await request(app).post("/api/auth/login").send({ email, password: "Passw0rd!" });
  expect(res.status).toBe(200);
  return res.body.token;
};

describe("Tenant isolation", () => {
  it("tenant one sees only its own customers", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${await login("one@test.com")}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Tenant One Customer");
  });
  it("tenant two sees only its own customers", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${await login("two@test.com")}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Tenant Two Customer");
  });
  it("tenant two cannot read tenant one's row by id", async () => {
    const t1c = await db.one("SELECT id FROM customers WHERE name='Tenant One Customer'");
    const res = await request(app).get(`/api/customers/${t1c.id}`).set("Authorization", `Bearer ${await login("two@test.com")}`);
    expect(res.status).toBe(404);
  });
  it("viewer role cannot create a customer", async () => {
    const tid = (await db.one("SELECT id FROM tenants WHERE slug='t-one'")).id;
    await db.query("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5,$6)", [uid(), tid, "viewer@test.com", bcrypt.hashSync("Passw0rd!", 10), "Viewer", "viewer"]);
    const res = await request(app).post("/api/customers").set("Authorization", `Bearer ${await login("viewer@test.com")}`).send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });
});
