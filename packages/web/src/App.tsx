import React, { useEffect, useState } from "react";
import { apiGet, login, setToken, getToken } from "./api";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";

export function App() {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    if (authed) apiGet("/auth/me").then(setSession).catch(() => { setToken(null); setAuthed(false); });
  }, [authed]);
  if (!authed) return <Login onLogin={async (e, p) => { const r = await login(e, p); setToken(r.token); setAuthed(true); }} />;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">NeuroPay AI</div>
        <div className="tenant">{session?.tenant?.name || "…"} <button className="logout" onClick={() => { setToken(null); setAuthed(false); }}>Sign out</button></div>
      </header>
      <main><Dashboard onSession={setSession} /></main>
    </div>
  );
}
