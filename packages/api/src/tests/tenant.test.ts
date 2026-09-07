import request from "supertest";
import Database from "better-sqlite3";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { initTestDb, getTestApp } from "./setup";
import { closeDb } from "../db/connection";

const uid = () => crypto.randomUUID();
let db: Database.Database, app: any;

beforeAll(async () => {
  db = initTestDb(); app = await getTestApp();
  const hash = bcrypt.hashSync("Passw0rd!", 10);
  const t1 = uid(), t2 = uid(), u1 = uid(), u2 = uid();
  db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(t1, "Tenant One", "t-one");
  db.prepare("INSERT INTO tenants (id,name,slug) VALUES (?,?,?)").run(t2, "Tenant Two", "t-two");
  db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)").run(u1, t1, "one@test.com", hash, "Owner One", "owner");
  db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)").run(u2, t2, "two@test.com", hash, "Owner Two", "owner");
  db.prepare("INSERT INTO customers (id,tenant_id,name,email) VALUES (?,?,?,?)").run(uid(), t1, "Tenant One Customer", "c1@test.com");
  db.prepare("INSERT INTO customers (id,tenant_id,name,email) VALUES (?,?,?,?)").run(uid(), t2, "Tenant Two Customer", "c2@test.com");
});
afterAll(() => closeDb());

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
    const t1c = db.prepare("SELECT id FROM customers WHERE name='Tenant One Customer'").get() as any;
    const res = await request(app).get(`/api/customers/${t1c.id}`).set("Authorization", `Bearer ${await login("two@test.com")}`);
    expect(res.status).toBe(404);
  });
  it("viewer role cannot create a customer", async () => {
    const tid = (db.prepare("SELECT id FROM tenants WHERE slug='t-one'").get() as any).id;
    db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,full_name,role) VALUES (?,?,?,?,?,?)").run(uid(), tid, "viewer@test.com", bcrypt.hashSync("Passw0rd!", 10), "Viewer", "viewer");
    const res = await request(app).post("/api/customers").set("Authorization", `Bearer ${await login("viewer@test.com")}`).send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });
});
