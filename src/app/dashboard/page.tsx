"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Lang = "en" | "fr";
const T = {
  en: { title: "My Citations", saved: (n: number) => `${n} saved citation${n !== 1 ? "s" : ""}`, newBtn: "+ New Citation", all: "All", loading: "Loading…", emptyTitle: "No saved citations yet", emptySub: `Generate a citation and click "Generate & Save" to store it here.`, emptyBtn: "Generate a Citation", copy: "Copy", copied: "✓ Copied", del: "Delete", generator: "Generator", logout: "Log out" },
  fr: { title: "Mes citations", saved: (n: number) => `${n} citation${n !== 1 ? "s" : ""} sauvegardée${n !== 1 ? "s" : ""}`, newBtn: "+ Nouvelle citation", all: "Tout", loading: "Chargement…", emptyTitle: "Aucune citation sauvegardée", emptySub: `Générez une citation et cliquez sur "Générer et sauvegarder" pour la stocker ici.`, emptyBtn: "Générer une citation", copy: "Copier", copied: "✓ Copié", del: "Supprimer", generator: "Générateur", logout: "Se déconnecter" },
};

interface Citation { id: string; style: string; styleLabel: string; sourceType: string; formatted: string; createdAt: string; }
interface User { id: string; email: string; name: string; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [user, setUser] = useState<User | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const t = T[lang];

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (!d.user) { router.push("/login"); return; } setUser(d.user); });
    fetch("/api/citations").then(r => r.json()).then(d => { setCitations(d.citations || []); setLoading(false); });
  }, [router]);

  const handleDelete = async (id: string) => {
    await fetch("/api/citations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setCitations(prev => prev.filter(c => c.id !== id));
  };

  const handleCopy = (citation: Citation) => {
    navigator.clipboard.writeText(citation.formatted.replace(/<[^>]+>/g, ""));
    setCopiedId(citation.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); };

  const styles = ["all", ...Array.from(new Set(citations.map(c => c.style)))];
  const filtered = filter === "all" ? citations : citations.filter(c => c.style === filter);

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">Cite<span style={{ color: "var(--accent)" }}>.</span></a>
        <div className="nav-links">
          <Link href="/" className="nav-link">{t.generator}</Link>
          <Link href="/bibliography" className="nav-link">{lang === "fr" ? "Bibliographie" : "Bibliography"}</Link>
          {user && <span className="nav-link" style={{ color: "var(--ink-faint)" }}>{user.name}</span>}
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>{t.logout}</button>
          <div style={{ display: "flex", border: "1px solid var(--rule)", borderRadius: "6px", overflow: "hidden", marginLeft: "0.5rem" }}>
            <button onClick={() => setLang("en")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", cursor: "pointer", background: lang === "en" ? "var(--accent)" : "white", color: lang === "en" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>EN</button>
            <button onClick={() => setLang("fr")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", borderLeft: "1px solid var(--rule)", cursor: "pointer", background: lang === "fr" ? "var(--accent)" : "white", color: lang === "fr" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>FR</button>
          </div>
        </div>
      </nav>

      <main className="page-wide">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "2rem", letterSpacing: "-0.02em" }}>{t.title}</h1>
            <p style={{ color: "var(--ink-light)", fontSize: "0.9rem", marginTop: "0.25rem" }}>{t.saved(citations.length)}</p>
          </div>
          <Link href="/" className="btn btn-primary">{t.newBtn}</Link>
        </div>

        {citations.length > 0 && (
          <div className="row" style={{ marginBottom: "1.5rem", gap: "0.5rem", flexWrap: "wrap" }}>
            {styles.map(s => (
              <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(s)}>
                {s === "all" ? t.all : s.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {loading && <p style={{ color: "var(--ink-light)" }}>{t.loading}</p>}

        {!loading && citations.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📚</div>
            <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>{t.emptyTitle}</p>
            <p style={{ fontSize: "0.9rem" }}>{t.emptySub}</p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: "1.25rem" }}>{t.emptyBtn}</Link>
          </div>
        )}

        <div className="stack stack-sm">
          {filtered.map(citation => (
            <div key={citation.id} className="history-item">
              <div className="history-meta">
                <span className="badge">{citation.styleLabel}</span>
                <span className="badge badge-gray">{citation.sourceType}</span>
                <span className="history-date">{formatDate(citation.createdAt)}</span>
              </div>
              <div className="citation-box" dangerouslySetInnerHTML={{ __html: citation.formatted }} />
              <div className="row mt-2">
                <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(citation)}>
                  {copiedId === citation.id ? t.copied : t.copy}
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(citation.id)}>{t.del}</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
