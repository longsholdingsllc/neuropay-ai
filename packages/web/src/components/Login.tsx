import React, { useState } from "react";

export function Login({ onLogin }: { onLogin: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError("");
        try { await onLogin(email, password); } catch (err: any) { setError(err.message || "Login failed"); } finally { setBusy(false); }
      }}>
        <h1>NeuroPay AI</h1>
        <p className="sub">Field-service platform — sign in to your workspace</p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
