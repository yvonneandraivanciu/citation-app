"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setSent(true);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap" style={{ background: "var(--surface)" }}>
      <div className="auth-card">
        <a href="/" className="nav-logo" style={{ display: "block", marginBottom: "1.5rem" }}>
          Cite<span style={{ color: "var(--accent)" }}>.</span>
        </a>
        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📬</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>Check your inbox</h2>
            <p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>
              If that email is registered, you'll receive a reset link within a few minutes.
            </p>
            <Link href="/login" className="btn btn-secondary">Back to log in</Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Forgot password?</h1>
            <p className="auth-sub">Enter your email and we'll send you a reset link.</p>
            <div className="stack stack-md">
              <div className="field">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
              {error && <div className="error-msg">{error}</div>}
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !email.trim()} style={{ width: "100%", padding: "0.7rem" }}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--ink-light)" }}>
                <Link href="/login" style={{ color: "var(--accent)" }}>Back to log in</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
