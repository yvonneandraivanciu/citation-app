import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "@/lib/auth";
import { saveCitation } from "@/lib/db";
import {
  formatMonograph, formatPeriodicalArticle, formatStudyInCollectiveWork,
  formatBlogOrNewspaperArticle, formatUnpublishedThesis,
  formatBarreauCongress, formatDeveloppementsRecents,
  formatCollectionDeDroit, formatRepertoireDeDroit, formatAnnotatedCode,
  formatDictionaryEntry,
  formatNeutralCitationCase, formatReportedCase, formatDatabaseCase,
  formatCanLIICase, formatUnpublishedJudicialDecision,
  formatUnpublishedAdministrativeDecision,
  formatSpecialBulletinDecision, formatConseilMagistratureDecision,
  formatConsolidatedStatute, formatAnnualStatute, formatBill,
  formatFederalCodifiedRegulation, formatFederalGazetteRegulation,
  formatQuebecRLRQRegulation, formatQuebecGazetteRegulation,
  formatMunicipalRegulation, formatParliamentaryDebate,formatSoquijAzCase,
  formatReferenceCase, formatLexisAdvanceCase, formatWestlawCase,
  formatParallelCitations,
} from "@/lib/legal-citations";
import type { Monograph, CollectiveWork, RepertoireDeDroit, CollectionDeDroit, StyleOfCause, ThematicCaption } from "@/lib/legal-citations";

// ── Field helpers ─────────────────────────────────────────────────────────────

// Returns value only if non-empty
function s(val: unknown): string {
  if (val === undefined || val === null || val === "" || val === "undefined") return "";
  return String(val).trim();
}

// Returns value if non-empty, else fallback
function or(val: unknown, fallback: string): string {
  const v = s(val);
  return v !== "" ? v : fallback;
}

// Required field — if missing, use a visible placeholder so user knows
function required(val: unknown, placeholder: string): string {
  const v = s(val);
  return v !== "" ? v : placeholder;
}

function parseAuthors(raw: string) {
  if (!s(raw)) return [];   // Empty authors → empty array → formatAuthors returns ""
  return raw.split(";").map(a => {
    a = a.trim();
    if (a.includes(",")) {
      const [last, first] = a.split(",").map(p => p.trim());
      return { firstName: first || "", lastName: last };
    }
    const parts = a.split(" ");
    return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
  });
}

function parseList(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

// Post-process: clean up any "undefined" or double spaces/commas that slip through
function clean(text: string): string {
  return text
    .replace(/\bundefined\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Per guide: never write "Éditions" before publisher name
// unless it is part of the official name
function cleanPublisher(pub: string): string {
  if (!pub) return pub;
  const officialNames = [
    "éditions thémis",
    "éditions yvon blais",
    "éditions de la revue",
    "éditions wilson",
    "éditions de l\'université",
  ];
  if (officialNames.some(n => pub.toLowerCase().startsWith(n))) return pub;
  return pub.replace(/^[ÉéEe]ditions\s+/i, "").trim();
}

// Auto-fill city/publisher for Développements récents and Barreau congress
// Per guide modifications: publisher and city vary by year
function devPublisherByYear(year: number): { city: string; publisher: string } {
  if (year >= 1989 && year <= 1994) return { city: "Montréal", publisher: "Barreau du Québec" };
  if (year >= 1995 && year <= 2013) return { city: "Cowansville", publisher: "Éditions Yvon Blais" };
  if (year >= 2014)                 return { city: "Montréal",    publisher: "Éditions Yvon Blais" };
  return { city: "", publisher: "" };
}

// Auto-fill city for Éditions Yvon Blais monographs when city not provided
function yvonBlaisCity(year: number): string {
  if (year >= 2014) return "Montréal";
  if (year > 0)     return "Cowansville";
  return "s.l.";
}

// ── Jurisprudence: shared by the primary citation and every parallel /
//    "additional reference" it may be combined with (guide p. 58, s. H) ──

// Jurisprudence subtypes that carry a style of cause and can take part in a
// parallel citation, either as the primary reference or as an addition.
const JURISPRUDENCE_REFERENCE_TYPES = [
  "neutral", "reported", "database-case", "canlii", "soquij-az", "eyb-rejb", "quicklaw", "westlaw",
] as const;
type JurisprudenceReferenceType = typeof JURISPRUDENCE_REFERENCE_TYPES[number];

function isJurisprudenceReferenceType(t: string): t is JurisprudenceReferenceType {
  return (JURISPRUDENCE_REFERENCE_TYPES as readonly string[]).includes(t);
}

// Thrown for a field problem specific to one reference (primary or
// additional) so the route can report exactly which one and which field.
class CitationFieldError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
  }
}

/**
 * Formats one jurisprudence reference (neutral citation, reported case,
 * database case, CanLII, SOQUIJ/AZ, EYB/REJB, Quicklaw, or Westlaw).
 *
 * `omitStyle` is set for every reference after the first in a parallel
 * citation (guide p. 58, s. H) — the style of cause is only given once.
 */
function formatJurisprudenceReference(
  type: JurisprudenceReferenceType,
  f: Record<string, string>,
  style: StyleOfCause | ThematicCaption,
  omitStyle: boolean,
  lang: "en" | "fr"
): string {
  switch (type) {
    case "neutral":
      return formatNeutralCitationCase({
        style,
        year: or(f.year, "[année]"),
        courtCode: or(f.courtCode, "[tribunal]"),
        sequenceNumber: or(f.sequenceNumber, "[no]"),
        paragraph: s(f.paragraph) || undefined,
      }, { omitStyle });

    case "reported":
      return formatReportedCase({
        style,
        year: or(f.year, "[année]"),
        yearBrackets: f.yearBrackets === "()" ? "()" : "[]",
        // Guide p. 52: parenthetical year placement depends on editorial
        // tradition; left unset it's inferred from the connector.
        yearPosition: f.yearPosition === "beforeComma" ? "beforeComma"
          : f.yearPosition === "afterComma" ? "afterComma"
          : undefined,
        volume: s(f.volume) || undefined,
        reportAbbreviation: or(f.reportAbbreviation, "[recueil]"),
        reportIsJournal: f.reportIsJournal === "yes",
        firstPage: or(f.firstPage, "[p. ?]"),
        citedPages: parseList(f.pages).length ? parseList(f.pages) : undefined,
        paragraphs: parseList(f.paragraphNumbers).length ? parseList(f.paragraphNumbers) : undefined,
        court: s(f.court) || undefined,
        // Guide p. 51 s. B: decision year, only when >3 years before publication.
        decisionYear: s(f.decisionYear) || undefined,
        // Guide p. 71: résumé reproduced inside an otherwise full-text reporter.
        isSummary: f.isSummary === "yes",
        // Guide p. 70 s. 2: decision followed/preceded by doctrinal commentary.
        commentary: s(f.commentaryAuthor) ? { author: f.commentaryAuthor, page: or(f.commentaryPage, "[p.]") } : undefined,
      }, { omitStyle });

    case "database-case":
      return formatDatabaseCase({
        style,
        // Guide pp. 54/56/58: a résumé-collection reference (J.E., EXP,
        // D.T.E., etc.) has no separate year -- it's embedded in the document
        // number ("J.E. 2005-1144"). Only pass a year when one was actually given.
        year: s(f.year) || undefined,
        yearBrackets: f.yearBrackets === "()" ? "()" : f.yearBrackets === "none" ? "none" : undefined,
        // Guide p. 71: EXP's morphology folds the abbreviation into the
        // document number itself ("2014 EXP-1495"), so this may be left
        // blank rather than forced to a placeholder.
        databaseAbbreviation: s(f.reportAbbreviation),
        documentNumber: or(f.sequenceNumber, "[no]"),
        paragraph: s(f.paragraph) || undefined,
        court: s(f.court) || undefined,
      }, { omitStyle });

    case "canlii":
      return formatCanLIICase({
        style,
        year: or(f.year, "[année]"),
        sequenceNumber: or(f.sequenceNumber, "[no]"),
        courtCode: s(f.courtCode) || undefined,
        jurisdiction: s(f.court) || undefined,
        paragraph: s(f.paragraph) || undefined,
      }, { omitStyle });

    case "soquij-az":
      return formatSoquijAzCase({
        style,
        year: or(f.year, "[année]"),
        azNumber: or(f.sequenceNumber, "[no AZ]"),
        paragraph: s(f.paragraph) || undefined,
        pdfPage: s(f.pages) || undefined,
        court: s(f.court) || undefined,
      }, { omitStyle });

    case "eyb-rejb": {
      const eybYear = s(f.year);
      if (eybYear && eybYear.length !== 4) {
        throw new CitationFieldError(
          lang === "fr"
            ? "Pour le REJB/EYB, l'année doit être écrite au long (ex. : 1999)."
            : "For REJB/EYB, the year must be written in full (e.g. 1999).",
          "year"
        );
      }
      return formatReferenceCase({
        style,
        databaseCode: (or(f.reportAbbreviation, "EYB") as "EYB" | "REJB"),
        documentNumber: or(f.sequenceNumber, "[no]"),
        paragraph: s(f.paragraph) || undefined,
        court: s(f.court) || undefined,
      }, { omitStyle });
    }

    case "quicklaw":
      return formatLexisAdvanceCase({
        style,
        year: or(f.year, "[année]"),
        courtIdentifier: or(f.courtIdentifier, "[identifiant]"),
        documentNumber: or(f.sequenceNumber, "[no]"),
        paragraph: s(f.paragraph) || undefined,
        court: s(f.court) || undefined,
        serviceLabel: f.serviceLabel === "LN/QL" ? "LN/QL" : "LAd/QL",
      }, { omitStyle });

    case "westlaw":
      return formatWestlawCase({
        style,
        year: or(f.year, "[année]"),
        databaseAbbreviation: or(f.reportAbbreviation, "[base]"),
        documentNumber: or(f.sequenceNumber, "[no]"),
        court: s(f.court) || undefined,
      }, { omitStyle });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subtype, fields: f, save, lang = "fr", additionalReferences } = body as {
      subtype: string;
      fields: Record<string, string>;
      save: boolean;
      lang?: "en" | "fr";
      // Guide p. 58, s. H "Les références parallèles": further citations to
      // the *same* decision, given in hierarchical order and joined with
      // commas — the style of cause is only stated once, on the primary one.
      additionalReferences?: { type: string; fields: Record<string, string> }[];
    };
    let formatted = "";

    switch (subtype) {

      // ── DOCTRINE ───────────────────────────────────────────────────────────
      // Guide rules:
      //   Author:    omit if missing (start with title)
      //   Year:      "s.d." if missing
      //   City:      "s.l." if missing
      //   Publisher: "s.n." if missing
      //   Edition:   omit if missing (first edition not mentioned per guide)
      //   Pages:     omit if missing

      case "monograph": {
        const monoYear = parseInt(s(f.year) || "0");
        const rawPub   = or(f.publisher, "");
        const monoPub  = cleanPublisher(rawPub) || "s.n.";
        let monoCity   = or(f.publisherCity, "");
        // Per guide: Éditions Yvon Blais city varies by year
        if (!monoCity && monoPub.toLowerCase().includes("yvon blais")) {
          monoCity = yvonBlaisCity(monoYear);
        }
        formatted = formatMonograph({
          authors: parseAuthors(s(f.author)),
          title: required(f.title, "[titre]"),
          subtitle: s(f.subtitle) || undefined,
          edition: s(f.edition) || undefined,
          collaborators: s(f.collaborators) ? parseAuthors(s(f.collaborators)) : undefined,
          tome: s(f.tomeNumber) ? { number: s(f.tomeNumber), title: s(f.tomeTitle) || undefined } : undefined,
          volume: s(f.volume) || undefined,
          collection: s(f.collection) || undefined,
          city: monoCity || "s.l.",
          publisher: monoPub,
          year: or(f.year, "s.d."),
          pages: parseList(f.pages).length ? parseList(f.pages) : undefined,
          paragraphNumbers: parseList(f.paragraphNumbers).length ? parseList(f.paragraphNumbers) : undefined,
          online: (s(f.url) || s(f.database) || s(f.documentId))
            ? { url: s(f.url) || undefined, database: s(f.database) || undefined, documentId: s(f.documentId) || undefined }
            : undefined,
        });
        break;
      }

      case "periodical":
        // Guide requires: author, title, year, journal abbreviation, first page
        // Missing journal → [revue ?], missing first page → [p. ?]
        formatted = formatPeriodicalArticle({
          authors: parseAuthors(s(f.author)),
          title: required(f.title, "[titre]"),
          year: or(f.year, "s.d."),
          volume: s(f.volume) || undefined,
          journalAbbreviation: or(f.journalName, "[revue ?]"),
          firstPage: or(f.firstPage, "[p. ?]"),
          citedPages: parseList(f.pages).length ? parseList(f.pages) : undefined,
          paragraphNumber: s(f.paragraphNumbers) || undefined,
          online: (s(f.url) || s(f.database) || s(f.documentId))
            ? { url: s(f.url) || undefined, database: s(f.database) || undefined, documentId: s(f.documentId) || undefined }
            : undefined,
        });
        break;

      case "chapter":
        formatted = formatStudyInCollectiveWork({
          authors: parseAuthors(s(f.author)),
          studyTitle: required(f.title, "[titre du chapitre]"),
          collectiveWork: {
            directors: s(f.editors) ? parseAuthors(s(f.editors)) : [],
            title: or(f.bookTitle, "[titre de l'ouvrage]"),
            tome: s(f.tomeNumber) ? { number: s(f.tomeNumber), title: s(f.tomeTitle) || undefined } : undefined,
            city: or(f.publisherCity, "s.l."),
            publisher: or(f.publisher, "s.n."),
            year: or(f.year, "s.d."),
          },
          firstPage: s(f.firstPage) || undefined,
          citedPages: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "thesis":
        formatted = formatUnpublishedThesis({
          authors: parseAuthors(or(f.author, "[auteur]")),
          title: required(f.title, "[titre]"),
          degreeType: f.degreeType === "maitrise" ? "mémoire de maîtrise" : "thèse de doctorat",
          city: or(f.publisherCity, "s.l."),
          faculty: or(f.faculty, "[faculté]"),
          university: or(f.publisher, "[université]"),
          year: or(f.year, "s.d."),
          pages: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "blog":
        formatted = formatBlogOrNewspaperArticle({
          author: parseAuthors(s(f.author))[0] || { firstName: "", lastName: "" },
          title: required(f.title, "[titre]"),
          source: or(f.journalName, "[source]"),
          date: or(f.accessDate, or(f.year, "s.d.")),
          specialSection: s(f.specialSection) || undefined,
          page: s(f.pages) || undefined,
          url: s(f.url) || undefined,
        });
        break;

      case "barreau": {
        const barYear = parseInt(s(f.year) || "0");
        const barDefaults = devPublisherByYear(barYear);
        formatted = formatBarreauCongress({
          authors: parseAuthors(s(f.author)),
          studyTitle: required(f.title, "[titre]"),
          year: or(f.year, "s.d."),
          city: or(f.publisherCity, barDefaults.city) || undefined,
          publisher: cleanPublisher(or(f.publisher, barDefaults.publisher)) || undefined,
          firstPage: s(f.firstPage) || undefined,
          citedPage: s(f.pages) || undefined,
          url: s(f.url) || undefined,
        });
        break;
      }

      case "developpements": {
        const devYear = parseInt(s(f.year) || "0");
        const devDefaults = devPublisherByYear(devYear);
        formatted = formatDeveloppementsRecents({
          authors: parseAuthors(s(f.author)),
          studyTitle: required(f.title, "[titre]"),
          volume: or(f.volume, "[vol.]"),
          collectionTitle: or(f.bookTitle, "[collection]"),
          collectionYear: s(f.year) || undefined,
          city: or(f.publisherCity, devDefaults.city) || "s.l.",
          publisher: cleanPublisher(or(f.publisher, devDefaults.publisher)) || "s.n.",
          firstPage: s(f.firstPage) || undefined,
          citedPage: s(f.pages) || undefined,
        });
        break;
      }

      case "collection-de-droit": {
        // Guide p. 109: the "année" is always the first of the two academic
        // years, and is mandatory even though it's already in academicYear.
        const cddFirstYear = s(f.academicYear).match(/\d{4}/)?.[0] || "";
        const cddYear = parseInt(cddFirstYear || "0");
        const cddDefaults = devPublisherByYear(cddYear);
        const cddSeries = ["Collection de droit", "Collection des habiletés", "Formation professionnelle", "C.F.P.B.Q."]
          .includes(s(f.seriesName)) ? (s(f.seriesName) as CollectionDeDroit["seriesName"]) : undefined;
        formatted = formatCollectionDeDroit({
          authors: parseAuthors(s(f.author)),
          studyTitle: required(f.title, "[titre]"),
          academicYear: or(f.academicYear, "[année universitaire]"),
          seriesName: cddSeries,
          volume: s(f.volume) || "",
          volumeTitle: or(f.bookTitle, "[titre du volume]"),
          city: or(f.publisherCity, cddDefaults.city) || "s.l.",
          publisher: cleanPublisher(or(f.publisher, cddDefaults.publisher)) || "s.n.",
          year: cddFirstYear || or(f.year, "s.d."),
          firstPage: s(f.firstPage) || undefined,
          citedPage: s(f.pages) || undefined,
          documentId: s(f.documentId) || undefined,
          pdfPage: s(f.pdfPage) || undefined,
          database: s(f.database) || undefined,
        });
        break;
      }

      case "repertoire-de-droit": {
        const rddSeries = ["Répertoire de droit", "R.D.", "Répertoire de droit/Nouvelle série", "R.D./N.S."]
          .includes(s(f.series)) ? (s(f.series) as RepertoireDeDroit["series"]) : undefined;
        formatted = formatRepertoireDeDroit({
          authors: parseAuthors(s(f.author)),
          studyTitle: required(f.title, "[titre]"),
          theme: or(f.theme, "[thème]"),
          documentNumber: or(f.documentNumber, "[n° de document]"),
          series: rddSeries,
          city: s(f.publisherCity) || undefined,
          year: or(f.year, "s.d."),
          paragraphNumber: s(f.paragraphNumbers) || undefined,
          page: s(f.pages) || undefined,
        });
        break;
      }

      case "annotated-code": {
        const acYear = parseInt(s(f.year) || "0");
        const acRawPub = or(f.publisher, "");
        const acPub = cleanPublisher(acRawPub) || "s.n.";
        let acCity = or(f.publisherCity, "");
        if (!acCity && acPub.toLowerCase().includes("yvon blais")) {
          acCity = yvonBlaisCity(acYear);
        }
        formatted = formatAnnotatedCode({
          authors: parseAuthors(s(f.author)),
          title: required(f.title, "[titre]"),
          edition: s(f.edition) || undefined,
          volume: s(f.volume) || undefined,
          collection: s(f.collection) || undefined,
          city: acCity || "s.l.",
          publisher: acPub,
          year: or(f.year, "s.d."),
          articleNumber: s(f.articleNumber) || undefined,
          paragraphNumbers: parseList(f.paragraphNumbers).length ? parseList(f.paragraphNumbers) : undefined,
          pages: parseList(f.pages).length ? parseList(f.pages) : undefined,
          online: (s(f.url) || s(f.database) || s(f.documentId))
            ? { url: s(f.url) || undefined, database: s(f.database) || undefined, documentId: s(f.documentId) || undefined }
            : undefined,
        });
        break;
      }

      case "dictionary-entry": {
        const dictAuthors = parseAuthors(s(f.author));
        const dictBase = {
          title: or(f.title, "[titre]"),
          edition: s(f.edition) || undefined,
          city: or(f.publisherCity, "s.l."),
          publisher: or(f.publisher, "s.n."),
          year: or(f.year, "s.d."),
        };
        const dictWork: Monograph | CollectiveWork = s(f.isDirector) === "yes"
          ? { ...dictBase, directors: dictAuthors }
          : { ...dictBase, authors: dictAuthors };
        formatted = formatDictionaryEntry({
          work: dictWork,
          entry: or(f.entry, "[expression]"),
          page: s(f.pages) || undefined,
          url: s(f.url) || undefined,
          database: s(f.database) || undefined,
        });
        break;
      }

      // ── JURISPRUDENCE ──────────────────────────────────────────────────────
      // Guide requires style of cause + citation reference
      // Missing party names → [demandeur] / [défendeur]
      // Missing court code → [tribunal]
      // Missing sequence number → [no]

      
      
      case "neutral":
      case "reported":
      case "database-case":
      case "canlii":
      case "soquij-az":
      case "eyb-rejb":
      case "quicklaw":
      case "westlaw": {
        // Guide p. 51 s. A.2 "L'intitulé thématique": some matters (family
        // law, constitutional renvois, etc.) are cited by theme instead of by
        // party names -- e.g. "Droit de la famille -- 08162, 2008 QCCS 285"
        // (guide p. 61). Use it whenever a theme is supplied.
        const style: StyleOfCause | ThematicCaption = s(f.theme)
          ? { theme: f.theme }
          : {
              plaintiff: or(f.plaintiff, "[demandeur]"),
              defendant: or(f.defendant, "[défendeur]"),
              connector: (f.connector === "v." ? "v." : f.connector === "et" ? "et" : "c.") as "c." | "v." | "et",
            };
        formatted = formatJurisprudenceReference(subtype, f, style, false, lang);

        // Guide p. 58, s. H: further references to the same decision, most
        // authoritative first, joined by commas. The style of cause is not
        // repeated on any of them.
        if (additionalReferences && additionalReferences.length > 0) {
          const extra = additionalReferences
            .filter(ref => isJurisprudenceReferenceType(ref.type))
            .map(ref => formatJurisprudenceReference(ref.type as JurisprudenceReferenceType, ref.fields || {}, style, true, lang));
          if (extra.length > 0) {
            formatted = formatParallelCitations({ primary: formatted, additional: extra });
          }
        }
        break;
      }

      case "unpublished-judicial":
        formatted = formatUnpublishedJudicialDecision({
          style: s(f.theme)
            ? { theme: f.theme }
            : {
                plaintiff: or(f.plaintiff, "[demandeur]"),
                defendant: or(f.defendant, "[défendeur]"),
              },
          courtInitials: or(f.courtCode, "[tribunal]"),
          district: or(f.court, "[district]"),
          docketNumber: or(f.sequenceNumber, "[no dossier]"),
          date: or(f.accessDate, "[date]"),
          // Guide p. 78: "jj." replaces "j." when more than one judge is named.
          judgeName: parseList(f.judgeName).length ? parseList(f.judgeName) : or(f.judgeName, "[juge]"),
          paragraph: s(f.paragraph) || undefined,
          page: s(f.pages) || undefined,
        });
        break;

      case "admin-decision":
        formatted = formatUnpublishedAdministrativeDecision({
          caption: or(f.title, "[intitulé]"),
          decisionNumber: s(f.decisionNumber) || undefined,
          // Guide p. 80: "décision" and "dossier(s)" are distinct fields --
          // e.g. "décision D-2005-216, dossier R-3555-2004" carries both.
          docketNumbers: parseList(f.sequenceNumber).length ? parseList(f.sequenceNumber) : undefined,
          showDocketNumeroPrefix: f.showDocketNumeroPrefix !== "no",
          date: or(f.accessDate, "[date]"),
          organization: or(f.publisher, "[organisme]"),
          url: s(f.url) || undefined,
        });
        break;

      case "special-bulletin":
        formatted = formatSpecialBulletinDecision({
          caption: or(f.title, "[intitulé]"),
          year: or(f.year, "[année]"),
          bulletinAbbreviation: or(f.reportAbbreviation, "[bulletin]"),
          volume: s(f.volume) || undefined,
          issueNumber: s(f.sequenceNumber) || undefined,
          page: s(f.pages) || undefined,
          organization: s(f.publisher) || undefined,
          url: s(f.url) || undefined,
        });
        break;

      case "conseil-magistrature":
        formatted = formatConseilMagistratureDecision({
          caption: or(f.title, "[intitulé]"),
          year: or(f.year, "[année]"),
          courtCode: (f.courtCode === "CMQC" ? "CMQC" : "QCCMAG") as "QCCMAG" | "CMQC",
          sequenceNumber: or(f.sequenceNumber, "[no]"),
          paragraph: s(f.paragraph) || undefined,
          note: s(f.note) || undefined,
        });
        break;

      // ── LÉGISLATION ────────────────────────────────────────────────────────
      // Legislation always has an official title and chapter — flag if missing

      case "consolidated-statute":
        formatted = formatConsolidatedStatute({
          kind: "consolidated",
          title: required(f.title, "[titre officiel]"),
          recueilAbbreviation: or(f.recueil, "RLRQ"),
          year: s(f.year) || undefined,
          chapter: or(f.chapter, "[chapitre]"),
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "annual-statute":
        formatted = formatAnnualStatute({
          kind: "annual",
          title: required(f.title, "[titre officiel]"),
          recueilAbbreviation: (or(f.recueil, "L.Q.") as "L.Q." | "L.C." | "S.Q." | "S.C."),
          year: or(f.year, "[année]"),
          chapter: or(f.chapter, "[chapitre]"),
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "bill":
        formatted = formatBill({
          projectedTitle: required(f.title, "[titre provisoire]"),
          billNumber: or(f.sequenceNumber, "[no]"),
          sessionOrdinal: or(f.volume, "[session]"),
          legislatureOrdinal: or(f.edition, "[législature]"),
          legislature: (or(f.court, "Qc") as "Can." | "Qc"),
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "parliamentary-debate":
        formatted = formatParliamentaryDebate({
          chamber: (or(f.chamber, "QUÉBEC, ASSEMBLÉE NATIONALE") as any),
          recueilTitle: or(f.title, "[Journal des débats]"),
          session: or(f.volume, "[session]"),
          legislature: or(f.edition, "[législature]"),
          date: or(f.accessDate, "[date]"),
          page: s(f.pages) || undefined,
          speaker: s(f.author) || undefined,
        });
        break;

      // ── RÉGLEMENTATION ─────────────────────────────────────────────────────

      case "federal-codified-reg":
        formatted = formatFederalCodifiedRegulation({
          title: required(f.title, "[titre officiel]"),
          chapterNumber: or(f.chapter, "[chapitre]"),
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "federal-gazette-reg":
        formatted = formatFederalGazetteRegulation({
          title: required(f.title, "[titre officiel]"),
          year: or(f.year, "[année]"),
          gazetteVolume: or(f.volume, "[vol.]"),
          dorsNumber: s(f.dorsNumber) || undefined,
          firstPage: s(f.firstPage) || undefined,
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "quebec-rlrq-reg":
        formatted = formatQuebecRLRQRegulation({
          title: required(f.title, "[titre officiel]"),
          chapter: or(f.chapter, "[chapitre]"),
          regulationNumber: s(f.regulationNumber) || undefined,
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "quebec-gazette-reg":
        formatted = formatQuebecGazetteRegulation({
          title: required(f.title, "[titre officiel]"),
          year: or(f.year, "[année]"),
          gazetteVolume: or(f.volume, "[vol.]"),
          decreeNumber: s(f.dorsNumber) || undefined,
          firstPage: s(f.firstPage) || undefined,
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
        });
        break;

      case "municipal-reg":
        formatted = formatMunicipalRegulation({
          title: required(f.title, "[titre]"),
          decisionMakingBody: or(f.publisher, "[organisme]"),
          regulationNumber: or(f.sequenceNumber, "[no]"),
          adoptedDate: s(f.year) || undefined,
          articles: parseList(f.pages).length ? parseList(f.pages) : undefined,
          url: s(f.url) || undefined,
        });
        break;

      default:
        return NextResponse.json({ error: "Type inconnu." }, { status: 400 });
    }

    // Year is mandatory for every jurisprudence type that carries one
    // (guide p. 58: neutral citations and reporter/database references
    // always need a year) — check the combined string, since a missing
    // year on an *additional* reference would otherwise slip through too.
    // "database-case" is deliberately excluded: it now also covers résumé
    // collections (J.E., EXP, D.T.E.…), which the guide never gives a year to.
    const YEAR_REQUIRED_TYPES = ["neutral", "reported", "canlii", "soquij-az", "quicklaw", "westlaw", "special-bulletin", "conseil-magistrature"];
    const involvedTypes = [subtype, ...(additionalReferences || []).map(r => r.type)];
    if (involvedTypes.some(t => YEAR_REQUIRED_TYPES.includes(t)) && formatted.includes("[année]")) {
      return NextResponse.json({
        error: lang === "fr"
          ? "L'année est requise pour les citations de jurisprudence."
          : "Year is required for case law citations.",
        field: "year"
      }, { status: 400 });
    }

    // Clean up any stray "undefined" that might slip through the library
    formatted = clean(formatted);

    // Per guide modifications p. 229: footnote citations must end with a period
    if (formatted && !formatted.endsWith(".")) {
      formatted += ".";
    }

    if (save) {
      const token = req.cookies.get("token")?.value;
      if (token) {
        const payload = verifyToken(token);
        if (payload) {
          await saveCitation({
            userId: payload.userId,
            style: "guidesQc",
            styleLabel: "Guide des références juridiques (Québec)",
            sourceType: subtype,
            inputData: f,
            formatted,
          });
        }
      }
    }

    return NextResponse.json({ formatted });
  } catch (err) {
    if (err instanceof CitationFieldError) {
      return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
    }
    console.error("QC citation error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Erreur lors de la génération." }, { status: 500 });
  }
}

  
