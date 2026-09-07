import request from "supertest";
import Database from "better-sqlite3";
import { initTestDb, getTestApp } from "./setup";
import { closeDb } from "../db/connection";

let app: any;
beforeAll(async () => { initTestDb(); app = await getTestApp(); });
afterAll(() => closeDb());

describe("Health & auth basics", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
  it("rejects login without credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });
  it("returns 401 for protected route without token", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });
});
