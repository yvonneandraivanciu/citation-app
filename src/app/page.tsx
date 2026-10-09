"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { STYLE_LABELS, StyleKey, SOURCE_TYPE_LABELS } from "@/lib/formatters";

type SourceType = "book" | "article" | "website" | "chapter";
type Lang = "en" | "fr";

// =============================================================================
// TRANSLATIONS
// =============================================================================
const T = {
  en: {
    tagline: "Citations, done right.",
    sub: "Paste a URL to auto-fill, or enter details manually.",
    style: "Citation Style", sourceType: "Source Type",
    autofillLabel: "Auto-fill from URL",
    autofillSub: "— paste a link to fetch title, author & date automatically",
    autofillPlaceholder: "https://example.com/article",
    autofillBtn: "Auto-fill", fetching: "Fetching…",
    generate: "Generate Citation", generateSave: "Generate & Save to Bibliography",
    generating: "Generating…",
    signupPrompt: "Sign up", signupSuffix: " to save to bibliography",
    result: "Generated Citation",
    copy: "Copy", copied: "✓ Copied",
    copyAll: "Copy Full Bibliography", copiedAll: "✓ Bibliography Copied!",
    saved: "Added to bibliography below.", missingFields: "Missing required fields:",
    error: "Something went wrong. Please try again.",
    myCitations: "My Citations", logout: "Log out", login: "Log in", signup: "Sign up",
    bibTitle: "Bibliography",
    bibSub: "Citations ordered per the Guide des références juridiques",
    bibEmpty: "Generate citations above and click \"Generate & Save to Bibliography\" to build your bibliography here.",
    deleteBtn: "Remove",
    noAuthorHint: "No author? Leave blank — the citation will start with the title.",
    noAuthorHintFr: "",
  },
  fr: {
    tagline: "Des citations, bien faites.",
    sub: "Collez une URL pour remplir automatiquement, ou entrez les détails manuellement.",
    style: "Style de citation", sourceType: "Type de source",
    autofillLabel: "Remplissage automatique par URL",
    autofillSub: "— collez un lien pour extraire le titre, l'auteur et la date",
    autofillPlaceholder: "https://exemple.com/article",
    autofillBtn: "Remplir", fetching: "Chargement…",
    generate: "Générer la citation", generateSave: "Générer et ajouter à la bibliographie",
    generating: "Génération…",
    signupPrompt: "Créez un compte", signupSuffix: " pour sauvegarder",
    result: "Citation générée",
    copy: "Copier", copied: "✓ Copié",
    copyAll: "Copier toute la bibliographie", copiedAll: "✓ Bibliographie copiée !",
    saved: "Ajouté à la bibliographie ci-dessous.", missingFields: "Champs requis manquants :",
    error: "Une erreur est survenue. Veuillez réessayer.",
    myCitations: "Mes citations", logout: "Se déconnecter", login: "Se connecter", signup: "S'inscrire",
    bibTitle: "Bibliographie",
    bibSub: "Citations ordonnées selon les règles du Guide des références juridiques",
    bibEmpty: "Générez des citations ci-dessus et cliquez sur « Générer et ajouter » pour construire votre bibliographie ici.",
    deleteBtn: "Supprimer",
    noAuthorHint: "",
    noAuthorHintFr: "Aucun auteur ? Laissez vide — la citation commencera par le titre.",
  },
};

// =============================================================================
// STANDARD FORM FIELDS
// =============================================================================
const FIELDS_EN: Record<SourceType, { key: string; label: string; required?: boolean; span?: boolean }[]> = {
  book: [
    { key: "author", label: "Author(s)" },
    { key: "year", label: "Year", required: true },
    { key: "title", label: "Title", required: true, span: true },
    { key: "edition", label: "Edition (e.g. 3rd)" },
    { key: "publisher", label: "Publisher" },
    { key: "publisherCity", label: "City of Publication" },
    { key: "pages", label: "Pages (e.g. 45–67)" },
  ],
  article: [
    { key: "author", label: "Author(s)" },
    { key: "year", label: "Year", required: true },
    { key: "title", label: "Article Title", required: true, span: true },
    { key: "journalName", label: "Journal Name", span: true },
    { key: "volume", label: "Volume" },
    { key: "issue", label: "Issue" },
    { key: "pages", label: "Pages (e.g. 123–145)" },
    { key: "doi", label: "DOI", span: true },
  ],
  website: [
    { key: "author", label: "Author(s)" },
    { key: "year", label: "Year Published" },
    { key: "title", label: "Page Title", required: true, span: true },
    { key: "publisher", label: "Website / Organization" },
    { key: "url", label: "URL", span: true },
    { key: "accessDate", label: "Date Accessed (e.g. June 18, 2026)", span: true },
  ],
  chapter: [
    { key: "author", label: "Chapter Author(s)" },
    { key: "year", label: "Year", required: true },
    { key: "title", label: "Chapter Title", required: true, span: true },
    { key: "bookTitle", label: "Book Title", span: true },
    { key: "editors", label: "Editor(s)" },
    { key: "publisher", label: "Publisher" },
    { key: "publisherCity", label: "City of Publication" },
    { key: "pages", label: "Pages" },
  ],
};

const FIELDS_FR: Record<SourceType, { key: string; label: string; required?: boolean; span?: boolean }[]> = {
  book: [
    { key: "author", label: "Auteur(s)" },
    { key: "year", label: "Année", required: true },
    { key: "title", label: "Titre", required: true, span: true },
    { key: "edition", label: "Édition (ex. 3e)" },
    { key: "publisher", label: "Éditeur" },
    { key: "publisherCity", label: "Ville de publication" },
    { key: "pages", label: "Pages (ex. 45–67)" },
  ],
  article: [
    { key: "author", label: "Auteur(s)" },
    { key: "year", label: "Année", required: true },
    { key: "title", label: "Titre de l'article", required: true, span: true },
    { key: "journalName", label: "Nom de la revue", span: true },
    { key: "volume", label: "Volume" },
    { key: "issue", label: "Numéro" },
    { key: "pages", label: "Pages (ex. 123–145)" },
    { key: "doi", label: "DOI", span: true },
  ],
  website: [
    { key: "author", label: "Auteur(s)" },
    { key: "year", label: "Année de publication" },
    { key: "title", label: "Titre de la page", required: true, span: true },
    { key: "publisher", label: "Site web / Organisation" },
    { key: "url", label: "URL", span: true },
    { key: "accessDate", label: "Date de consultation (ex. 18 juin 2026)", span: true },
  ],
  chapter: [
    { key: "author", label: "Auteur(s) du chapitre" },
    { key: "year", label: "Année", required: true },
    { key: "title", label: "Titre du chapitre", required: true, span: true },
    { key: "bookTitle", label: "Titre du livre", span: true },
    { key: "editors", label: "Directeur(s)" },
    { key: "publisher", label: "Éditeur" },
    { key: "publisherCity", label: "Ville de publication" },
    { key: "pages", label: "Pages" },
  ],
};

const SOURCE_LABELS_FR = { book: "Livre", article: "Article de revue", website: "Site web", chapter: "Chapitre de livre" };

// =============================================================================
// QC FORM FIELDS
// =============================================================================
const QC_FAMILIES = [
  { key: "doctrine",       label: { en: "Doctrine",    fr: "Doctrine" } },
  { key: "jurisprudence",  label: { en: "Case Law",    fr: "Jurisprudence" } },
  { key: "legislation",    label: { en: "Legislation", fr: "Législation" } },
  { key: "reglementation", label: { en: "Regulations", fr: "Réglementation" } },
];

const QC_SUBTYPES: Record<string, { key: string; label: { en: string; fr: string } }[]> = {
  doctrine: [
    { key: "monograph",      label: { en: "Book / Monograph",          fr: "Monographie / Ouvrage" } },
    { key: "periodical",     label: { en: "Journal Article",            fr: "Article de revue" } },
    { key: "chapter",        label: { en: "Chapter in Collective Work", fr: "Étude dans ouvrage collectif" } },
    { key: "thesis",         label: { en: "Thesis / Memoir",            fr: "Thèse / mémoire" } },
    { key: "blog",           label: { en: "Blog / Newspaper",           fr: "Blogue / journal" } },
    { key: "barreau",        label: { en: "Congrès du Barreau",         fr: "Congrès du Barreau du Québec" } },
    { key: "developpements", label: { en: "Développements récents",     fr: "Développements récents" } },
    { key: "collection-de-droit", label: { en: "Collection de droit / Formation professionnelle", fr: "Collection de droit / Formation professionnelle" } },
    { key: "repertoire-de-droit", label: { en: "Répertoire de droit (R.D. / R.D./N.S.)",       fr: "Répertoire de droit (R.D. / R.D./N.S.)" } },
    { key: "annotated-code",      label: { en: "Annotated Code / Statute",                     fr: "Loi ou code annoté" } },
    { key: "dictionary-entry",    label: { en: "Dictionary / Encyclopedia Entry",               fr: "Dictionnaire / encyclopédie" } },
  ],
  jurisprudence: [
    { key: "neutral",              label: { en: "Neutral Citation",             fr: "Référence neutre" } },
    { key: "reported",             label: { en: "Reported Case",                fr: "Décision publiée" } },
    { key: "database-case",        label: { en: "Database Case (AZ, EYB…)",     fr: "Décision sur base de données" } },
    { key: "canlii",               label: { en: "CanLII",                        fr: "CanLII" } },
    { key: "unpublished-judicial", label: { en: "Unpublished Judicial Decision", fr: "Décision judiciaire inédite" } },
    { key: "admin-decision",       label: { en: "Administrative Decision",       fr: "Décision administrative" } },
    { key: "soquij-az",   label: { en: "SOQUIJ / AZ",        fr: "SOQUIJ / AZ" } },
    { key: "eyb-rejb",    label: { en: "EYB / REJB",          fr: "EYB / REJB" } },
    { key: "quicklaw",    label: { en: "Quicklaw (LAd/QL)",    fr: "Quicklaw (LAd/QL)" } },
    { key: "westlaw",     label: { en: "WestlawNext Canada",   fr: "WestlawNext Canada" } },
    { key: "special-bulletin",   label: { en: "Special Bulletin (AMF, BDR…)", fr: "Bulletin spécial (AMF, BDR…)" } },
    { key: "conseil-magistrature", label: { en: "Conseil de la magistrature du Québec", fr: "Conseil de la magistrature du Québec" } },
  ],
  legislation: [
    { key: "consolidated-statute", label: { en: "Consolidated Statute (RLRQ / L.R.C.)", fr: "Loi consolidée (RLRQ / L.R.C.)" } },
    { key: "annual-statute",       label: { en: "Annual Statute (L.Q. / L.C.)",          fr: "Loi annuelle (L.Q. / L.C.)" } },
    { key: "bill",                 label: { en: "Bill",                                   fr: "Projet de loi" } },
    { key: "parliamentary-debate", label: { en: "Parliamentary Debate",                   fr: "Débats parlementaires" } },
  ],
  reglementation: [
    { key: "federal-codified-reg", label: { en: "Federal Codified Reg. (C.R.C.)", fr: "Règlement fédéral codifié (C.R.C.)" } },
    { key: "federal-gazette-reg",  label: { en: "Federal Gazette Reg. (DORS)",    fr: "Règlement fédéral — Gazette (DORS)" } },
    { key: "quebec-rlrq-reg",      label: { en: "Quebec RLRQ Regulation",         fr: "Règlement québécois (RLRQ)" } },
    { key: "quebec-gazette-reg",   label: { en: "Quebec Gazette Regulation",      fr: "Règlement — G.O." } },
    { key: "municipal-reg",        label: { en: "Municipal By-law",               fr: "Règlement municipal" } },
  ],
};

type QcField = { key: string; label: { en: string; fr: string }; required?: boolean; span?: boolean; type?: string; options?: { value: string; label: string }[] };

const QC_FIELDS: Record<string, QcField[]> = {
  monograph: [
    { key: "author", label: { en: "Author(s) — separate with ;", fr: "Auteur(s) — séparer par ;" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "title", label: { en: "Title", fr: "Titre" }, required: true, span: true },
    { key: "subtitle", label: { en: "Subtitle", fr: "Sous-titre" }, span: true },
    { key: "edition", label: { en: "Edition (e.g. 2e éd.)", fr: "Édition (ex. 2e éd.)" } },
    { key: "collaborators", label: { en: "With the collab. of — separate with ;", fr: "Avec la collab. de — séparer par ;" } },
    { key: "tomeNumber", label: { en: "Tome no.", fr: "N° du tome" } },
    { key: "tomeTitle", label: { en: "Tome Title (if any)", fr: "Titre du tome (le cas échéant)" } },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "collection", label: { en: "Collection", fr: "Collection" } },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "publisher", label: { en: "Publisher", fr: "Éditeur" } },
    { key: "pages", label: { en: "Pages cited", fr: "Pages citées" } },
    { key: "paragraphNumbers", label: { en: "Paragraph numbers", fr: "Numéros de paragraphes" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
    { key: "database", label: { en: "Database (e.g. La référence, LAd/QL)", fr: "Base de données (ex. La référence, LAd/QL)" } },
    { key: "documentId", label: { en: "Document ID (e.g. EYB2002DPP6)", fr: "Identifiant du document (ex. EYB2002DPP6)" } },
  ],
  periodical: [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "title", label: { en: "Article Title", fr: "Titre de l'article" }, required: true, span: true },
    { key: "journalName", label: { en: "Journal Abbreviation", fr: "Abréviation de la revue" } },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "firstPage", label: { en: "First Page of Article", fr: "Première page de l'article" } },
    { key: "pages", label: { en: "Specific Pages Cited", fr: "Pages spécifiques citées" } },
    { key: "paragraphNumbers", label: { en: "Paragraph number", fr: "Numéro de paragraphe" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
    { key: "database", label: { en: "Database (e.g. La référence, LAd/QL)", fr: "Base de données (ex. La référence, LAd/QL)" } },
    { key: "documentId", label: { en: "Document ID / PDF page ID", fr: "Identifiant du document / page PDF" } },
  ],
  chapter: [
    { key: "author", label: { en: "Chapter Author(s)", fr: "Auteur(s) du chapitre" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "title", label: { en: "Chapter Title", fr: "Titre du chapitre" }, required: true, span: true },
    { key: "bookTitle", label: { en: "Book Title", fr: "Titre de l'ouvrage collectif" }, span: true },
    { key: "editors", label: { en: "Director(s) — separate with ;", fr: "Directeur(s) — séparer par ;" } },
    { key: "tomeNumber", label: { en: "Tome no. (of the collective work)", fr: "N° du tome (de l'ouvrage collectif)" } },
    { key: "tomeTitle", label: { en: "Tome Title (if any)", fr: "Titre du tome (le cas échéant)" } },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "publisher", label: { en: "Publisher", fr: "Éditeur" } },
    { key: "firstPage", label: { en: "First Page of Chapter", fr: "Première page du chapitre" } },
    { key: "pages", label: { en: "Specific Pages Cited", fr: "Pages spécifiques citées" } },
  ],
  thesis: [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" }, required: true },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "title", label: { en: "Title", fr: "Titre" }, required: true, span: true },
    { key: "degreeType", label: { en: "Degree Type", fr: "Type de diplôme" }, type: "select", options: [{ value: "doctorat", label: "Thèse de doctorat" }, { value: "maitrise", label: "Mémoire de maîtrise" }] },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "faculty", label: { en: "Faculty", fr: "Faculté" } },
    { key: "publisher", label: { en: "University", fr: "Université" } },
    { key: "pages", label: { en: "Pages", fr: "Pages" } },
  ],
  blog: [
    { key: "author", label: { en: "Author", fr: "Auteur" } },
    { key: "title", label: { en: "Article Title", fr: "Titre de l'article" }, required: true, span: true },
    { key: "journalName", label: { en: "Publication Name", fr: "Nom du journal / blogue" } },
    { key: "accessDate", label: { en: "Publication Date (e.g. 13 juillet 2017)", fr: "Date de publication (ex. 13 juillet 2017)" } },
    { key: "specialSection", label: { en: "Special Section (e.g. Cahier thématique I)", fr: "Cahier spécial (ex. Cahier thématique I)" } },
    { key: "pages", label: { en: "Page", fr: "Page" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
  ],
  barreau: [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "year", label: { en: "Year of Congress", fr: "Année du congrès" } },
    { key: "title", label: { en: "Study Title", fr: "Titre de l'étude" }, required: true, span: true },
    { key: "publisherCity", label: { en: "City (pre-2007)", fr: "Ville (avant 2007)" } },
    { key: "publisher", label: { en: "Publisher (pre-2007)", fr: "Éditeur (avant 2007)" } },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Page Cited", fr: "Page citée" } },
    { key: "url", label: { en: "URL (post-2007)", fr: "URL (après 2007)" }, span: true },
  ],
  developpements: [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "title", label: { en: "Study Title", fr: "Titre de l'étude" }, required: true, span: true },
    { key: "bookTitle", label: { en: "Collection Title", fr: "Titre de la collection" }, span: true },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "year", label: { en: "Collection Year", fr: "Année de la collection" } },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "publisher", label: { en: "Publisher", fr: "Éditeur" } },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Page Cited", fr: "Page citée" } },
  ],
  "collection-de-droit": [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "title", label: { en: "Study Title", fr: "Titre de l'étude" }, required: true, span: true },
    { key: "academicYear", label: { en: "Academic Year (e.g. 1994-1995)", fr: "Année universitaire (ex. 1994-1995)" }, required: true },
    { key: "seriesName", label: { en: "Series", fr: "Série" }, type: "select", options: [
      { value: "Collection de droit", label: "Collection de droit (1989–)" },
      { value: "Collection des habiletés", label: "Collection des habiletés" },
      { value: "Formation professionnelle", label: "Formation professionnelle (1978–1989)" },
      { value: "C.F.P.B.Q.", label: "C.F.P.B.Q. (forme abrégée)" },
    ] },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "bookTitle", label: { en: "Volume Title", fr: "Titre du volume" }, span: true },
    { key: "publisherCity", label: { en: "City (auto-filled by year if blank)", fr: "Ville (auto-rempli selon l'année si vide)" } },
    { key: "publisher", label: { en: "Publisher (auto-filled by year if blank)", fr: "Éditeur (auto-rempli selon l'année si vide)" } },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Page Cited", fr: "Page citée" } },
    { key: "documentId", label: { en: "Document ID", fr: "Identifiant du document" } },
    { key: "pdfPage", label: { en: "PDF Page (if no paragraph no.)", fr: "Page PDF (si pas de n° de paragraphe)" } },
    { key: "database", label: { en: "Database (e.g. La référence)", fr: "Base de données (ex. La référence)" } },
  ],
  "repertoire-de-droit": [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "title", label: { en: "Study Title", fr: "Titre de l'étude" }, required: true, span: true },
    { key: "theme", label: { en: "Theme (e.g. Titres immobiliers)", fr: "Thème (ex. Titres immobiliers)" }, span: true },
    { key: "documentNumber", label: { en: "Document No. (e.g. 6g)", fr: "N° de document (ex. 6g)" } },
    { key: "series", label: { en: "Series", fr: "Série" }, type: "select", options: [
      { value: "R.D./N.S.", label: "R.D./N.S. (Nouvelle série, depuis 1993 — abrégé)" },
      { value: "Répertoire de droit/Nouvelle série", label: "Répertoire de droit/Nouvelle série (depuis 1993)" },
      { value: "R.D.", label: "R.D. (jusqu'en 1993 — abrégé)" },
      { value: "Répertoire de droit", label: "Répertoire de droit (jusqu'en 1993)" },
    ] },
    { key: "publisherCity", label: { en: "City (default: Montréal)", fr: "Ville (défaut : Montréal)" } },
    { key: "year", label: { en: "Year (last update)", fr: "Année (dernière mise à jour)" }, required: true },
    { key: "paragraphNumbers", label: { en: "Paragraph Number", fr: "Numéro de paragraphe" } },
    { key: "pages", label: { en: "Page", fr: "Page" } },
  ],
  "annotated-code": [
    { key: "author", label: { en: "Author(s)", fr: "Auteur(s)" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "title", label: { en: "Title (e.g. Code civil du Québec annoté)", fr: "Titre (ex. Code civil du Québec annoté)" }, required: true, span: true },
    { key: "edition", label: { en: "Edition (e.g. 9e éd.)", fr: "Édition (ex. 9e éd.)" } },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "collection", label: { en: "Collection", fr: "Collection" } },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "publisher", label: { en: "Publisher", fr: "Éditeur" } },
    { key: "articleNumber", label: { en: "Article No. (e.g. 2726)", fr: "Article n° (ex. 2726)" } },
    { key: "paragraphNumbers", label: { en: "Paragraph Number(s)", fr: "Numéro(s) de paragraphe" } },
    { key: "pages", label: { en: "Pages", fr: "Pages" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
    { key: "database", label: { en: "Database (e.g. JuriBistro eDOCTRINE)", fr: "Base de données (ex. JuriBistro eDOCTRINE)" } },
    { key: "documentId", label: { en: "Document ID", fr: "Identifiant du document" } },
  ],
  "dictionary-entry": [
    { key: "author", label: { en: "Author(s) / Director(s)", fr: "Auteur(s) / Directeur(s)" } },
    { key: "isDirector", label: { en: "Author(s) are director(s)", fr: "Le(s) auteur(s) est/sont directeur(s)" }, type: "select", options: [
      { value: "no", label: "Non" },
      { value: "yes", label: "Oui — (dir.)" },
    ] },
    { key: "title", label: { en: "Dictionary / Encyclopedia Title", fr: "Titre du dictionnaire / de l'encyclopédie" }, required: true, span: true },
    { key: "edition", label: { en: "Edition (e.g. 11e éd. mise à jour)", fr: "Édition (ex. 11e éd. mise à jour)" } },
    { key: "publisherCity", label: { en: "City", fr: "Ville" } },
    { key: "publisher", label: { en: "Publisher", fr: "Éditeur" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "entry", label: { en: "Headword / Entry (e.g. Intimation)", fr: "Expression recherchée (ex. Intimation)" }, required: true, span: true },
    { key: "pages", label: { en: "Page", fr: "Page" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
    { key: "database", label: { en: "Database (e.g. JuriBistro eDICTIONNAIRE)", fr: "Base de données (ex. JuriBistro eDICTIONNAIRE)" } },
  ],
  neutral: [
        { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant — e.g. \"Droit de la famille \u2014 08162\")", fr: "Th\u00e8me (remplace Demandeur/D\u00e9fendeur \u2014 ex. \u00ab\u00a0Droit de la famille \u2014 08162\u00a0\u00bb)" }, span: true },
    { key: "plaintiff", label: { en: "Plaintiff", fr: "Demandeur" } },
    { key: "defendant", label: { en: "Defendant", fr: "Défendeur" } },
    { key: "connector", label: { en: "Connector", fr: "Connecteur" }, type: "select", options: [{ value: "c.", label: "c. (français)" }, { value: "v.", label: "v. (anglais)" }, { value: "et", label: "et (certaines décisions administratives)" }] },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "courtCode", label: { en: "Court Code (e.g. CSC, QCCA)", fr: "Code du tribunal (ex. CSC, QCCA)" } },
    { key: "sequenceNumber", label: { en: "Sequence Number", fr: "Numéro de séquence" } },
    { key: "paragraph", label: { en: "Paragraph", fr: "Paragraphe" } },
  ],
  reported: [
        { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant — e.g. \"Droit de la famille \u2014 08162\")", fr: "Th\u00e8me (remplace Demandeur/D\u00e9fendeur \u2014 ex. \u00ab\u00a0Droit de la famille \u2014 08162\u00a0\u00bb)" }, span: true },
    { key: "plaintiff", label: { en: "Plaintiff", fr: "Demandeur" } },
    { key: "defendant", label: { en: "Defendant", fr: "Défendeur" } },
    { key: "connector", label: { en: "Connector", fr: "Connecteur" }, type: "select", options: [{ value: "c.", label: "c. (français)" }, { value: "v.", label: "v. (anglais)" }, { value: "et", label: "et (certaines décisions administratives)" }] },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "yearBrackets", label: { en: "Year Brackets", fr: "Crochets" }, type: "select", options: [{ value: "[]", label: "[ ] — année identifie le volume" }, { value: "()", label: "( ) — année n'identifie pas" }] },
    { key: "yearPosition", label: { en: "Year Placement (only for round brackets)", fr: "Position de l'année (parenthèses seulement)" }, type: "select", options: [{ value: "", label: "Auto (selon le connecteur c./v.)" }, { value: "afterComma", label: "Après la virgule — civiliste : Villard c. Mercier, (1935)…" }, { value: "beforeComma", label: "Avant la virgule — common law : R. v. Talbourdet (1984), …" }] },
    { key: "decisionYear", label: { en: "Decision Year (only if >3 yrs before publication)", fr: "Année de la décision (si écart de plus de 3 ans)" } },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "reportAbbreviation", label: { en: "Reporter Abbreviation (e.g. RCS)", fr: "Abréviation du recueil (ex. RCS)" } },
    { key: "reportIsJournal", label: { en: "Reporter is a law review (guide p. 69, s. 2)", fr: "Le recueil est une revue de droit (guide p. 69, s. 2)" }, type: "select", options: [
      { value: "no", label: "Non" },
      { value: "yes", label: "Oui — abréviation en italiques" },
    ] },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Pages Cited", fr: "Pages citées" } },
    { key: "paragraphNumbers", label: { en: "Paragraphs Cited", fr: "Paragraphes cités" } },
    { key: "court", label: { en: "Court (if not in reporter)", fr: "Tribunal (si absent du recueil)" } },
    { key: "isSummary", label: { en: "Résumé reproduced in this reporter (guide p. 71)", fr: "Résumé reproduit dans ce recueil (guide p. 71)" }, type: "select", options: [
      { value: "no", label: "Non" },
      { value: "yes", label: "Oui — ajoute « (rés.) »" },
    ] },
    { key: "commentaryAuthor", label: { en: "Commentary Author (guide p. 70, s. 2)", fr: "Auteur du commentaire (guide p. 70, s. 2)" } },
    { key: "commentaryPage", label: { en: "Commentary Page", fr: "Page du commentaire" } },
  ],
  "database-case": [
        { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant — e.g. \"Droit de la famille \u2014 08162\")", fr: "Th\u00e8me (remplace Demandeur/D\u00e9fendeur \u2014 ex. \u00ab\u00a0Droit de la famille \u2014 08162\u00a0\u00bb)" }, span: true },
    { key: "plaintiff", label: { en: "Plaintiff", fr: "Demandeur" } },
    { key: "defendant", label: { en: "Defendant", fr: "Défendeur" } },
    { key: "year", label: { en: "Year (leave blank for a résumé collection — J.E., EXP, D.T.E.…)", fr: "Année (laisser vide pour un recueil de résumés — J.E., EXP, D.T.E.…)" } },
    { key: "yearBrackets", label: { en: "Year Brackets", fr: "Crochets" }, type: "select", options: [{ value: "[]", label: "[ ]" }, { value: "()", label: "( )" }, { value: "none", label: "Aucun — ex. EXP : « 2014 EXP-1495 »" }] },
    { key: "reportAbbreviation", label: { en: "Database/Résumé Abbreviation (e.g. AZ, J.E.)", fr: "Abréviation de la base ou du recueil (ex. AZ, J.E.)" } },
    { key: "sequenceNumber", label: { en: "Document Number", fr: "Numéro de document" } },
    { key: "paragraph", label: { en: "Paragraph", fr: "Paragraphe" } },
    { key: "court", label: { en: "Court", fr: "Tribunal" } },
  ],
  canlii: [
        { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant — e.g. \"Droit de la famille \u2014 08162\")", fr: "Th\u00e8me (remplace Demandeur/D\u00e9fendeur \u2014 ex. \u00ab\u00a0Droit de la famille \u2014 08162\u00a0\u00bb)" }, span: true },
    { key: "plaintiff", label: { en: "Plaintiff", fr: "Demandeur" } },
    { key: "defendant", label: { en: "Defendant", fr: "Défendeur" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "sequenceNumber", label: { en: "CanLII Sequence Number", fr: "Numéro CanLII" } },
    { key: "paragraph", label: { en: "Paragraph", fr: "Paragraphe" } },
    { key: "court", label: { en: "Jurisdiction (e.g. QC C.A.)", fr: "Juridiction (ex. QC C.A.)" } },
  ],
  "unpublished-judicial": [
        { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant — e.g. \"Droit de la famille \u2014 08162\")", fr: "Th\u00e8me (remplace Demandeur/D\u00e9fendeur \u2014 ex. \u00ab\u00a0Droit de la famille \u2014 08162\u00a0\u00bb)" }, span: true },
    { key: "plaintiff", label: { en: "Plaintiff", fr: "Demandeur" } },
    { key: "defendant", label: { en: "Defendant", fr: "Défendeur" } },
    { key: "courtCode", label: { en: "Court Initials (e.g. C.S.)", fr: "Initiales du tribunal (ex. C.S.)" } },
    { key: "court", label: { en: "District", fr: "District" } },
    { key: "sequenceNumber", label: { en: "Docket Number", fr: "Numéro de dossier" } },
    { key: "accessDate", label: { en: "Date", fr: "Date" } },
    { key: "judgeName", label: { en: "Judge's Last Name(s) — separate several with a comma for \"jj.\"", fr: "Nom(s) de famille du/des juge(s) — séparer par une virgule pour « jj. »" } },
    { key: "paragraph", label: { en: "Paragraph", fr: "Paragraphe" } },
    { key: "pages", label: { en: "Page", fr: "Page" } },
  ],
  "admin-decision": [
    { key: "title", label: { en: "Caption / Subject", fr: "Intitulé / sujet" }, required: true, span: true },
    { key: "decisionNumber", label: { en: "Decision Number (e.g. D-2005-216, or \"de radiodiffusion CRTC 2007-1\")", fr: "Numéro de décision (ex. D-2005-216, ou « de radiodiffusion CRTC 2007-1 »)" } },
    { key: "sequenceNumber", label: { en: "Docket Number(s) — separate several with a comma", fr: "Numéro(s) de dossier — séparer plusieurs numéros par une virgule" } },
    { key: "showDocketNumeroPrefix", label: { en: "Show \"n°\"/\"nos\" before docket number(s)", fr: "Afficher « n° »/« nos » devant le(s) numéro(s) de dossier" }, type: "select", options: [
      { value: "yes", label: "Oui (par défaut)" },
      { value: "no", label: "Non — ex. « dossier R-3555-2004 »" },
    ] },
    { key: "accessDate", label: { en: "Date", fr: "Date" } },
    { key: "publisher", label: { en: "Organization", fr: "Organisme" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
  ],
  "special-bulletin": [
    { key: "title", label: { en: "Style of Cause / Caption", fr: "Intitulé de la cause" }, required: true, span: true },
    { key: "year", label: { en: "Year", fr: "Année" }, required: true },
    { key: "reportAbbreviation", label: { en: "Bulletin Abbreviation (e.g. Bull. AMF, B.C.V.M.Q.)", fr: "Abréviation du bulletin (ex. Bull. AMF, B.C.V.M.Q.)" }, required: true },
    { key: "volume", label: { en: "Volume", fr: "Volume" } },
    { key: "sequenceNumber", label: { en: "Issue Number", fr: "Numéro de fascicule" } },
    { key: "pages", label: { en: "Page", fr: "Page" } },
    { key: "publisher", label: { en: "Organization (e.g. BDRVM)", fr: "Organisme (ex. BDRVM)" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
  ],
  "conseil-magistrature": [
    { key: "title", label: { en: "Caption (\"Rapport d'examen\", or complainant + judge(s))", fr: "Intitulé (« Rapport d'examen », ou plaignant + juge(s))" }, required: true, span: true },
    { key: "year", label: { en: "Year", fr: "Année" }, required: true },
    { key: "courtCode", label: { en: "Code", fr: "Code" }, type: "select", options: [{ value: "QCCMAG", label: "QCCMAG" }, { value: "CMQC", label: "CMQC" }] },
    { key: "sequenceNumber", label: { en: "Sequence Number", fr: "Numéro de séquence" }, required: true },
    { key: "paragraph", label: { en: "Paragraph", fr: "Paragraphe" } },
    { key: "note", label: { en: "Note (e.g. \"rapport d'enquête\", or a date)", fr: "Précision (ex. « rapport d'enquête », ou une date)" } },
  ],
  "consolidated-statute": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "recueil", label: { en: "Compilation (e.g. RLRQ, L.R.C.)", fr: "Recueil (ex. RLRQ, L.R.C.)" } },
    { key: "year", label: { en: "Year (L.R.C. only)", fr: "Année (L.R.C. seulement)" } },
    { key: "chapter", label: { en: "Chapter (e.g. C-12)", fr: "Chapitre (ex. C-12)" } },
    { key: "pages", label: { en: "Articles (e.g. 3, 5)", fr: "Articles (ex. 3, 5)" } },
  ],
  "annual-statute": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "recueil", label: { en: "Compilation", fr: "Recueil" }, type: "select", options: [{ value: "L.Q.", label: "L.Q." }, { value: "L.C.", label: "L.C." }, { value: "S.Q.", label: "S.Q." }, { value: "S.C.", label: "S.C." }] },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "chapter", label: { en: "Chapter", fr: "Chapitre" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  bill: [
    { key: "title", label: { en: "Law Title", fr: "Titre de la loi" }, required: true, span: true },
    { key: "sequenceNumber", label: { en: "Bill Number", fr: "Numéro du projet de loi" } },
    { key: "volume", label: { en: "Session & Legislature (e.g. 2e session, 35e législature)", fr: "Session et législature (ex. 2e session, 35e législature)" }, span: true },
    { key: "court", label: { en: "Legislature", fr: "Législature" }, type: "select", options: [{ value: "Qc", label: "Québec" }, { value: "Can.", label: "Canada" }] },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  "parliamentary-debate": [
    { key: "chamber", label: { en: "Chamber", fr: "Chambre" }, type: "select", options: [
      { value: "QUÉBEC, ASSEMBLÉE NATIONALE", label: "Québec, Assemblée nationale" },
      { value: "QUÉBEC, ASSEMBLÉE LÉGISLATIVE", label: "Québec, Assemblée législative" },
      { value: "CANADA, SÉNAT", label: "Canada, Sénat" },
      { value: "CANADA, CHAMBRE DES COMMUNES", label: "Canada, Chambre des communes" },
    ]},
    { key: "title", label: { en: "Recueil Title (e.g. Journal des débats)", fr: "Titre du recueil (ex. Journal des débats)" }, required: true, span: true },
    { key: "volume", label: { en: "Session", fr: "Session" } },
    { key: "edition", label: { en: "Legislature", fr: "Législature" } },
    { key: "accessDate", label: { en: "Date", fr: "Date" } },
    { key: "pages", label: { en: "Page", fr: "Page" } },
    { key: "author", label: { en: "Speaker", fr: "Intervenant" } },
  ],
  "federal-codified-reg": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "chapter", label: { en: "Chapter Number (e.g. C-1010)", fr: "Numéro de chapitre (ex. C-1010)" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  "federal-gazette-reg": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "dorsNumber", label: { en: "DORS Number (e.g. DORS/2007-13)", fr: "Numéro DORS (ex. DORS/2007-13)" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "volume", label: { en: "Gazette Volume", fr: "Volume de la Gazette" } },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  "quebec-rlrq-reg": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "chapter", label: { en: "Enabling Statute Chapter (e.g. J-3)", fr: "Chapitre de la loi habilitante (ex. J-3)" } },
    { key: "regulationNumber", label: { en: "Regulation Number (e.g. r. 3)", fr: "Numéro du règlement (ex. r. 3)" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  "quebec-gazette-reg": [
    { key: "title", label: { en: "Official Title", fr: "Titre officiel" }, required: true, span: true },
    { key: "dorsNumber", label: { en: "Decree Number (e.g. D. 1241-2005)", fr: "Numéro du décret (ex. D. 1241-2005)" } },
    { key: "year", label: { en: "Year", fr: "Année" } },
    { key: "volume", label: { en: "Gazette Volume", fr: "Volume de la G.O." } },
    { key: "firstPage", label: { en: "First Page", fr: "Première page" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
  ],
  "municipal-reg": [
    { key: "title", label: { en: "By-law Title", fr: "Titre du règlement" }, required: true, span: true },
    { key: "publisher", label: { en: "Adopting Body", fr: "Organe adoptant" }, span: true },
    { key: "sequenceNumber", label: { en: "Regulation Number", fr: "Numéro du règlement" } },
    { key: "year", label: { en: "Date Adopted", fr: "Date d'adoption" } },
    { key: "pages", label: { en: "Articles", fr: "Articles" } },
    { key: "url", label: { en: "URL", fr: "URL" }, span: true },
  ],

  "soquij-az": [
  { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant)", fr: "Thème (remplace Demandeur/Défendeur)" }, span: true },
  { key: "plaintiff",  label: { en: "Plaintiff", fr: "Demandeur" } },
  { key: "defendant",  label: { en: "Defendant", fr: "Défendeur" } },
  { key: "year",       label: { en: "Year", fr: "Année" }, required: true },
  { key: "sequenceNumber", label: { en: "AZ Number (e.g. AZ-12345678)", fr: "Numéro AZ (ex. AZ-12345678)" }, required: true },
  { key: "paragraph",  label: { en: "Paragraph", fr: "Paragraphe" } },
  { key: "pages",      label: { en: "Page (PDF)", fr: "Page (PDF)" } },
  { key: "court",      label: { en: "Court", fr: "Tribunal" } },
],
"eyb-rejb": [
  { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant)", fr: "Thème (remplace Demandeur/Défendeur)" }, span: true },
  { key: "plaintiff",      label: { en: "Plaintiff", fr: "Demandeur" } },
  { key: "defendant",      label: { en: "Defendant", fr: "Défendeur" } },
  { key: "reportAbbreviation", label: { en: "Database (EYB or REJB)", fr: "Base (EYB ou REJB)" }, type: "select", options: [{ value: "EYB", label: "EYB" }, { value: "REJB", label: "REJB" }] },
  { key: "sequenceNumber", label: { en: "Document Number (e.g. 1999-11842)", fr: "Numéro (ex. 1999-11842)" }, required: true },
  { key: "paragraph",      label: { en: "Paragraph", fr: "Paragraphe" } },
  { key: "court",          label: { en: "Court", fr: "Tribunal" } },
],
quicklaw: [
  { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant)", fr: "Thème (remplace Demandeur/Défendeur)" }, span: true },
  { key: "plaintiff",  label: { en: "Plaintiff", fr: "Demandeur" } },
  { key: "defendant",  label: { en: "Defendant", fr: "Défendeur" } },
  { key: "connector", label: { en: "Connector", fr: "Connecteur" }, type: "select", options: [{ value: "c.", label: "c. (français)" }, { value: "v.", label: "v. (anglais)" }, { value: "et", label: "et (certaines décisions administratives)" }] },
  { key: "year",       label: { en: "Year", fr: "Année" }, required: true },
  { key: "courtIdentifier", label: { en: "Court/Database Identifier (e.g. O.J., A.J.)", fr: "Identifiant du tribunal/de la base (ex. O.J., A.J.)" }, required: true },
  { key: "sequenceNumber", label: { en: "Document Number", fr: "Numéro de document" }, required: true },
  { key: "paragraph",  label: { en: "Paragraph", fr: "Paragraphe" } },
  { key: "court",      label: { en: "Jurisdiction (if the database isn't jurisdiction-specific)", fr: "Juridiction (si la base n'est pas propre à une juridiction)" } },
  { key: "serviceLabel", label: { en: "Service Label", fr: "Étiquette du service" }, type: "select", options: [{ value: "LAd/QL", label: "LAd/QL" }, { value: "LN/QL", label: "LN/QL" }] },
],
westlaw: [
  { key: "theme", label: { en: "Theme (replaces Plaintiff/Defendant)", fr: "Thème (remplace Demandeur/Défendeur)" }, span: true },
  { key: "plaintiff",  label: { en: "Plaintiff", fr: "Demandeur" } },
  { key: "defendant",  label: { en: "Defendant", fr: "Défendeur" } },
  { key: "connector", label: { en: "Connector", fr: "Connecteur" }, type: "select", options: [{ value: "c.", label: "c. (français)" }, { value: "v.", label: "v. (anglais)" }, { value: "et", label: "et (certaines décisions administratives)" }] },
  { key: "year",       label: { en: "Year", fr: "Année" }, required: true },
  { key: "reportAbbreviation", label: { en: "Database Abbreviation (e.g. CarswellOnt)", fr: "Abréviation de la base (ex. CarswellOnt)" }, required: true },
  { key: "sequenceNumber", label: { en: "Document Number", fr: "Numéro de document" }, required: true },
  { key: "court",      label: { en: "Court", fr: "Tribunal" } },
],
};

// Jurisprudence subtypes that carry a style of cause and can be combined
// into a parallel citation (guide p. 58, s. H) — either as the primary
// reference or as one of the additional ones. Unpublished decisions are
// excluded: they aren't the kind of thing reported in parallel.
const PARALLEL_ELIGIBLE_TYPES = ["neutral", "reported", "database-case", "canlii", "soquij-az", "eyb-rejb", "quicklaw", "westlaw"];

const PARALLEL_TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  neutral: { en: "Neutral Citation", fr: "Référence neutre" },
  reported: { en: "Reported Case", fr: "Décision publiée" },
  "database-case": { en: "Database Case (AZ, EYB…)", fr: "Décision sur base de données" },
  canlii: { en: "CanLII", fr: "CanLII" },
  "soquij-az": { en: "SOQUIJ / AZ", fr: "SOQUIJ / AZ" },
  "eyb-rejb": { en: "EYB / REJB", fr: "EYB / REJB" },
  quicklaw: { en: "Quicklaw (LAd/QL)", fr: "Quicklaw (LAd/QL)" },
  westlaw: { en: "WestlawNext Canada", fr: "WestlawNext Canada" },
};

// Fields to hide on an "additional reference": the style of cause (party
// names, connector) is only given once, on the primary citation.
const PARALLEL_HIDDEN_FIELD_KEYS = ["plaintiff", "defendant", "connector", "theme"];

// =============================================================================
// BIBLIOGRAPHY ORDERING
// =============================================================================
interface SavedCitation {
  id: string;
  style: string;
  styleLabel: string;
  sourceType: string;
  inputData: Record<string, string>;
  formatted: string;
  createdAt: string;
}

type BibSection = { key: string; title: { en: string; fr: string }; matches: (c: SavedCitation) => boolean; sortKey: (c: SavedCitation) => string };

const BIB_SECTIONS: BibSection[] = [
  { key: "monograph",            title: { en: "Monographs & Books",          fr: "Monographies et ouvrages" },       matches: c => c.style === "guidesQc" && c.sourceType === "monograph",            sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "periodical",           title: { en: "Journal Articles",             fr: "Articles de revue" },               matches: c => c.style === "guidesQc" && c.sourceType === "periodical",           sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "chapter",              title: { en: "Chapters in Collective Works", fr: "Études dans ouvrages collectifs" }, matches: c => c.style === "guidesQc" && c.sourceType === "chapter",              sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "thesis",               title: { en: "Theses & Memoirs",             fr: "Thèses et mémoires" },              matches: c => c.style === "guidesQc" && c.sourceType === "thesis",               sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "other-doctrine",       title: { en: "Other Doctrine",               fr: "Autres sources doctrinales" },      matches: c => c.style === "guidesQc" && ["blog","barreau","developpements","collection-de-droit","repertoire-de-droit","annotated-code","dictionary-entry"].includes(c.sourceType), sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "jurisprudence",        title: { en: "Case Law",                     fr: "Jurisprudence" },                   matches: c => c.style === "guidesQc" && ["neutral","reported","database-case","canlii","soquij-az","eyb-rejb","quicklaw","westlaw","unpublished-judicial","admin-decision","special-bulletin","conseil-magistrature"].includes(c.sourceType), sortKey: c => (c.inputData.plaintiff || c.inputData.title || "").toLowerCase() },
  { key: "consolidated-statute", title: { en: "Consolidated Statutes",        fr: "Lois consolidées" },                matches: c => c.style === "guidesQc" && c.sourceType === "consolidated-statute", sortKey: c => (c.inputData.title || "").toLowerCase() },
  { key: "annual-statute",       title: { en: "Annual Statutes",              fr: "Lois annuelles" },                  matches: c => c.style === "guidesQc" && c.sourceType === "annual-statute",       sortKey: c => (c.inputData.title || "").toLowerCase() },
  { key: "bill",                 title: { en: "Bills",                        fr: "Projets de loi" },                  matches: c => c.style === "guidesQc" && c.sourceType === "bill",                  sortKey: c => (c.inputData.title || "").toLowerCase() },
  { key: "parliamentary-debate", title: { en: "Parliamentary Debates",        fr: "Débats parlementaires" },           matches: c => c.style === "guidesQc" && c.sourceType === "parliamentary-debate",  sortKey: c => (c.inputData.title || "").toLowerCase() },
  { key: "regulations",          title: { en: "Regulations",                  fr: "Réglementation" },                  matches: c => c.style === "guidesQc" && ["federal-codified-reg","federal-gazette-reg","quebec-rlrq-reg","quebec-gazette-reg","municipal-reg"].includes(c.sourceType), sortKey: c => (c.inputData.title || "").toLowerCase() },
  { key: "std-book",             title: { en: "Books & Monographs",           fr: "Livres et monographies" },          matches: c => c.style !== "guidesQc" && ["book","chapter"].includes(c.sourceType), sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "std-article",          title: { en: "Journal Articles",             fr: "Articles de revue" },               matches: c => c.style !== "guidesQc" && c.sourceType === "article",              sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
  { key: "std-website",          title: { en: "Websites & Other Sources",     fr: "Sites web et autres sources" },     matches: c => c.style !== "guidesQc" && c.sourceType === "website",              sortKey: c => (c.inputData.author || c.inputData.title || "").toLowerCase() },
];

const MAIN_HEADINGS: Record<string, { roman: string; en: string; fr: string }> = {
  "monograph": { roman: "I", en: "Doctrine", fr: "Doctrine" },
  "periodical": { roman: "I", en: "Doctrine", fr: "Doctrine" },
  "chapter": { roman: "I", en: "Doctrine", fr: "Doctrine" },
  "thesis": { roman: "I", en: "Doctrine", fr: "Doctrine" },
  "other-doctrine": { roman: "I", en: "Doctrine", fr: "Doctrine" },
  "jurisprudence": { roman: "II", en: "Case Law", fr: "Jurisprudence" },
  "consolidated-statute": { roman: "III", en: "Legislation", fr: "Législation" },
  "annual-statute": { roman: "III", en: "Legislation", fr: "Législation" },
  "bill": { roman: "III", en: "Legislation", fr: "Législation" },
  "parliamentary-debate": { roman: "III", en: "Legislation", fr: "Législation" },
  "regulations": { roman: "IV", en: "Regulations", fr: "Réglementation" },
  "std-book": { roman: "I", en: "Books", fr: "Livres" },
  "std-article": { roman: "II", en: "Articles", fr: "Articles" },
  "std-website": { roman: "III", en: "Other Sources", fr: "Autres sources" },
};

function organizeBib(citations: SavedCitation[]) {
  const used = new Set<string>();
  const result: { section: BibSection; items: SavedCitation[] }[] = [];
  for (const section of BIB_SECTIONS) {
    const items = citations.filter(c => !used.has(c.id) && section.matches(c)).sort((a, b) => section.sortKey(a).localeCompare(section.sortKey(b), "fr"));
    if (items.length > 0) { items.forEach(c => used.add(c.id)); result.push({ section, items }); }
  }
  const rest = citations.filter(c => !used.has(c.id));
  if (rest.length) result.push({ section: { key: "misc", title: { en: "Other Sources", fr: "Autres sources" }, matches: () => true, sortKey: c => c.inputData.title || "" }, items: rest });
  return result;
}

function stripHtml(h: string) {
  return h
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}
function buildHtmlBibliography(organized: { section: BibSection; items: SavedCitation[] }[], lang: Lang): string {
  const css = `
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
    .bib-title { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 24pt; }
    .main-heading { font-weight: bold; font-size: 12pt; margin-top: 24pt; margin-bottom: 6pt; }
    .sub-heading { font-style: italic; font-size: 12pt; margin-top: 12pt; margin-bottom: 4pt; }
    .citation { margin-bottom: 8pt; font-size: 12pt; line-height: 1.5; }
    .citation em { font-style: italic; }
  `;
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>`;
  html += `<p class="bib-title">${lang === "fr" ? "BIBLIOGRAPHIE" : "BIBLIOGRAPHY"}</p>`;
  let lastMain = "";
  for (const { section, items } of organized) {
    const main = MAIN_HEADINGS[section.key];
    const mainKey = main?.roman || "";
    if (main && mainKey !== lastMain) {
      html += `<p class="main-heading">${main.roman}. ${main[lang].toUpperCase()}</p>`;
      lastMain = mainKey;
    }
    html += `<p class="sub-heading">${section.title[lang]}</p>`;
    for (const c of items) {
      // Per guide p. 252: bibliography entries must NOT end with a period
      const formatted = c.formatted
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\.\s*$/, "");
      html += `<p class="citation">${formatted}</p>`;
    }
  }
  html += `</body></html>`;
  return html;
}

function buildPlainText(organized: { section: BibSection; items: SavedCitation[] }[], lang: Lang) {
  const lines: string[] = [];
  // Opening title
  lines.push(lang === "fr" ? "BIBLIOGRAPHIE" : "BIBLIOGRAPHY");
  let lastMain = "";
  for (const { section, items } of organized) {
    const main = MAIN_HEADINGS[section.key];
    const mainKey = main ? `${main.roman}` : "";
    if (main && mainKey !== lastMain) {
      // Two blank lines before each main section
      lines.push(""); lines.push("");
      lines.push(`${main.roman}. ${main[lang].toUpperCase()}`);
      lastMain = mainKey;
    }
    // One blank line before sub-section title
    lines.push("");
    lines.push(section.title[lang]);
    // Citations with a blank line between each
    for (const c of items) {
      lines.push("");
      // Per guide p. 252: bibliography entries must NOT end with a period
      lines.push(stripHtml(c.formatted).replace(/\.\s*$/, ""));
    }
  }
  return lines.join("\n");
}

// All style options
const ALL_STYLES = (lang: Lang) => ({
  ...STYLE_LABELS,
  guidesQc: lang === "fr" ? "Guide des références juridiques (Québec)" : "Guide des références juridiques (Quebec)",
});

interface User { id: string; email: string; name: string; }

// =============================================================================
// COMPONENT
// =============================================================================
export default function Home() {
  const [lang, setLang]             = useState<Lang>("fr");
  const [user, setUser]             = useState<User | null>(null);
  // Form state
  const [style, setStyle]           = useState<StyleKey>("mcgill");
  const [isQc, setIsQc]             = useState(true);
  const [sourceType, setSourceType] = useState<SourceType>("website");
  const [fields, setFields]         = useState<Record<string, string>>({});
  const [qcFamily, setQcFamily]     = useState("doctrine");
  const [qcSubtype, setQcSubtype]   = useState("monograph");
  const [qcFields, setQcFields]     = useState<Record<string, string>>({});
  // Guide p. 58, s. H "Les références parallèles" — further citations to
  // the same decision (style of cause given only once, on the primary one).
  const [qcAdditionalRefs, setQcAdditionalRefs] = useState<{ type: string; fields: Record<string, string> }[]>([]);
  // URL scrape
  const [urlInput, setUrlInput]     = useState("");
  const [scraping, setScraping]     = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [scrapeInfo, setScrapeInfo] = useState("");
  // Generation
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  // Last generated (shown right under form)
  const [lastResult, setLastResult] = useState<string>("");
  const [lastSaved, setLastSaved]   = useState(false);
  // Bibliography (session + saved)
  const [bibliography, setBibliography] = useState<SavedCitation[]>([]);
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [copiedAll, setCopiedAll]   = useState(false);
  const [bibLoading, setBibLoading] = useState(true);

  const t = T[lang];
  const FIELDS_BY_SOURCE = lang === "fr" ? FIELDS_FR : FIELDS_EN;
  const sourceLabels = lang === "fr" ? SOURCE_LABELS_FR : SOURCE_TYPE_LABELS;

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user));
    fetch("/api/citations").then(r => r.json()).then(d => {
      setBibliography(d.citations || []);
      setBibLoading(false);
    });
  }, []);

  const handleStyleChange = (val: string) => {
    if (val === "guidesQc") { setIsQc(true); } else { setIsQc(false); setStyle(val as StyleKey); }
    setLastResult(""); setError("");
  };

  const handleScrape = async () => {
    if (!urlInput.trim()) return;
    setScraping(true); setScrapeError("");
    try {
      const res = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim() }) });
      const data = await res.json();
      if (data.error) { setScrapeError(data.error); return; }
      setFields(prev => ({ ...prev, ...(data.title && { title: data.title }), ...(data.author && { author: data.author }), ...(data.year && { year: data.year }), ...(data.publisher && { publisher: data.publisher }), ...(data.url && { url: data.url }), ...(data.accessDate && { accessDate: data.accessDate }) }));
    } catch { setScrapeError(lang === "fr" ? "Impossible d'atteindre cette URL." : "Could not reach that URL."); }
    finally { setScraping(false); }
  };

  const handleScrapeQc = async () => {
    const url = qcFields.url?.trim();
    if (!url) return;
    setScraping(true); setScrapeError(""); setScrapeInfo("");
    try {
      const res = await fetch("/api/scrape-qc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) { setScrapeError(data.error); return; }
  
      const subtypeToFamily: Record<string, string> = {
        neutral: "jurisprudence", reported: "jurisprudence",
        "database-case": "jurisprudence", canlii: "jurisprudence",
        "soquij-az": "jurisprudence", "eyb-rejb": "jurisprudence",
        quicklaw: "jurisprudence", westlaw: "jurisprudence",
        "unpublished-judicial": "jurisprudence", "admin-decision": "jurisprudence",
        "special-bulletin": "jurisprudence", "conseil-magistrature": "jurisprudence",
        "consolidated-statute": "legislation", "annual-statute": "legislation",
        bill: "legislation", "parliamentary-debate": "legislation",
        monograph: "doctrine", periodical: "doctrine", chapter: "doctrine",
      };
      const det = data.sourceType || "monograph";
      setQcFamily(subtypeToFamily[det] || "doctrine");
      setQcSubtype(det);
  
      // Only fill fields the user hasn't already entered
      const merged: Record<string, string> = {};
      for (const key of Object.keys(data)) {
        if (["sourceType","hint","confidence","needsReview","missing"].includes(key)) continue;
        if (data[key]) merged[key] = data[key];
      }
      setQcFields(prev => {
        const updated = { ...prev };
        for (const [key, value] of Object.entries(merged)) {
          if (!prev[key]) updated[key] = value;
        }
        return updated;
      });
  
      // Show feedback based on confidence and missing fields
      if (data.message) {
        setScrapeInfo(`⚠️ ${data.message}`);
      } else if (data.needsReview && data.missing?.length > 0) {
        const pct = Math.round((data.confidence || 0) * 100);
        setScrapeInfo(
          lang === "fr"
            ? `⚠️ Remplissage partiel (${pct}% de confiance). Veuillez vérifier et compléter : ${data.missing.join(", ")}.`
            : `⚠️ Partial auto-fill (${pct}% confidence). Please verify and complete: ${data.missing.join(", ")}.`
        );
      } else {
        const pct = Math.round((data.confidence || 0) * 100);
        setScrapeInfo(
          lang === "fr"
            ? `✓ Remplissage automatique (${pct}% de confiance). Veuillez vérifier les valeurs avant de générer.`
            : `✓ Auto-filled (${pct}% confidence). Please verify the values before generating.`
        );
      }

    } catch {
      setScrapeError(lang === "fr" ? "Impossible d'atteindre cette URL." : "Could not reach that URL.");
    } finally {
      setScraping(false);
    }
  };

  const handleGenerate = async (save = false) => {
    setError(""); setLastResult(""); setLastSaved(false); setLoading(true);

    if (isQc) {
      const currentFields = QC_FIELDS[qcSubtype] || [];
      const missing = currentFields.filter(f => f.required && !qcFields[f.key]?.trim());
      // A citation's caption is either a two-party style of cause or a
      // thematic caption (guide p. 51 s. A.2) -- exactly one is needed.
      const hasCaptionFields = currentFields.some(f => f.key === "plaintiff");
      if (hasCaptionFields && !qcFields.theme?.trim() &&
          (!qcFields.plaintiff?.trim() || !qcFields.defendant?.trim())) {
        missing.push({
          key: "plaintiff",
          label: { en: "Plaintiff/Defendant (or a Theme)", fr: "Demandeur/Défendeur (ou un Thème)" },
        } as (typeof currentFields)[number]);
      }
      // Guide p. 58, s. H: each additional reference needs its own required
      // fields too (minus the style of cause, which it inherits).
      const isParallelEligible = PARALLEL_ELIGIBLE_TYPES.includes(qcSubtype);
      const additionalMissing = isParallelEligible
        ? qcAdditionalRefs.flatMap((ref, i) => {
            const refFields = (QC_FIELDS[ref.type] || []).filter(f => !PARALLEL_HIDDEN_FIELD_KEYS.includes(f.key));
            return refFields
              .filter(f => f.required && !ref.fields[f.key]?.trim())
              .map(f => `${PARALLEL_TYPE_LABELS[ref.type]?.[lang] || ref.type} #${i + 1} — ${f.label[lang]}`);
          })
        : [];
      if (missing.length || additionalMissing.length) {
        setError(`${t.missingFields} ${[...missing.map(f => f.label[lang]), ...additionalMissing].join(", ")}`);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/citations-qc", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtype: qcSubtype, fields: qcFields, save, lang,
            additionalReferences: isParallelEligible && qcAdditionalRefs.length > 0 ? qcAdditionalRefs : undefined,
          }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); }
        else {
          setLastResult(data.formatted);
          if (save) {
            setLastSaved(true);
            const newCitation: SavedCitation = {
              id: Date.now().toString(),
              style: "guidesQc",
              styleLabel: "Guide des références juridiques (Québec)",
              sourceType: qcSubtype,
              inputData: qcFields,
              formatted: data.formatted,
              createdAt: new Date().toISOString(),
            };
            setBibliography(prev => [newCitation, ...prev]);
          }
        }
      } catch { setError(t.error); }
      finally { setLoading(false); }
      return;
    }

    const missing = FIELDS_BY_SOURCE[sourceType].filter(f => f.required && !fields[f.key]?.trim());
    if (missing.length) { setError(`${t.missingFields} ${missing.map(f => f.label).join(", ")}`); setLoading(false); return; }
    try {
      const res = await fetch("/api/citations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style, sourceData: { ...fields, sourceType }, save, lang }) });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setLastResult(data.formatted);
        if (save) {
          setLastSaved(true);
          const newCitation: SavedCitation = {
            id: Date.now().toString(),
            style,
            styleLabel: STYLE_LABELS[style],
            sourceType,
            inputData: fields,
            formatted: data.formatted,
            createdAt: new Date().toISOString(),
          };
          setBibliography(prev => [newCitation, ...prev]);
        }
      }
    } catch { setError(t.error); }
    finally { setLoading(false); }
  };

  const handleDeleteBib = async (id: string) => {
    await fetch("/api/citations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBibliography(prev => prev.filter(c => c.id !== id));
  };

  const handleCopyOne = (c: SavedCitation) => {
    navigator.clipboard.writeText(stripHtml(c.formatted));
    setCopiedId(c.id); setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const organized = organizeBib(bibliography);
    const html = buildHtmlBibliography(organized, lang);
    const plain = buildPlainText(organized, lang);
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      navigator.clipboard.write([item]);
    } catch {
      navigator.clipboard.writeText(plain);
    }
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleLogout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); };

  const LangToggle = () => (
    <div style={{ display: "flex", border: "1px solid var(--rule)", borderRadius: "6px", overflow: "hidden" }}>
      <button onClick={() => setLang("en")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", cursor: "pointer", background: lang === "en" ? "var(--accent)" : "white", color: lang === "en" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>EN</button>
      <button onClick={() => setLang("fr")} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", fontWeight: 500, border: "none", borderLeft: "1px solid var(--rule)", cursor: "pointer", background: lang === "fr" ? "var(--accent)" : "white", color: lang === "fr" ? "white" : "var(--ink-light)", fontFamily: "var(--sans)" }}>FR</button>
    </div>
  );

  const allStyles = ALL_STYLES(lang);
  const organized = organizeBib(bibliography);

  // Render QC fields
  const currentQcFields = QC_FIELDS[qcSubtype] || [];

  // Track last main heading for bibliography rendering
  let lastMain = "";

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">Cite<span>.</span></a>
        <div className="nav-links">
          {user ? (
            <>
              <span className="nav-link" style={{ color: "var(--ink-faint)" }}>{user.name}</span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>{t.logout}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">{t.login}</Link>
              <Link href="/register" className="btn btn-primary btn-sm">{t.signup}</Link>
            </>
          )}
          <LangToggle />
        </div>
      </nav>

      <main className="page">
        {/* Hero */}
        <div className="stack stack-xs" style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem,5vw,2.75rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>{t.tagline}</h1>
          <p style={{ color: "var(--ink-light)", fontSize: "1rem", maxWidth: "480px" }}>{t.sub}</p>
        </div>

        {/* ── GENERATOR CARD ─────────────────────────────────────────────── */}
        <div className="card stack stack-lg">

          {/* Style selector */}
          <div className="field">
            <label className="label">{t.style}</label>
            <select className="select" value={isQc ? "guidesQc" : style} onChange={e => handleStyleChange(e.target.value)}>
              {Object.entries(allStyles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          {/* ── GUIDE QC FORM ── */}
          {isQc && (
            <>
              {/* QC URL autofill */}
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "8px", padding: "1rem 1.25rem" }}>
                <label className="label" style={{ marginBottom: "0.5rem", display: "block" }}>
                  {lang === "fr" ? "Remplissage automatique" : "Auto-fill from URL"}
                  <span style={{ fontWeight: 400, textTransform: "none", color: "var(--ink-faint)", marginLeft: "0.4rem" }}>
                    {lang === "fr" ? "— CanLII, Assemblée nationale, légisQuébec" : "— CanLII, Assemblée nationale, or légisQuébec link"}
                  </span>
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="input" type="url" placeholder="https://canlii.org/... ou https://assnat.qc.ca/..."
                    value={qcFields.url || ""}
                    onChange={e => { setQcFields(prev => ({ ...prev, url: e.target.value })); setScrapeError(""); setScrapeInfo(""); }}                    onKeyDown={e => e.key === "Enter" && handleScrapeQc()} />
                  <button className="btn btn-secondary" onClick={handleScrapeQc} disabled={scraping || !qcFields.url?.trim()} style={{ whiteSpace: "nowrap" }}>
                    {scraping ? (lang === "fr" ? "Chargement…" : "Fetching…") : (lang === "fr" ? "Remplir" : "Auto-fill")}
                  </button>
                </div>
                {scrapeError && <div className="error-msg" style={{ marginTop: "0.5rem" }}>{scrapeError}</div>}
                {scrapeInfo && (
                <div style={{
                  marginTop: "0.5rem", fontSize: "0.8rem", lineHeight: 1.5, padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  background: scrapeInfo.startsWith("⚠️") ? "#fffbeb" : "#f0fdf4",
                  color: scrapeInfo.startsWith("⚠️") ? "#92400e" : "#166534",
                  border: scrapeInfo.startsWith("⚠️") ? "1px solid #fde68a" : "1px solid #bbf7d0",
                }}>
                  {scrapeInfo}
                </div>
              )}
              </div>


              {/* Guide QC scope note */}
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "6px", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#5b21b6", lineHeight: 1.5 }}>
                {lang === "fr"
                  ? "⚖️ Ce style est conçu pour les écrits juridiques québécois. Il couvre la doctrine, la jurisprudence, la législation et la réglementation. Pour les sources non juridiques (sites web généraux, encyclopédies), utilisez plutôt le style McGill → Site web."
                  : "⚖️ This style is designed for Quebec legal writing. It covers doctrine, case law, legislation, and regulations. For non-legal sources (general websites, encyclopedias), use McGill style → Website instead."}
              </div>

              {/* Family buttons */}
              <div>
                <label className="label" style={{ marginBottom: "0.5rem", display: "block" }}>{lang === "fr" ? "Famille de source" : "Source Family"}</label>
                <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  {QC_FAMILIES.map(f => (
                    <button key={f.key} className={`btn btn-sm ${qcFamily === f.key ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => { setQcFamily(f.key); setQcSubtype(QC_SUBTYPES[f.key][0].key); setQcFields({}); setQcAdditionalRefs([]); setLastResult(""); }}>
                      {f.label[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Neutral citation mandatory note */}
              {qcFamily === "jurisprudence" && (
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.6rem 0.9rem", fontSize: "0.8rem", color: "#854d0e" }}>
                  {lang === "fr"
                    ? "⚠️ La référence neutre est obligatoire lorsqu'elle est disponible. Utilisez le recueil imprimé seulement si aucune référence neutre n'existe."
                    : "⚠️ The neutral citation is mandatory when available. Use a print reporter only if no neutral citation exists."}
                </div>
              )}

              {/* Subtype dropdown */}
              <div className="field">
                <label className="label">{lang === "fr" ? "Type de source" : "Source Type"}</label>
                <select className="select" value={qcSubtype} onChange={e => { setQcSubtype(e.target.value); setQcFields({}); setQcAdditionalRefs([]); setLastResult(""); }}>
                  {QC_SUBTYPES[qcFamily].map(s => <option key={s.key} value={s.key}>{s.label[lang]}</option>)}
                </select>
              </div>

              <hr className="divider" style={{ margin: "0" }} />

              {/* Contextual hints */}
              {qcSubtype === "blog" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#92400e", lineHeight: 1.5 }}>
                  {lang === "fr"
                    ? "💡 Le Guide des références juridiques est conçu pour les sources juridiques (doctrine, jurisprudence, législation). Pour les sites web généraux comme les encyclopédies ou les journaux, utilisez ce type « Blogue / journal » ou passez au style McGill qui a un type « Site web » dédié."
                    : "💡 The Guide des références juridiques is designed for legal sources (doctrine, case law, legislation). For general websites like encyclopedias or newspapers, use this \"Blog / newspaper\" type or switch to McGill style which has a dedicated \"Website\" source type."}
                </div>
              )}

              {qcFamily === "doctrine" && qcSubtype === "monograph" && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#075985", lineHeight: 1.5 }}>
                  {lang === "fr"
                    ? "ℹ️ Le Guide QC couvre : la doctrine juridique (livres, articles, thèses), la jurisprudence (décisions de tribunaux), la législation (lois, projets de loi) et la réglementation. Pour les sites web généraux, utilisez Doctrine → Blogue / journal, ou passez au style McGill."
                    : "ℹ️ Guide QC covers: legal doctrine (books, articles, theses), case law (court decisions), legislation (statutes, bills), and regulations. For general websites, use Doctrine → Blog / newspaper, or switch to McGill style."}
                </div>
              )}

              {qcFamily === "jurisprudence" && (
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.6rem 0.9rem", fontSize: "0.8rem", color: "#854d0e" }}>
                  {lang === "fr"
                    ? "⚠️ La référence neutre est obligatoire lorsqu'elle est disponible. Utilisez le recueil imprimé seulement si aucune référence neutre n'existe."
                    : "⚠️ The neutral citation is mandatory when available. Use a print reporter only if no neutral citation exists."}
                  </div>
              )}
              
              {/* QC fields */}
              <div className="grid-2">
                {currentQcFields.map(f => (
                  <div key={f.key} className="field" style={f.span ? { gridColumn: "1 / -1" } : {}}>
                    <label className="label">{f.label[lang]}{f.required && <span style={{ color: "var(--accent)" }}> *</span>}</label>
                    {f.type === "select" ? (
                      <select className="select" value={qcFields[f.key] || f.options?.[0]?.value || ""} onChange={e => setQcFields(prev => ({ ...prev, [f.key]: e.target.value }))}>
                        {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input className="input" type="text" placeholder={f.label[lang]} value={qcFields[f.key] || ""} onChange={e => setQcFields(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    )}
                    {f.key === "publisher" && (() => {
                      const pub = qcFields["publisher"] || "";
                      const official = ["éditions thémis","éditions yvon blais","éditions de la revue","éditions wilson"];
                      const startsWithEditions = /^[ÉéEe]ditions\s+/i.test(pub);
                      const isOfficial = official.some(n => pub.toLowerCase().startsWith(n));
                      return startsWithEditions && !isOfficial ? (
                        <p style={{ fontSize: "0.78rem", color: "#92400e", marginTop: "0.25rem" }}>
                          {lang === "fr"
                            ? "N'écrivez pas « Éditions » devant l'éditeur sauf si c'est dans son nom officiel (ex. : Éditions Thémis, Éditions Yvon Blais)."
                            : "Don't write \u00abÉditions\u00bb before the publisher name unless it's part of the official name (e.g. Éditions Thémis, Éditions Yvon Blais)."}
                        </p>
                      ) : null;
                    })()}
                    {f.key === "author" && !qcFields["author"] && (
                      <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginTop: "0.25rem" }}>
                        {lang === "fr" ? "Aucun auteur ? Laissez vide — la citation commencera par le titre." : "No author? Leave blank — the citation will start with the title."}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Parallel citations (guide p. 58, s. H) — further references
                  to the SAME decision, style of cause given only once. */}
              {PARALLEL_ELIGIBLE_TYPES.includes(qcSubtype) && (
                <div className="stack stack-sm" style={{ border: "1px dashed var(--ink-faint, #ccc)", borderRadius: "8px", padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <label className="label" style={{ display: "block" }}>
                        {lang === "fr" ? "Références parallèles" : "Parallel Citations"}
                      </label>
                      <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginTop: "0.15rem" }}>
                        {lang === "fr"
                          ? "Facultatif — d'autres références à la même décision, dans l'ordre hiérarchique. Le nom des parties n'est pas répété."
                          : "Optional — other references to this same decision, in hierarchical order. Party names are not repeated."}
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQcAdditionalRefs(prev => [...prev, { type: "reported", fields: {} }])}
                    >
                      {lang === "fr" ? "+ Ajouter une référence" : "+ Add a reference"}
                    </button>
                  </div>

                  {qcAdditionalRefs.map((ref, i) => {
                    const refFields = (QC_FIELDS[ref.type] || []).filter(fld => !PARALLEL_HIDDEN_FIELD_KEYS.includes(fld.key));
                    return (
                      <div key={i} className="stack stack-xs" style={{ borderTop: i > 0 ? "1px solid var(--ink-faint, #eee)" : undefined, paddingTop: i > 0 ? "0.75rem" : 0 }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                          <div className="field" style={{ flex: 1 }}>
                            <label className="label">{lang === "fr" ? `Référence #${i + 1} — type` : `Reference #${i + 1} — type`}</label>
                            <select
                              className="select"
                              value={ref.type}
                              onChange={e => setQcAdditionalRefs(prev => prev.map((r, j) => j === i ? { type: e.target.value, fields: {} } : r))}
                            >
                              {PARALLEL_ELIGIBLE_TYPES.map(ty => (
                                <option key={ty} value={ty}>{PARALLEL_TYPE_LABELS[ty][lang]}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setQcAdditionalRefs(prev => prev.filter((_, j) => j !== i))}
                          >
                            {t.deleteBtn}
                          </button>
                        </div>
                        <div className="grid-2">
                          {refFields.map(fld => (
                            <div key={fld.key} className="field" style={fld.span ? { gridColumn: "1 / -1" } : {}}>
                              <label className="label">{fld.label[lang]}{fld.required && <span style={{ color: "var(--accent)" }}> *</span>}</label>
                              {fld.type === "select" ? (
                                <select
                                  className="select"
                                  value={ref.fields[fld.key] || fld.options?.[0]?.value || ""}
                                  onChange={e => setQcAdditionalRefs(prev => prev.map((r, j) => j === i ? { ...r, fields: { ...r.fields, [fld.key]: e.target.value } } : r))}
                                >
                                  {fld.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              ) : (
                                <input
                                  className="input" type="text" placeholder={fld.label[lang]}
                                  value={ref.fields[fld.key] || ""}
                                  onChange={e => setQcAdditionalRefs(prev => prev.map((r, j) => j === i ? { ...r, fields: { ...r.fields, [fld.key]: e.target.value } } : r))}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── STANDARD FORM ── */}
          {!isQc && (
            <>
              <div className="field">
                <label className="label">{t.sourceType}</label>
                <select className="select" value={sourceType} onChange={e => { setSourceType(e.target.value as SourceType); setFields({}); setLastResult(""); setUrlInput(""); setScrapeError(""); }}>
                  {Object.entries(sourceLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>

              {/* Standard URL autofill */}
              <div style={{ background: "#f0f4ff", border: "1px solid #d0dafc", borderRadius: "8px", padding: "1rem 1.25rem" }}>
                <label className="label" style={{ marginBottom: "0.5rem", display: "block" }}>
                  {t.autofillLabel}
                  <span style={{ fontWeight: 400, textTransform: "none", color: "var(--ink-faint)", marginLeft: "0.4rem" }}>{t.autofillSub}</span>
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="input" type="url" placeholder={t.autofillPlaceholder} value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setScrapeError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleScrape()} />
                  <button className="btn btn-secondary" onClick={handleScrape} disabled={scraping || !urlInput.trim()} style={{ whiteSpace: "nowrap" }}>
                    {scraping ? t.fetching : t.autofillBtn}
                  </button>
                </div>
                {scrapeError && <div className="error-msg" style={{ marginTop: "0.5rem" }}>{scrapeError}</div>}
              </div>

              <hr className="divider" style={{ margin: "0" }} />

              <div className="grid-2">
                {FIELDS_BY_SOURCE[sourceType].map(f => (
                  <div key={f.key} className="field" style={f.span ? { gridColumn: "1 / -1" } : {}}>
                    <label className="label">{f.label}{f.required && <span style={{ color: "var(--accent)" }}> *</span>}</label>
                    <input className="input" type="text" placeholder={f.label} value={fields[f.key] || ""} onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    {f.key === "author" && !fields["author"] && (
                      <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginTop: "0.25rem" }}>
                        {lang === "fr" ? "Aucun auteur ? Laissez vide — la citation commencera par le titre." : "No author? Leave blank — the citation will start with the title."}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <div className="error-msg">{error}</div>}

          {/* Action buttons */}
          <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={() => handleGenerate(false)} disabled={loading}>
              {loading ? t.generating : t.generate}
            </button>
            {user ? (
              <button className="btn btn-primary" onClick={() => handleGenerate(true)} disabled={loading}>
                {loading ? t.generating : t.generateSave}
              </button>
            ) : (
              <span style={{ fontSize: "0.85rem", color: "var(--ink-faint)" }}>
                <Link href="/register" style={{ color: "var(--accent)" }}>{t.signupPrompt}</Link>{t.signupSuffix}
              </span>
            )}
          </div>

          {/* Last generated result */}
          {lastResult && (
            <div style={{ background: "var(--accent-bg)", border: "1px solid #c5d3f7", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span className="label">{t.result}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.875rem", lineHeight: 1.8, wordBreak: "break-word" }}
                dangerouslySetInnerHTML={{ __html: lastResult }} />
              {lastSaved && (
                <p style={{ fontSize: "0.8rem", color: "var(--success)", marginTop: "0.5rem", fontWeight: 500 }}>
                  ✓ {t.saved}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── BIBLIOGRAPHY ───────────────────────────────────────────────── */}
        {!bibLoading && (
          <div style={{ marginTop: "3rem" }}>
            {/* Bibliography header */}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
                  {t.bibTitle}
                </h2>
                <p style={{ color: "var(--ink-light)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                  {bibliography.length > 0 ? t.bibSub : ""}
                </p>
                {bibliography.length > 0 && (
                  <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginTop: "0.2rem" }}>
                    {lang === "fr"
                      ? "Les références bibliographiques ne contiennent pas de pinpoint (art., par., n°, p.) ni de point final."
                      : "Bibliography entries contain no pinpoints (art., par., n°, p.) and no trailing period."}
                  </p>
                )}
              </div>
              {bibliography.length > 0 && (
                <button className="btn btn-primary" onClick={handleCopyAll}>
                  {copiedAll ? t.copiedAll : t.copyAll}
                </button>
              )}
            </div>

            {bibliography.length === 0 ? (
              <div style={{ background: "var(--white)", border: "1px dashed var(--rule)", borderRadius: "10px", padding: "2.5rem", textAlign: "center", color: "var(--ink-faint)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
                <p style={{ fontSize: "0.9rem" }}>{t.bibEmpty}</p>
              </div>
            ) : (
              <div className="stack stack-lg">
                {organized.map(({ section, items }) => {
                  const main = MAIN_HEADINGS[section.key];
                  const mainKey = main?.roman || "";
                  const showMain = main && mainKey !== lastMain;
                  if (showMain) lastMain = mainKey;

                  return (
                    <div key={section.key}>
                      {/* Main heading: I. DOCTRINE */}
                      {showMain && main && (
                        <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "0.35rem", marginBottom: "1rem", marginTop: "0.5rem" }}>
                          <h3 style={{ fontFamily: "var(--serif)", fontSize: "1.25rem", letterSpacing: "-0.01em", color: "var(--ink)" }}>
                            {main.roman}. {main[lang]}
                          </h3>
                        </div>
                      )}

                      {/* Sub-section label */}
                      <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-light)", marginBottom: "0.6rem" }}>
                        {section.title[lang]}
                      </p>

                      {/* Citations */}
                      <div className="stack stack-sm">
                        {items.map(c => (
                          <div key={c.id} style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "8px", padding: "0.875rem 1.125rem" }}>
                            <div style={{ fontFamily: "var(--mono)", fontSize: "0.875rem", lineHeight: 1.75, color: "var(--ink)", wordBreak: "break-word", marginBottom: "0.6rem" }}
                              dangerouslySetInnerHTML={{ __html: c.formatted }} />
                            <div className="row" style={{ gap: "0.5rem" }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCopyOne(c)}>
                              {copiedId === c.id ? t.copied : t.copy}
                            </button>
                            <span style={{ fontSize: "0.72rem", color: "var(--ink-faint)" }}>{c.styleLabel}</span>
                            <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={() => handleDeleteBib(c.id)}>
                              {t.deleteBtn}
                            </button>
                          </div>

                          {/* Short citations — ibid. and préc. */}
                          {bibliography.length > 1 && (
                            <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", background: "#f8f8f8", borderRadius: "6px", border: "1px solid var(--rule)" }}>
                              <p style={{ fontSize: "0.75rem", color: "var(--ink-light)", marginBottom: "0.4rem", fontWeight: 600 }}>
                                {lang === "fr" ? "Références subséquentes" : "Short citations"}
                              </p>
                              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                                {c.id === bibliography[0].id && (
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}
                                    onClick={() => { navigator.clipboard.writeText("Ibid."); setCopiedId(c.id + "-ibid"); setTimeout(() => setCopiedId(null), 2000); }}>
                                    {copiedId === c.id + "-ibid" ? "✓" : "Copy: Ibid."}
                                  </button>
                                )}
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}
                                  onClick={() => {
                                    const noteNum = bibliography.findIndex(b => b.id === c.id) + 1;
                                    const lastName = (c.inputData.author || c.inputData.plaintiff || "").split(" ").pop()?.toUpperCase() || "";
                                    const shortTitle = (c.inputData.title || "").split(":")[0].trim();
                                    const text = c.style === "guidesQc" && ["neutral","reported","canlii","database-case","soquij-az","eyb-rejb","quicklaw","westlaw"].includes(c.sourceType)
                                      ? `${lastName}, préc., note ${noteNum}`
                                      : `${lastName}, ${shortTitle}, préc., note ${noteNum}`;
                                    navigator.clipboard.writeText(text.replace(/<[^>]+>/g, ""));
                                    setCopiedId(c.id + "-prec");
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}>
                                  {copiedId === c.id + "-prec"
                                    ? "✓"
                                    : `Copy: préc., note ${bibliography.findIndex(b => b.id === c.id) + 1}`}
                                </button>
                              </div>
                            </div>
                          )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom copy button */}
                {bibliography.length > 2 && (
                  <div style={{ textAlign: "center", paddingTop: "1rem" }}>
                    <button className="btn btn-primary" onClick={handleCopyAll} style={{ padding: "0.7rem 2rem" }}>
                      {copiedAll ? t.copiedAll : t.copyAll}
                    </button>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", marginTop: "0.4rem" }}>
                      {lang === "fr" ? "Prêt à coller dans Word ou Google Docs avec tous les titres de sections." : "Ready to paste into Word or Google Docs with all section headings."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
