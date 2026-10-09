"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); setMessage("No token provided."); return; }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setStatus("error"); setMessage(d.error); } else { setStatus("success"); } })
      .catch(() => { setStatus("error"); setMessage("Something went wrong."); });
  }, [params]);

  return (
    <div className="auth-wrap" style={{ background: "var(--surface)" }}>
      <div className="auth-card" style={{ textAlign: "center" }}>
        <a href="/" className="nav-logo" style={{ display: "block", marginBottom: "1.5rem" }}>Cite<span style={{ color: "var(--accent)" }}>.</span></a>
        {status === "loading" && <p style={{ color: "var(--ink-light)" }}>Vérification…</p>}
        {status === "success" && (<><div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div><h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>Courriel vérifié !</h2><p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>Votre compte est maintenant actif.</p><Link href="/login" className="btn btn-primary">Se connecter</Link></>)}
        {status === "error" && (<><div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>❌</div><h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>Échec de la vérification</h2><p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>{message}</p><Link href="/register" className="btn btn-secondary">Retour à l'inscription</Link></>)}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card">Chargement…</div></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
