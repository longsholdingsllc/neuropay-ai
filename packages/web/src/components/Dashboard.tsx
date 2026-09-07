import React, { useEffect, useState } from "react";
import { apiGet } from "../api";

interface Row { id: string; [k: string]: any; }

export function Dashboard({ onSession }: { onSession: (s: any) => void }) {
  const [dash, setDash] = useState<any>(null);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [active, setActive] = useState("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/dashboard").then(setDash).catch((e) => setError(e.message));
    apiGet("/customers").then(setCustomers).catch(() => {});
    apiGet("/jobs").then(setJobs).catch(() => {});
    apiGet("/invoices").then(setInvoices).catch(() => {});
    apiGet("/auth/me").then((me) => onSession(me)).catch(() => {});
  }, []);

  const nav = ["dashboard", "customers", "jobs", "invoices", "ai"];
  return (
    <div className="dash">
      <nav className="side">
        {nav.map((n) => (
          <button key={n} className={active === n ? "on" : ""} onClick={() => setActive(n)}>
            {n}
          </button>
        ))}
      </nav>
      <section className="content">
        {error && <div className="error">{error}</div>}
        {active === "dashboard" && dash && (
          <div className="kpis">
            <div className="kpi"><b>{dash.customers}</b><span>Customers</span></div>
            <div className="kpi"><b>{dash.properties}</b><span>Properties</span></div>
            <div className="kpi"><b>{dash.jobs}</b><span>Jobs</span></div>
            <div className="kpi"><b>{dash.activeJobs}</b><span>Active</span></div>
            <div className="kpi"><b>{dash.technicians}</b><span>Techs</span></div>
            <div className="kpi"><b>${dash.revenue}</b><span>Revenue</span></div>
            <div className="kpi"><b>${dash.outstanding}</b><span>Outstanding</span></div>
          </div>
        )}
        {active === "customers" && <><h2>Customers</h2><Table rows={customers} cols={["name", "email", "phone"]} /></>}
        {active === "jobs" && <><h2>Jobs</h2><Table rows={jobs} cols={["title", "status", "priority", "estimate_amount"]} /></>}
        {active === "invoices" && <><h2>Invoices</h2><Table rows={invoices} cols={["amount", "status"]} /></>}
        {active === "ai" && <AiPanel />}
      </section>
    </div>
  );
}

function Table({ rows, cols }: { rows: Row[]; cols: string[] }) {
  if (!rows.length) return <p className="empty">No records yet.</p>;
  return (
    <table>
      <thead>
        <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {cols.map((c) => (
              <td key={c}>{String(r[c] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AiPanel() {
  const [ai, setAi] = useState<any[]>([]);
  const [b, setB] = useState<any>(null);
  useEffect(() => {
    apiGet("/ai/jobs").then(setAi).catch(() => {});
    apiGet("/system/boundaries").then(setB).catch(() => {});
  }, []);
  return (
    <>
      <h2>AI workflows</h2>
      {b && <p className="hint">AI mode: <b>{b.ai.mode}</b> · Payments: <b>{b.payments.mode}</b></p>}
      <Table rows={ai.map((j) => ({ id: j.id, title: j.kind, status: j.status }))} cols={["title", "status"]} />
    </>
  );
}
