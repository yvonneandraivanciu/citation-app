"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Lang = "en" | "fr";
const T = {
  en: {
    title: "Create an account", sub: "Save and manage your citations across sessions",
    name: "Name", email: "Email", password: "Password", passwordHint: "Min. 8 characters",
    btn: "Sign up", loading: "Creating account…", hasAccount: "Already have an account?", login: "Log in",
    successTitle: "Check your inbox!", successMsg: (email: string) => `We sent a 6-digit code to ${email}.`,
    successSub: "Enter it below to verify your account. Check spam if you don't see it.",
    codePlaceholder: "Enter 6-digit code", verifyBtn: "Verify & continue", verifying: "Verifying…", verified: "Verified! Redirecting…",
    errorMissing: "Verification link is invalid.", errorInvalid: "Verification link is invalid or already used.", errorExpired: "Verification link has expired.",
  },
  fr: {
    title: "Créer un compte", sub: "Sauvegardez et gérez vos citations entre les sessions",
    name: "Nom", email: "Courriel", password: "Mot de passe", passwordHint: "Min. 8 caractères",
    btn: "S'inscrire", loading: "Création du compte…", hasAccount: "Déjà un compte ?", login: "Se connecter",
    successTitle: "Vérifiez votre boîte de réception !", successMsg: (email: string) => `Nous avons envoyé un code à 6 chiffres à ${email}.`,
    successSub: "Entrez-le ci-dessous pour vérifier votre compte. Vérifiez les spams si vous ne le voyez pas.",
    codePlaceholder: "Entrez le code à 6 chiffres", verifyBtn: "Vérifier et continuer", verifying: "Vérification…", verified: "Vérifié ! Redirection…",
    errorMissing: "Lien de vérification invalide.", errorInvalid: "Lien de vérification invalide ou déjà utilisé.", errorExpired: "Lien expiré.",
  },
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const t = T[lang];

  const handleSignup = async () => {
    setError("");
    if (password.length < 8) { setError(lang === "fr" ? "Le mot de passe doit contenir au moins 8 caractères." : "Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, password }) });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setStep("code");
    } catch { setError(lang === "fr" ? "Une erreur est survenue." : "Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setCodeError(""); setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const data = await res.json();
      if (data.error) setCodeError(data.error);
      else { setStep("done"); setTimeout(() => { window.location.href = "/"; }, 1000); }
    } catch { setCodeError(lang === "fr" ? "Une erreur est survenue." : "Something went wrong."); }
    finally { setVerifying(false); }
  };

  const LangToggle = () => (
    <div style={{ display: "flex", border: "1px solid var(--rule)", borderRadius: "6px", overflow: "hidden" }}>
      <button onClick={() => setLang("en")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", cursor: "pointer", background: lang === "en" ? "var(--accent)" : "white", color: lang === "en" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>EN</button>
      <button onClick={() => setLang("fr")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", borderLeft: "1px solid var(--rule)", cursor: "pointer", background: lang === "fr" ? "var(--accent)" : "white", color: lang === "fr" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>FR</button>
    </div>
  );

  return (
    <div className="auth-wrap" style={{ background: "var(--surface)" }}>
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <a href="/" className="nav-logo">Cite<span style={{ color: "var(--accent)" }}>.</span></a>
          <LangToggle />
        </div>

        {step === "form" && (
          <>
            <h1 className="auth-title">{t.title}</h1>
            <p className="auth-sub">{t.sub}</p>
            <div className="stack stack-md">
              <div className="field"><label className="label">{t.name}</label><input className="input" type="text" placeholder={t.name} value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="field"><label className="label">{t.email}</label><input className="input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="field"><label className="label">{t.password}</label><input className="input" type="password" placeholder={t.passwordHint} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()} /></div>
              {error && <div className="error-msg">{error}</div>}
              <button className="btn btn-primary" onClick={handleSignup} disabled={loading} style={{ width: "100%", padding: "0.7rem" }}>{loading ? t.loading : t.btn}</button>
              <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--ink-light)" }}>{t.hasAccount} <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>{t.login}</Link></p>
            </div>
          </>
        )}

        {step === "code" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📬</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>{t.successTitle}</h2>
            <p style={{ color: "var(--ink-light)", marginBottom: "0.25rem" }}>{t.successMsg(email)}</p>
            <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>{t.successSub}</p>
            <div className="field" style={{ textAlign: "left", marginBottom: "1rem" }}>
              <input className="input" type="text" inputMode="numeric" maxLength={6} placeholder={t.codePlaceholder} value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setCodeError(""); }}
                onKeyDown={e => e.key === "Enter" && code.length === 6 && handleVerify()}
                style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.4rem", fontFamily: "var(--mono)", padding: "0.75rem" }} autoFocus />
            </div>
            {codeError && <div className="error-msg" style={{ marginBottom: "1rem" }}>{codeError}</div>}
            <button className="btn btn-primary" onClick={handleVerify} disabled={verifying || code.length !== 6} style={{ width: "100%", padding: "0.7rem" }}>
              {verifying ? t.verifying : t.verifyBtn}
            </button>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem" }}>{t.verified}</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card">Chargement…</div></div>}>
      <RegisterForm />
    </Suspense>
  );
}
