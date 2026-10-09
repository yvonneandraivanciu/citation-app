"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.get("token"), password }) });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setDone(true); setTimeout(() => router.push("/login"), 2000); }
    } catch { setError("Une erreur est survenue."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap" style={{ background: "var(--surface)" }}>
      <div className="auth-card">
        <a href="/" className="nav-logo" style={{ display: "block", marginBottom: "1.5rem" }}>Cite<span style={{ color: "var(--accent)" }}>.</span></a>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>Mot de passe mis à jour !</h2>
            <p style={{ color: "var(--ink-light)" }}>Redirection vers la connexion…</p>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Réinitialiser le mot de passe</h1>
            <p className="auth-sub">Choisissez un nouveau mot de passe pour votre compte.</p>
            <div className="stack stack-md">
              <div className="field"><label className="label">Nouveau mot de passe</label><input className="input" type="password" placeholder="Min. 8 caractères" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <div className="field"><label className="label">Confirmer le mot de passe</label><input className="input" type="password" placeholder="Répéter le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} /></div>
              {error && <div className="error-msg">{error}</div>}
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "0.7rem" }}>{loading ? "Mise à jour…" : "Mettre à jour"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card">Chargement…</div></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
