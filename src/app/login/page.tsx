"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Lang = "en" | "fr";
const T = {
  en: { title: "Welcome back", sub: "Log in to access your saved citations", email: "Email", password: "Password", btn: "Log in", loading: "Logging in…", forgot: "Forgot password?", noAccount: "No account?", signup: "Sign up", verified: "Email verified! You can now log in.", unverified: "Please verify your email before logging in. Check your inbox." },
  fr: { title: "Bon retour", sub: "Connectez-vous pour accéder à vos citations", email: "Courriel", password: "Mot de passe", btn: "Se connecter", loading: "Connexion…", forgot: "Mot de passe oublié ?", noAccount: "Pas de compte ?", signup: "S'inscrire", verified: "Courriel vérifié ! Vous pouvez maintenant vous connecter.", unverified: "Veuillez vérifier votre courriel avant de vous connecter." },
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = T[lang];
  const justVerified = params.get("verified") === "1";

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) setError(data.unverified ? t.unverified : data.error);
      else { router.push("/"); router.refresh(); }
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap" style={{ background: "var(--surface)" }}>
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <a href="/" className="nav-logo">Cite<span style={{ color: "var(--accent)" }}>.</span></a>
          <div style={{ display: "flex", border: "1px solid var(--rule)", borderRadius: "6px", overflow: "hidden" }}>
            <button onClick={() => setLang("en")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", cursor: "pointer", background: lang === "en" ? "var(--accent)" : "white", color: lang === "en" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>EN</button>
            <button onClick={() => setLang("fr")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", borderLeft: "1px solid var(--rule)", cursor: "pointer", background: lang === "fr" ? "var(--accent)" : "white", color: lang === "fr" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>FR</button>
          </div>
        </div>
        <h1 className="auth-title">{t.title}</h1>
        <p className="auth-sub">{t.sub}</p>
        {justVerified && <div className="success-msg" style={{ marginBottom: "1rem" }}>{t.verified}</div>}
        <div className="stack stack-md">
          <div className="field">
            <label className="label">{t.email}</label>
            <input className="input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label">{t.password}</label>
              <Link href="/forgot-password" style={{ fontSize: "0.8rem", color: "var(--accent)" }}>{t.forgot}</Link>
            </div>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "0.7rem" }}>
            {loading ? t.loading : t.btn}
          </button>
          <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--ink-light)" }}>
            {t.noAccount} <Link href="/register" style={{ color: "var(--accent)", fontWeight: 500 }}>{t.signup}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card">Chargement…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
