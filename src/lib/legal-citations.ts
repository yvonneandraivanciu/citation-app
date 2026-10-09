/**
 * legal-citations.ts
 *
 * TypeScript model of the citation rules from the "Guide des références
 * juridiques" (Quebec legal-writing citation guide). Covers the four main
 * families of sources: doctrine, jurisprudence, législation, réglementation.
 *
 * Each section exports:
 *  - one or more interfaces describing the data needed for that citation type
 *  - a `format*` function that renders a citation string following the
 *    guide's "morphologie" (field order, punctuation, italics markers, etc.)
 *
 * Notes on conventions used throughout:
 *  - SMALL CAPS surnames are represented in the formatted string as
 *    UPPERCASE, since plain strings/console output can't render small caps.
 *    Swap `.toUpperCase()` for a small-caps CSS class if rendering to HTML.
 *  - Italicized fields (titles, abbreviations, etc.) are wrapped in the
 *    ITALIC_OPEN/ITALIC_CLOSE markers below so callers can post-process them
 *    (e.g. replace with <em> tags, or strip for plain text).
 */

// ============================================================================
// SHARED HELPERS
// ============================================================================

export const ITALIC_OPEN = "<em>";
export const ITALIC_CLOSE = "</em>";

/** Wraps text in italic markers. */
function italic(text: string): string {
  return `${ITALIC_OPEN}${text}${ITALIC_CLOSE}`;
}

/**
 * Reduces a first name to its initial(s), guide-style: "Jean" -> "J.",
 * "Jean-Louis" -> "J.-L.", "Pierre-Gabriel" -> "P.-G." (guide p. 89-90,
 * 96 — hyphenated first names keep the hyphen, each part initialed).
 */
function initialsOf(firstName: string): string {
  return firstName
    .split("-")
    .map(part => `${part.charAt(0).toUpperCase()}.`)
    .join("-");
}

/** An individual author/director's name. */
export interface Author {
  /** Full given name(s), lowercase except the leading capital (e.g. "Jean-Louis"). */
  firstName: string;
  /** Family name, rendered in (small) capitals in the citation. */
  lastName: string;
}

/**
 * Renders a list of authors following the guide's rules:
 *  - On first mention, every author's full first name + surname is given.
 *  - On subsequent mentions, first names are reduced to an initial.
 *  - Up to three authors are named in full (comma-separated, "et" before the
 *    last); beyond three, only the first author is named, followed by "et al.".
 *  - Two authors are joined by "et" with no comma.
 */
export function formatAuthors(authors: Author[], firstMention = true): string {
  if (authors.length === 0) return "";

  const render = (a: Author): string => {
    const given = firstMention ? a.firstName : initialsOf(a.firstName);
    return `${given} ${a.lastName.toUpperCase()}`;
  };

  if (authors.length > 3) {
    return `${render(authors[0])} et al.`;
  }
  if (authors.length === 1) {
    return render(authors[0]);
  }
  const names = authors.map(render);
  const last = names.pop()!;
  return names.length > 0 ? `${names.join(", ")} et ${last}` : last;
}

/** Joins a list of pages/paragraphs using the guide's punctuation rules:
 *  a single item stands alone; two non-consecutive items are joined by
 *  "et"; a consecutive range uses a hyphen; more than two non-consecutive
 *  items are comma-separated with a final "et".
 */
export function formatPageList(items: string[], range = false): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (range) return items.join("-");
  if (items.length === 2) return items.join(" et ");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** Directors of a collective work, rendered "(dir.)" after their names. */
export function formatDirectors(directors: Author[]): string {
  if (directors.length === 0) return "";
  return `${formatAuthors(directors, true)} (dir.)`;
}

// ============================================================================
// I. DOCTRINE
// ============================================================================

/** A monograph (single-subject treatise or book), possibly multi-volume. */
export interface Monograph {
  authors: Author[];
  title: string;
  /** Subtitle, separated from the title by a period unless another punctuation mark is more natural. */
  subtitle?: string;
  /** Edition ordinal, e.g. "2e éd." Omit entirely for a first edition. */
  edition?: string;
  /** For re-editions completed by someone other than the original author: "par X". */
  editionBy?: Author;
  /** Tome and/or volume number, with an optional title of that specific tome (quoted). */
  tome?: { number: string; title?: string };
  volume?: string;
  /** Collection name, quoted: coll. « ... ». */
  collection?: string;
  city: string;
  publisher: string;
  year: string;
  /** Loose-leaf works: "feuilles mobiles, à jour [date]". */
  looseLeaf?: { upToDate: string };
  /** Secondary contributor(s): "avec la collab. de X". */
  collaborators?: Author[];
  paragraphNumbers?: string[];
  pages?: string[];
  online?: { database?: string; url?: string; documentId?: string };
}

export function formatMonograph(m: Monograph): string {
  const parts: string[] = [];
  const authorsStr = formatAuthors(m.authors, true);
  const collabStr = m.collaborators && m.collaborators.length > 0
    ? `avec la collab. de ${formatAuthors(m.collaborators, true)}`
    : "";

  if (authorsStr) parts.push(authorsStr + ",");
  // "avec la collab. de X" sits beside the main author when there is no
  // reediting author ("par X"); when there IS one, it sits right after
  // that clause instead (guide p. 96, s. III.A.2.e).
  if (collabStr && !m.editionBy) parts.push(collabStr + ",");

  let title = italic(m.title);
  if (m.subtitle) title += `. ${italic(m.subtitle)}`;
  parts.push(title + ",");

  if (m.edition) {
    let ed = m.edition;
    if (m.editionBy) ed += ` par ${initialsOf(m.editionBy.firstName)} ${m.editionBy.lastName.toUpperCase()}`;
    parts.push(ed + ",");
    if (collabStr && m.editionBy) parts.push(collabStr + ",");
  }

  if (m.tome) {
    let t = `t. ${m.tome.number}`;
    if (m.tome.title) t += ` «${m.tome.title}»`;
    parts.push(t + ",");
  }
  if (m.volume) parts.push(`vol. ${m.volume},`);
  if (m.collection) parts.push(`coll. «${m.collection}»,`);

  parts.push(`${m.city},`);
  parts.push(`${m.publisher},`);
  parts.push(m.looseLeaf ? `${m.year}, feuilles mobiles, à jour ${m.looseLeaf.upToDate}` : m.year);

  const tail: string[] = [];
  if (m.paragraphNumbers && m.paragraphNumbers.length > 0) {
    tail.push(`n° ${formatPageList(m.paragraphNumbers)}`);
  }
  if (m.pages && m.pages.length > 0) {
    tail.push(`p. ${formatPageList(m.pages)}`);
  }
  let result = parts.join(" ").replace(/,\s*$/, "");

  // Online sources: document id (if any) comes right after the base
  // citation, then paragraph/page pinpoints, then the database name in
  // parens "à la fin de la référence" (guide p. 97), then the URL.
  if (m.online?.documentId) result += `, ${m.online.documentId}`;
  if (tail.length > 0) result += `, ${tail.join(", ")}`;
  if (m.online?.database) result += ` (${m.online.database})`;
  if (m.online?.url) result += `, en ligne: <${m.online.url}>`;

  return result;
}

/** A collective work (edited volume, conference proceedings, mélanges, etc.). */
export interface CollectiveWork {
  directors?: Author[];
  title: string;
  subtitle?: string;
  edition?: string;
  tome?: { number: string; title?: string };
  volume?: string;
  collection?: string;
  city: string;
  publisher: string;
  year: string;
  looseLeaf?: { upToDate: string };
}

export function formatCollectiveWork(w: CollectiveWork): string {
  const parts: string[] = [];
  if (w.directors && w.directors.length > 0) parts.push(formatDirectors(w.directors) + ",");

  let title = italic(w.title);
  if (w.subtitle) title += `. ${italic(w.subtitle)}`;
  parts.push(title + ",");

  if (w.edition) parts.push(w.edition + ",");
  if (w.tome) {
    let t = `t. ${w.tome.number}`;
    if (w.tome.title) t += ` «${w.tome.title}»`;
    parts.push(t + ",");
  }
  if (w.volume) parts.push(`vol. ${w.volume},`);
  if (w.collection) parts.push(`coll. «${w.collection}»,`);
  parts.push(`${w.city},`);
  parts.push(`${w.publisher},`);
  parts.push(w.looseLeaf ? `${w.year}, feuilles mobiles, à jour ${w.looseLeaf.upToDate}` : w.year);
  return parts.join(" ").replace(/,\s*$/, "");
}

/** A study/chapter/article published inside a collective work ("dans ..."). */
export interface StudyInCollectiveWork {
  authors: Author[];
  studyTitle: string;
  collectiveWork: CollectiveWork;
  /** First page of the study within the collective work. */
  firstPage?: string;
  /** Specific page(s) cited, preceded by "à la p." / "aux p." */
  citedPages?: string[];
  paragraphNumber?: string;
}

export function formatStudyInCollectiveWork(s: StudyInCollectiveWork): string {
  const auth = formatAuthors(s.authors, true);
  let result = auth ? `${auth}, «${s.studyTitle}», dans ${formatCollectiveWork(s.collectiveWork)}` : `«${s.studyTitle}», dans ${formatCollectiveWork(s.collectiveWork)}`;
  if (s.firstPage) result += `, p. ${s.firstPage}`;
  if (s.citedPages && s.citedPages.length > 0) {
    const label = s.citedPages.length > 1 ? "aux p." : "à la p.";
    result += `, ${label} ${formatPageList(s.citedPages)}`;
  }
  if (s.paragraphNumber) result += ` (n° ${s.paragraphNumber})`;
  return result;
}

/** A periodical (journal) article, print or electronic. */
export interface PeriodicalArticle {
  authors: Author[];
  title: string;
  /** Year of publication, always parenthesized: (1985). */
  year: string;
  /** Volume number; append "-N" for a fascicule number when pages restart per fascicule. */
  volume?: string;
  /** Journal name abbreviation, italicized. */
  journalAbbreviation: string;
  /** Series number of the journal, in parentheses, not italicized. */
  seriesNumber?: string;
  firstPage: string;
  citedPages?: string[];
  /** For articles with continuously numbered paragraphs: "(n° X)". */
  paragraphNumber?: string;
  online?: { database?: string; url?: string; pdfPage?: string; documentId?: string };
}

export function formatPeriodicalArticle(a: PeriodicalArticle): string {
  const auth = formatAuthors(a.authors, true);
  let result = auth ? `${auth}, «${a.title}», (${a.year}) ` : `«${a.title}», (${a.year}) `;
  if (a.volume) result += `${a.volume} `;
  result += italic(a.journalAbbreviation);
  if (a.seriesNumber) result += ` (${a.seriesNumber})`;
  result += ` ${a.firstPage}`;
  if (a.citedPages && a.citedPages.length > 0) {
    result += `, ${formatPageList(a.citedPages)}`;
  }
  if (a.paragraphNumber) result += ` (n° ${a.paragraphNumber})`;
  // Online sources: document id first, then the PDF page pinpoint, then
  // the database name in parens "à la fin de la référence" (guide p. 97),
  // then the URL.
  if (a.online?.documentId) result += `, ${a.online.documentId}`;
  if (a.online?.pdfPage) result += `, p. ${a.online.pdfPage} (PDF)`;
  if (a.online?.database) result += ` (${a.online.database})`;
  if (a.online?.url) result += `, en ligne: <${a.online.url}>`;
  return result;
}

// ============================================================================
// II. JURISPRUDENCE
// ============================================================================

/** Style of cause: the parties to the case, joined by "c." (or "v." in English-language reports). */
export interface StyleOfCause {
  plaintiff: string;
  defendant: string;
  /**
   * Use "v." for a case reported in an English-language source, "c."
   * otherwise. Some administrative decisions replace "c." with "et"
   * instead (guide p. 49 -- e.g. "Carlo Destin et Agence de personnel
   * Rive-Sud 2000... (C.L.P.)", guide p. 57).
   */
  connector?: "c." | "v." | "et";
}

function formatStyleOfCause(s: StyleOfCause): string {
  return `${italic(s.plaintiff)} ${s.connector ?? "c."} ${italic(s.defendant)}`;
}

/**
 * Shared by every jurisprudence formatter below: when a decision has more
 * than one citation (guide p. 58, s. H "Les références parallèles"), the
 * style of cause is only given once — set omitStyle on every reference
 * after the first so the caller can join them with formatParallelCitations
 * without repeating the party names. Ex.: "Harper v. Canada (Attorney
 * General), 2001 ABQB 558, (2001) 93 Alta. L.R. (3d) 281 (Q.B.), [2001]
 * A.J. No. 808 (LAd/QL)" — only the first fragment carries the style.
 */
export interface CitationFormatOptions {
  omitStyle?: boolean;
}

/** A decision published in a print reporter (recueil), jurisdictional or not. */
export interface ReportedCase {
  /** A two-party style of cause, or a thematic caption (guide p. 51, s. A.2 --
   * e.g. "Droit de la famille -- 08162") when the matter has no named parties. */
  style: StyleOfCause | ThematicCaption;
  /** Year of the reporter volume. Square brackets [1998] when the year identifies the volume, parentheses (1985) when it doesn't. */
  year: string;
  yearBrackets: "[]" | "()";
  /**
   * Only meaningful when yearBrackets is "()" (a parenthetical year tied to
   * a continuously-numbered volume — guide p. 52, "Exemples 2"). Civilist
   * editors place the year after the comma (the default); most common law
   * (English-language) editors place it before the comma, right after the
   * style of cause — e.g. "R. v. Talbourdet (1984), 12 C.C.C. (3d) 173"
   * vs. "Villard c. Mercier, (1935) 73 C.S. 51". Leave unset to infer from
   * style.connector ("v." => beforeComma), or force it explicitly.
   */
  yearPosition?: "afterComma" | "beforeComma";
  volume?: string;
  /** Reporter abbreviation, italicized only when the reporter is a doctrinal journal reproducing the decision. */
  reportAbbreviation: string;
  reportIsJournal?: boolean;
  /** Series number of the reporter, e.g. "(2d)". */
  seriesNumber?: string;
  firstPage: string;
  citedPages?: string[];
  paragraphs?: string[];
  /** Court identifier in parentheses — required for non-jurisdictional reporters. */
  court?: string;
  /**
   * Guide p. 51, s. B: when more than three years separate the year of
   * publication (above) from the year the decision was actually rendered,
   * the decision's own year may be given in parentheses right after the
   * style of cause, before the comma — e.g. "Lazanik c. Ford Motor Co. of
   * Canada (1965), [1977] R.L. 262 (C.S.)". Omit otherwise.
   */
  decisionYear?: string;
  /**
   * Guide p. 71: flags a résumé of the decision reproduced inside a reporter
   * that otherwise publishes full-text decisions (as opposed to a dedicated
   * résumé collection like J.E.) -- adds "(rés.)" right before the court
   * parenthesis, e.g. "[2005] R.R.A. 1299 (rés.) (C.Q.)".
   */
  isSummary?: boolean;
  /**
   * Guide p. 70, s. 2: when the decision is followed or preceded by
   * doctrinal commentary in the same journal issue, appends
   * ", commentaires [author], id., [page]" -- e.g. "(1994) 28 R.J.T. 300
   * (C.S.), commentaires A. Popovici, id., 289".
   */
  commentary?: { author: string; page: string };
}

export function formatReportedCase(c: ReportedCase, opts?: CitationFormatOptions): string {
  const [open, close] = c.yearBrackets === "[]" ? ["[", "]"] : ["(", ")"];

  // Guide p. 52, "Exemples 2": only applies to the parenthetical,
  // continuously-numbered-volume case — bracketed years always go after
  // the comma regardless of tradition (guide p. 52, "Exemples 1").
  const styleConnector = "connector" in c.style ? c.style.connector : undefined;
  const commonLawYear = !c.decisionYear && c.yearBrackets === "()" &&
    (c.yearPosition ? c.yearPosition === "beforeComma" : styleConnector === "v.");

  const style = opts?.omitStyle ? "" : `${formatCaption(c.style)} `;

  // The comma here separates the style of cause (plus any year sitting
  // next to it) from the volume/recueil/page that follows — e.g. "Villard
  // c. Mercier, (1935) 73 C.S. 51" or "R. v. Talbourdet (1984), 12 C.C.C.
  // (3d) 173". With no style of cause (a parallel-citation fragment, guide
  // p. 58 s. H — e.g. "(2001) 93 Alta. L.R. (3d) 281"), there's nothing to
  // separate from on the left, so that comma is dropped.
  let result: string;
  if (c.decisionYear) {
    result = opts?.omitStyle
      ? `(${c.decisionYear}) ${open}${c.year}${close} `
      : `${style}(${c.decisionYear}), ${open}${c.year}${close} `;
  } else if (commonLawYear) {
    result = opts?.omitStyle
      ? `(${c.year}) `
      : `${style}(${c.year}), `;
  } else {
    result = opts?.omitStyle
      ? `${open}${c.year}${close} `
      : `${formatCaption(c.style)}, ${open}${c.year}${close} `;
  }

  if (c.volume) result += `${c.volume} `;
  result += c.reportIsJournal ? italic(c.reportAbbreviation) : c.reportAbbreviation;
  if (c.seriesNumber) result += ` (${c.seriesNumber})`;
  result += ` ${c.firstPage}`;

  const pinpoints: string[] = [];
  if (c.citedPages && c.citedPages.length > 0) pinpoints.push(formatPageList(c.citedPages));
  if (c.paragraphs && c.paragraphs.length > 0) pinpoints.push(`par. ${formatPageList(c.paragraphs)}`);
  if (pinpoints.length > 0) result += `, ${pinpoints.join(", ")}`;

  if (c.isSummary) result += ` (rés.)`;
  if (c.court) result += ` (${c.court})`;
  if (c.commentary) result += `, commentaires ${c.commentary.author}, id., ${c.commentary.page}`;
  return result;
}

/**
 * A neutral citation: the official, unique, permanent identifier assigned
 * directly by the deciding court/tribunal, independent of any reporter.
 * Should be preferred over a reporter citation whenever available.
 */
export interface NeutralCitationCase {
  style: StyleOfCause | ThematicCaption;
  year: string;
  /** Court code: federal courts use a plain abbreviation (e.g. "CSC", "CAF");
   *  provincial/territorial courts prefix the province/territory code
   *  (e.g. "QCCA", "QCCS", "ABQB"). No periods, no spaces. */
  courtCode: string;
  sequenceNumber: string;
  paragraph?: string;
}

export function formatNeutralCitationCase(c: NeutralCitationCase, opts?: CitationFormatOptions): string {
  let result = opts?.omitStyle
    ? `${c.year} ${c.courtCode} ${c.sequenceNumber}`
    : `${formatCaption(c.style)}, ${c.year} ${c.courtCode} ${c.sequenceNumber}`;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  return result;
}

/** A decision available only through a legal database or website (no print reporter). */
export interface DatabaseCase {
  style: StyleOfCause | ThematicCaption;
  /**
   * Omit for a résumé-collection reference (e.g. J.E., EXP, D.T.E.) -- the
   * year is embedded in the document number itself and no separate year is
   * shown (guide pp. 54, 56, 58: "J.E. 83-851", "J.E. 2003-316", "J.E.
   * 2005-1144"). Provide a year (with yearBrackets) only for a database
   * whose morphology calls for one shown separately.
   */
  year?: string;
  /**
   * "none" gives a bare year with no wrapping -- guide p. 71's EXP example,
   * "2014 EXP-1495 (T.A.Q.)" -- as opposed to a résumé collection's usual
   * bracketed year (or, more often, no year at all -- see `year` above).
   */
  yearBrackets?: "[]" | "()" | "none";
  /** Database identifier, e.g. "AZ", or a resumé-collection abbreviation like "J.E.", "EXP", "D.T.E." Leave empty when it's folded into documentNumber instead. */
  databaseAbbreviation: string;
  documentNumber: string;
  /** Paragraph number is preferred; page number (with "PDF") only for older decisions lacking paragraph numbering. */
  paragraph?: string;
  pdfPage?: string;
  court?: string;
}

export function formatDatabaseCase(c: DatabaseCase, opts?: CitationFormatOptions): string {
  let yearPart = "";
  if (c.year) {
    if (c.yearBrackets === "none") {
      yearPart = `${c.year} `;
    } else {
      const [open, close] = c.yearBrackets === "()" ? ["(", ")"] : ["[", "]"];
      yearPart = `${open}${c.year}${close} `;
    }
  }
  const abbrevPart = c.databaseAbbreviation ? `${c.databaseAbbreviation} ` : "";
  let result = opts?.omitStyle
    ? `${yearPart}${abbrevPart}${c.documentNumber}`
    : `${formatCaption(c.style)}, ${yearPart}${abbrevPart}${c.documentNumber}`;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  else if (c.pdfPage) result += `, p. ${c.pdfPage}`;
  if (c.court) result += ` (${c.court})`;
  return result;
}

// ============================================================================
// III. LÉGISLATION
// ============================================================================

/** A statute as it appears in a consolidated compilation (RLRQ, L.R.C., L.R.Q., S.R.C., etc.). */
export interface ConsolidatedStatute {
  kind: "consolidated";
  title: string;
  /** Abbreviation of the consolidated compilation, e.g. "RLRQ", "L.R.C.", "L.R.Q.", "S.R.C.". */
  recueilAbbreviation: string;
  /** Year of the revision/consolidation. Required for L.R.C./S.R.C.-style recueils; RLRQ has no year. */
  year?: string;
  chapter: string;
  /** Supplement indicator for federal recueils, e.g. "(2e supp.)". */
  supplement?: string;
  articles?: string[];
}

export function formatConsolidatedStatute(s: ConsolidatedStatute): string {
  let result = `${italic(s.title)}, ${s.recueilAbbreviation}`;
  if (s.year) result += s.recueilAbbreviation.includes(" ") ? `, ${s.year}` : ` ${s.year}`;
  result += `, c. ${s.chapter}`;
  if (s.supplement) result += ` ${s.supplement}`;
  if (s.articles && s.articles.length > 0) result += `, art. ${formatPageList(s.articles)}`;
  return result;
}

/** A statute as originally published in an annual compilation (L.Q., L.C., S.Q., S.C.). */
export interface AnnualStatute {
  kind: "annual";
  title: string;
  recueilAbbreviation: "L.Q." | "L.C." | "S.Q." | "S.C.";
  year: string;
  chapter: string;
  articles?: string[];
}

export function formatAnnualStatute(s: AnnualStatute): string {
  let result = `${italic(s.title)}, ${s.recueilAbbreviation} ${s.year}, c. ${s.chapter}`;
  if (s.articles && s.articles.length > 0) result += `, art. ${formatPageList(s.articles)}`;
  return result;
}

/** A bill (projet de loi) before the National Assembly or Parliament. */
export interface Bill {
  /** Working title of the bill as introduced. */
  projectedTitle: string;
  billNumber: string;
  /** Legislative stage reached, and the date it was reached, e.g. "2e lecture - 4 mai 2018". */
  stage?: string;
  /** Session ordinal only, e.g. "2e" — the guide's "sess." abbreviation (guide p. 15-16) is added automatically. */
  sessionOrdinal: string;
  /** Legislature ordinal only, e.g. "35e" — the guide's "légis." abbreviation is added automatically. */
  legislatureOrdinal: string;
  /** "Can." for federal bills, "Qc" for Quebec bills. */
  legislature: "Can." | "Qc";
  articles?: string[];
}

export function formatBill(b: Bill): string {
  let result = `${italic(b.projectedTitle)}, projet de loi n° ${b.billNumber}`;
  if (b.stage) result += ` (${b.stage})`;
  result += `, ${b.sessionOrdinal} sess., ${b.legislatureOrdinal} légis. (${b.legislature})`;
  if (b.articles && b.articles.length > 0) result += `, art. ${formatPageList(b.articles)}`;
  return result;
}

/** A statute together with the law that amended, repealed, or replaced it. */
export interface AmendedStatute {
  original: ConsolidatedStatute | AnnualStatute;
  /**
   * Grammatical gender of the enactment named in `original`, which controls
   * the verb's agreement: "feminin" for a loi (the default — "modifiée"),
   * "masculin" for a Code or règlement cited via the same statute shape
   * ("modifié"). Codes are technically ordinary statutes (guide p. 14) but
   * "Code", like "règlement", is masculine.
   */
  originalGender?: "feminin" | "masculin";
  /** How the original was affected (gender-neutral key; agreement is computed from `originalGender`). */
  relation: "modifiee" | "abrogee" | "remplacee";
  by: ConsolidatedStatute | AnnualStatute;
  /**
   * Grammatical gender of the enactment named in `by`, which controls the
   * article before it: "par la" for a loi (the default), "par le" for a
   * Code or règlement.
   */
  byGender?: "feminin" | "masculin";
}

function formatEitherStatute(s: ConsolidatedStatute | AnnualStatute): string {
  return s.kind === "consolidated" ? formatConsolidatedStatute(s) : formatAnnualStatute(s);
}

const AMENDMENT_RELATION_WORDS: Record<AmendedStatute["relation"], { feminin: string; masculin: string }> = {
  modifiee: { feminin: "modifiée", masculin: "modifié" },
  abrogee: { feminin: "abrogée", masculin: "abrogé" },
  remplacee: { feminin: "remplacée", masculin: "remplacé" },
};

export function formatAmendedStatute(a: AmendedStatute): string {
  const originalGender = a.originalGender ?? "feminin";
  const byGender = a.byGender ?? "feminin";
  const relationWord = AMENDMENT_RELATION_WORDS[a.relation][originalGender];
  const article = byGender === "masculin" ? "le" : "la";
  return `${formatEitherStatute(a.original)}, ${relationWord} par ${article} ${formatEitherStatute(a.by)}`;
}

// ============================================================================
// IV. RÉGLEMENTATION
// ============================================================================

/** A federal regulation consolidated in the Codification des règlements du Canada (C.R.C.). */
export interface FederalCodifiedRegulation {
  title: string;
  chapterNumber: string;
  articles?: string[];
}

export function formatFederalCodifiedRegulation(r: FederalCodifiedRegulation): string {
  let result = `${italic(r.title)}, C.R.C., c. ${r.chapterNumber}`;
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  return result;
}

/** A federal regulation published in the Canada Gazette, Part II, after the 1978 codification. */
export interface FederalGazetteRegulation {
  title: string;
  year: string;
  /** Annual volume number of the Gazette (not the fascicule/issue number). */
  gazetteVolume: string;
  firstPage?: string;
  /** Alternative identifier: "DORS/année-n°" (SOR/year-no). */
  dorsNumber?: string;
  articles?: string[];
}

export function formatFederalGazetteRegulation(r: FederalGazetteRegulation): string {
  let result: string;
  if (r.dorsNumber) {
    result = `${italic(r.title)}, ${r.dorsNumber} (Gaz. Can. II)`;
  } else {
    result = `${italic(r.title)}, (${r.year}) ${r.gazetteVolume} Gaz. Can. II, ${r.firstPage ?? ""}`.trim();
  }
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  return result;
}

/** A Quebec regulation integrated into the Recueil des lois et des règlements du Québec (RLRQ). */
export interface QuebecRLRQRegulation {
  title: string;
  /** Alphanumeric chapter of the enabling statute, e.g. "J-3", "CCQ". */
  chapter: string;
  /** Sequential regulation number under that chapter, e.g. "r. 3". Omit if there is only one regulation under the chapter. */
  regulationNumber?: string;
  articles?: string[];
}

export function formatQuebecRLRQRegulation(r: QuebecRLRQRegulation): string {
  let result = `${italic(r.title)}, RLRQ, c. ${r.chapter}`;
  if (r.regulationNumber) result += `, ${r.regulationNumber}`;
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  return result;
}

/** A Quebec regulation cited via the Gazette officielle du Québec, Part II (e.g. amending regulations not folded into the RLRQ). */
export interface QuebecGazetteRegulation {
  title: string;
  year: string;
  gazetteVolume: string;
  firstPage?: string;
  /** Alternative identifier: "D. n-année" (decree number-year). */
  decreeNumber?: string;
  articles?: string[];
}

export function formatQuebecGazetteRegulation(r: QuebecGazetteRegulation): string {
  let result: string;
  if (r.decreeNumber) {
    result = `${italic(r.title)}, ${r.decreeNumber} (G.O. II)`;
  } else {
    result = `${italic(r.title)}, (${r.year}) ${r.gazetteVolume} G.O. II ${r.firstPage ?? ""}`.trim();
  }
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  return result;
}

// ============================================================================
// V. CAS PARTICULIERS DE LA DOCTRINE
// ============================================================================

/**
 * Congrès annuel du Barreau du Québec. Through 2006, published in print
 * (city + publisher). From 2007 on, texts are electronic-only (CAIJ), so
 * city/publisher are omitted and a URL is typically given instead.
 */
export interface BarreauCongress {
  authors: Author[];
  studyTitle: string;
  /** Year of the congress, given in parentheses right after "Congrès annuel du Barreau du Québec". */
  year: string;
  city?: string;
  publisher?: string;
  firstPage?: string;
  citedPage?: string;
  url?: string;
}

export function formatBarreauCongress(c: BarreauCongress): string {
  const auth = formatAuthors(c.authors, true);
  let result = auth ? `${auth}, «${c.studyTitle}», dans S.F.P.B.Q., Congrès annuel du Barreau du Québec (${c.year})` : `«${c.studyTitle}», dans S.F.P.B.Q., Congrès annuel du Barreau du Québec (${c.year})`;
  if (c.city && c.publisher) result += `, ${c.city}, ${c.publisher}`;
  if (c.firstPage) result += `, p. ${c.firstPage}`;
  if (c.citedPage) result += `, à la p. ${c.citedPage}`;
  if (c.url) result += `, en ligne: <${c.url}>`;
  return result;
}

/**
 * "Développements récents en ..." series (S.F.P.B.Q. / S.F.C.B.Q.). The
 * collection year can appear in parentheses right after the collection
 * title, OR as a plain year after the publisher — the guide treats these as
 * alternatives, so supply whichever applies and leave the other undefined.
 */
export interface DeveloppementsRecents {
  authors: Author[];
  studyTitle: string;
  seriesLabel?: "S.F.P.B.Q." | "S.F.C.B.Q.";
  volume: string;
  collectionTitle: string;
  /** Year in parentheses after the collection title (used when not repeated after the publisher). */
  collectionYear?: string;
  city: string;
  publisher: string;
  /** Plain year after the publisher (omit if collectionYear is already given). */
  year?: string;
  firstPage?: string;
  citedPage?: string;
  documentId?: string;
  pdfPage?: string;
  database?: string;
}

export function formatDeveloppementsRecents(d: DeveloppementsRecents): string {
  const auth = formatAuthors(d.authors, true);
  let result = auth ? `${auth}, «${d.studyTitle}», dans ${d.seriesLabel ?? "S.F.P.B.Q."}, vol. ${d.volume}, ${italic(d.collectionTitle)}` : `«${d.studyTitle}», dans ${d.seriesLabel ?? "S.F.P.B.Q."}, vol. ${d.volume}, ${italic(d.collectionTitle)}`;
  if (d.collectionYear) result += ` (${d.collectionYear})`;
  result += `, ${d.city}, ${d.publisher}`;
  if (d.year) result += `, ${d.year}`;
  if (d.documentId) result += `, ${d.documentId}`;
  if (d.firstPage) result += `, p. ${d.firstPage}`;
  if (d.citedPage) result += `, à la p. ${d.citedPage}`;
  if (d.pdfPage) result += `, p. ${d.pdfPage} (PDF)`;
  if (d.database) result += ` (${d.database})`;
  return result;
}

/**
 * "Collection de droit" (École du Barreau du Québec), 1989–present, or its
 * predecessor "Formation professionnelle" / "C.F.P.B.Q." for 1978–1989.
 */
export interface CollectionDeDroit {
  authors: Author[];
  studyTitle: string;
  /** Academic year(s) the volume covers, e.g. "1994-1995". */
  academicYear: string;
  seriesName?: "Collection de droit" | "Collection des habiletés" | "Formation professionnelle" | "C.F.P.B.Q.";
  volume: string;
  volumeTitle: string;
  city: string;
  publisher: string;
  /** The (first) year of academicYear, repeated here: guide p. 109 notes
   *  this is always mandatory even though it's already given above. */
  year: string;
  firstPage?: string;
  citedPage?: string;
  documentId?: string;
  /** PDF page pinpoint when no paragraph numbers are available (guide p. 110). */
  pdfPage?: string;
  database?: string;
}

export function formatCollectionDeDroit(c: CollectionDeDroit): string {
  const series = c.seriesName ?? "Collection de droit";
  // "École du Barreau du Québec" for the modern series names, "Barreau du
  // Québec" for the old "Formation professionnelle" name, and omitted
  // entirely for the abbreviated "C.F.P.B.Q." form (guide p. 109-110).
  const institution =
    series === "C.F.P.B.Q." ? "" :
    series === "Formation professionnelle" ? "Barreau du Québec, " :
    "École du Barreau du Québec, ";
  let result = `${formatAuthors(c.authors, true)}, «${c.studyTitle}», dans ${series} ${c.academicYear}, ${institution}`;
  result += `${c.volume === "" ? "" : `vol. ${c.volume}, `}${italic(c.volumeTitle)}, ${c.city}, ${c.publisher}, ${c.year}`;
  if (c.documentId) result += `, ${c.documentId}`;
  if (c.firstPage) result += `, p. ${c.firstPage}`;
  if (c.citedPage) result += `, à la p. ${c.citedPage}`;
  if (c.pdfPage) result += `, p. ${c.pdfPage} (PDF)`;
  if (c.database) result += ` (${c.database})`;
  return result;
}

/**
 * Chambre des notaires du Québec: Répertoire de droit (through 1993) or its
 * successor Répertoire de droit/Nouvelle série ("R.D." / "R.D/N.S.").
 * Modern doctrine from this source is increasingly published as an ordinary
 * monograph (use `Monograph` + `collection` instead) — this type is for the
 * older fascicule-style references.
 */
export interface RepertoireDeDroit {
  authors: Author[];
  /** Study title — italicized (not quoted) for this source, guide p. 111-112. */
  studyTitle: string;
  theme: string;
  documentNumber: string;
  series?: "Répertoire de droit" | "R.D." | "Répertoire de droit/Nouvelle série" | "R.D./N.S.";
  city?: string;
  year: string;
  paragraphNumber?: string;
  page?: string;
}

export function formatRepertoireDeDroit(r: RepertoireDeDroit): string {
  const series = r.series ?? "R.D./N.S.";
  let result = `${formatAuthors(r.authors, true)}, ${italic(r.studyTitle)}, ${series}, «${r.theme}», Doctrine – Document ${r.documentNumber}, ${r.city ?? "Montréal"}, Chambre des notaires du Québec, ${r.year}`;
  if (r.paragraphNumber) result += `, n° ${r.paragraphNumber}`;
  if (r.page) result += `, p. ${r.page}`;
  return result;
}

/**
 * Note — studies from the Cours de perfectionnement du notariat are cited
 * exactly as ordinary periodical articles; use `formatPeriodicalArticle`
 * with the journal abbreviation "C.P. du N.".
 */

/** An unpublished doctoral thesis or master's memoir. Published theses/memoirs are cited exactly as ordinary monographs — use `Monograph` for those. */
export interface UnpublishedThesis {
  authors: Author[];
  title: string;
  degreeType: "thèse de doctorat" | "mémoire de maîtrise";
  city: string;
  faculty: string;
  university: string;
  year: string;
  pages?: string[];
  paragraphNumbers?: string[];
}

export function formatUnpublishedThesis(t: UnpublishedThesis): string {
  const auth = formatAuthors(t.authors, true);
  let result = auth
    ? `${auth}, ${italic(t.title)}, ${t.degreeType}, ${t.city}, ${t.faculty}, ${t.university}, ${t.year}`
    : `${italic(t.title)}, ${t.degreeType}, ${t.city}, ${t.faculty}, ${t.university}, ${t.year}`;
  const tail: string[] = [];
  if (t.paragraphNumbers && t.paragraphNumbers.length > 0) tail.push(`n° ${formatPageList(t.paragraphNumbers)}`);
  if (t.pages && t.pages.length > 0) tail.push(`p. ${formatPageList(t.pages)}`);
  if (tail.length > 0) result += `, ${tail.join(", ")}`;
  return result;
}

/**
 * An annotated code or statute (e.g. "Code civil du Québec annoté"). Same
 * morphology as a monograph, with an added pinpoint to the specific
 * annotated article.
 */
export interface AnnotatedCode extends Omit<Monograph, "paragraphNumbers" | "pages"> {
  articleNumber?: string;
  paragraphNumbers?: string[];
  pages?: string[];
}

export function formatAnnotatedCode(a: AnnotatedCode): string {
  const { articleNumber, paragraphNumbers, pages, online, ...rest } = a;
  // Compute the base monograph citation WITHOUT its online block, so the
  // annotated pinpoint (art./n°/p.) can be inserted before it — the
  // database name always stays "à la fin de la référence" (guide p. 97).
  const base = formatMonograph({ ...(rest as Monograph), online: undefined });
  const tail: string[] = [];
  if (articleNumber) tail.push(`art. ${articleNumber}`);
  if (paragraphNumbers && paragraphNumbers.length > 0) tail.push(`n° ${formatPageList(paragraphNumbers)}`);
  if (pages && pages.length > 0) tail.push(`p. ${formatPageList(pages)}`);
  let result = tail.length > 0 ? `${base}, ${tail.join(", ")}` : base;
  if (online?.documentId) result += `, ${online.documentId}`;
  if (online?.database) result += ` (${online.database})`;
  if (online?.url) result += `, en ligne: <${online.url}>`;
  return result;
}

/**
 * A dictionary or encyclopedia entry. Cited as an ordinary monograph or
 * collective work, with the headword quoted at the end. If consulted online
 * with no page/paragraph numbers available, give just the headword.
 */
export interface DictionaryEntry {
  work: Monograph | CollectiveWork;
  /** The headword/expression looked up, quoted. */
  entry: string;
  page?: string;
  url?: string;
  database?: string;
}

export function formatDictionaryEntry(d: DictionaryEntry): string {
  const base = "authors" in d.work ? formatMonograph(d.work) : formatCollectiveWork(d.work);
  let result = `${base}, «${d.entry}»`;
  if (d.page) result += `, p. ${d.page}`;
  if (d.url) result += `, en ligne: <${d.url}>`;
  if (d.database) result += ` (${d.database})`;
  return result;
}

/**
 * Recueils de cours (university course notes/materials, e.g. via a campus
 * co-op bookstore). The guide gives no special morphology for these beyond
 * an ordinary monograph, so this is simply an alias — use `formatMonograph`.
 */
export type CourseNotes = Monograph;

/** A blog post or newspaper article. */
export interface BlogOrNewspaperArticle {
  author: Author;
  title: string;
  /** Publication/blog name, e.g. "Le Devoir", "Blogue Soquij". */
  source: string;
  /** Publication date as it should read in the citation, e.g. "13 juillet 2017" or "27 et 28 mai 2017". */
  date: string;
  /** For newspapers with a special section, e.g. "Cahier thématique I". */
  specialSection?: string;
  page?: string;
  url?: string;
}

export function formatBlogOrNewspaperArticle(a: BlogOrNewspaperArticle): string {
  const auth = (a.author.firstName || a.author.lastName) ? formatAuthors([a.author], true) : "";
  let result = auth
    ? `${auth}, «${a.title}», ${italic(a.source)}, ${a.date}`
    : `«${a.title}», ${italic(a.source)}, ${a.date}`;
  if (a.specialSection) result += `, ${a.specialSection}`;
  if (a.page) result += `, p. ${a.page}`;
  if (a.url) result += `, en ligne: <${a.url}>`;
  return result;
}

// ============================================================================
// VI. JURISPRUDENCE — CAS PARTICULIERS ET RÈGLES COMPLÉMENTAIRES
// ============================================================================

/** Province/territory abbreviations, used in parentheses after a citation whenever
 * the reporter or database abbreviation doesn't already identify the jurisdiction. */
export const PROVINCE_TERRITORY_ABBREVIATIONS: Record<string, string> = {
  Alberta: "Alta.",
  "British Columbia": "B.C.",
  "Prince Edward Island": "P.E.I.",
  Manitoba: "Man.",
  "Nouveau-Brunswick": "N.B.",
  "Nova Scotia": "N.S.",
  Nunavut: "Nu.",
  Ontario: "Ont.",
  Québec: "Q.",
  Saskatchewan: "Sask.",
  "Newfoundland & Labrador": "Nfld.",
  "Northwest Territories": "N.T.",
  Yukon: "Y.",
};

/**
 * A thematic style of cause, used instead of party names when the subject
 * matter itself identifies the case (family law confidentiality, reference
 * questions, etc.) — e.g. "Droit de la famille - 073237", "Renvoi relatif à
 * la Chambre haute".
 */
export interface ThematicCaption {
  theme: string;
}

/** Formats either an ordinary two-party style of cause or a thematic caption. */
export function formatCaption(c: StyleOfCause | ThematicCaption): string {
  return "theme" in c ? italic(c.theme) : formatStyleOfCause(c);
}

/**
 * A judge's name and, when relevant, whether their reasons were majority,
 * dissenting, or concurring. Only needed when pinpointing a page/paragraph
 * on a multi-judge bench and the passage cited isn't from the majority.
 */
export interface JudgeMention {
  /** Family name only. */
  name: string;
  role?: "motifs min." | "motifs conc." | "motifs maj.";
}

function formatJudgeMention(j: JudgeMention): string {
  return j.role ? `j. ${j.name}, ${j.role}` : `j. ${j.name}`;
}

/**
 * Note — italics: the style of cause is always italicized, in text or in
 * notes, even when shortened; give the full style of cause at least once
 * in a note if it's shortened in the body text.
 *
 * Note — localisation de la référence: the reference that follows the style
 * of cause never appears in the body text itself, only in the footnote. If
 * the full style of cause is already given in the body text, it need not be
 * repeated in the note — only the reference itself is needed there.
 */

/**
 * Reference hierarchy (most to least preferred), used to decide which
 * reference to give when a decision has several: neutral citation or a
 * jurisdictional reporter first; then a non-jurisdictional reporter; then a
 * database/website-specific reference; case-summary collections (e.g. J.E.)
 * last, only when nothing more complete exists.
 */
export const REFERENCE_HIERARCHY = [
  "référence neutre ou recueil juridictionnel",
  "recueil de jurisprudence non juridictionnel",
  "référence propre à un site Web ou à une base de données",
  "recueil de résumés de jurisprudence",
] as const;

/**
 * Parallel citations: when a decision is reported in more than one source,
 * a single reference is normally enough, but additional ones may be added,
 * separated by commas, in hierarchical order.
 */
export interface ParallelCitations {
  /** The preferred (highest-hierarchy) citation, already formatted. */
  primary: string;
  /** Additional citations, already formatted, in hierarchical order. */
  additional: string[];
}

export function formatParallelCitations(p: ParallelCitations): string {
  return [p.primary, ...p.additional].join(", ");
}

/**
 * A list of decisions cited together in support of a proposition. Entries
 * are separated by semicolons and should be supplied already ordered by a
 * double hierarchy: jurisdiction (highest court first) and then chronology
 * (oldest first).
 */
export function formatCaseList(citations: string[]): string {
  return citations.join("; ");
}

/** A mention that one decision confirmed or reversed another in the same matter. */
export interface JudicialHistoryMention {
  relation: "conf. par" | "inf. par" | "conf. en partie" | "inf. en partie";
  /** The other decision's citation, already formatted. Party names are only
   * needed here if they changed significantly between instances. */
  citation: string;
}

export function formatJudicialHistoryMention(base: string, h: JudicialHistoryMention): string {
  return `${base}, ${h.relation} ${h.citation}`;
}

/** A mention that a decision is under appeal or subject to a motion for leave to appeal. */
export interface AppealMention {
  /** e.g. "requête pour permission d'appeler", "demande pour autorisation d'appeler". */
  procedure: string;
  court: string;
  date: string;
  docketNumber: string;
}

export function formatAppealMention(base: string, a: AppealMention): string {
  return `${base} (${a.procedure}, ${a.court}, ${a.date}, ${a.docketNumber})`;
}

/**
 * The judicial history of a matter across several jurisdictions (strict
 * sense): the citations of the decisions that followed (or preceded) the
 * one referred to, without indicating whether each confirmed or reversed
 * the others. Given in increasing or decreasing order, separated by
 * semicolons.
 */
export function formatJudicialHistoryList(citations: string[]): string {
  return citations.join("; ");
}

/**
 * Terminology usage notes (section K of the jurisprudence chapter) —
 * reference material, not citation data. Each entry briefly explains the
 * term's correct legal usage in French.
 */
export const JURISPRUDENCE_TERMINOLOGY_NOTES: Record<string, string> = {
  Appel: "Recours devant une juridiction supérieure pour contester un jugement de première instance; on 'interjette appel' ou on 'se pourvoit en appel', on ne 'loge' pas un appel.",
  Arrêt: "Réservé aux décisions des juridictions supérieures (Cour d'appel, Cour suprême, Conseil privé); les décisions de première instance sont des 'jugements' ou 'décisions'.",
  Cause: "L'affaire portée devant le tribunal, distincte de la décision elle-même qui y est rendue.",
  "Common law": "S'écrit toujours en minuscules, sans italiques ni guillemets, et prend le genre féminin.",
  Cour: "Seul le mot 'Cour' (ou 'Tribunal') prend la majuscule, à l'exclusion de son qualificatif, sauf en emploi générique.",
  Juge: "Ne prend jamais la majuscule, y compris dans son abréviation 'j.'.",
  Pourvoi: "Désigne un appel devant la Cour suprême du Canada, ou parfois devant la Cour d'appel du Québec.",
  Renvoi: "Procédure de droit constitutionnel par laquelle le gouvernement demande à un tribunal de dernière instance de se prononcer sur la validité d'un projet ou d'un texte de loi.",
};

// --- Databases and case-law websites -----------------------------------

/** SOQUIJ-Recherche juridique (formerly "Azimut (SOQUIJ)"). */
export interface SoquijAzCase {
  style: StyleOfCause | ThematicCaption;
  year: string;
  azNumber: string;
  paragraph?: string;
  /** Page in the PDF version, for older decisions without paragraph numbers. */
  pdfPage?: string;
  court?: string;
}

export function formatSoquijAzCase(c: SoquijAzCase, opts?: CitationFormatOptions): string {
  // Guide p. 57: "Carlo Destin ... [2004] n° AZ-50265220 (C.L.P.)" -- the "n°"
  // before the AZ number is part of the morphology, not optional punctuation.
  let result = opts?.omitStyle
    ? `[${c.year}] n° ${c.azNumber}`
    : `${formatCaption(c.style)}, [${c.year}] n° ${c.azNumber}`;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  else if (c.pdfPage) result += `, p. ${c.pdfPage}`;
  if (c.court) result += ` (${c.court})`;
  return result;
}

/** "La référence" database (formerly known through REJB, now also EYB). */
export interface ReferenceCase {
  style: StyleOfCause | ThematicCaption;
  databaseCode: "REJB" | "EYB";
  /** Full year-number identifier, e.g. "1999-11842". Always spell the year out in full. */
  documentNumber: string;
  paragraph?: string;
  court?: string;
}

export function formatReferenceCase(c: ReferenceCase, opts?: CitationFormatOptions): string {
  let result = opts?.omitStyle
    ? `${c.databaseCode} ${c.documentNumber}`
    : `${formatCaption(c.style)}, ${c.databaseCode} ${c.documentNumber}`;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  if (c.court) result += ` (${c.court})`;
  return result;
}

/** Lexis Advance Quicklaw (formerly "LexisNexis/Quicklaw"). */
export interface LexisAdvanceCase {
  style: StyleOfCause | ThematicCaption;
  year: string;
  /** Court/database identifier, e.g. "O.J.", "S.J.", "A.N.-B.", "A.C.I.". */
  courtIdentifier: string;
  documentNumber: string;
  paragraph?: string;
  /** Jurisdiction in parentheses — omit for a database specific to a single jurisdiction. */
  court?: string;
  serviceLabel?: "LAd/QL" | "LN/QL";
}

export function formatLexisAdvanceCase(c: LexisAdvanceCase, opts?: CitationFormatOptions): string {
  let result = opts?.omitStyle
    ? `[${c.year}] ${c.courtIdentifier} No. ${c.documentNumber}`
    : `${formatCaption(c.style)}, [${c.year}] ${c.courtIdentifier} No. ${c.documentNumber}`;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  if (c.court) result += ` (${c.court})`;
  result += ` (${c.serviceLabel ?? "LAd/QL"})`;
  return result;
}

/** WestlawNext Canada (formerly "Westlaw Canada"). Year is given plain — no brackets or parentheses. */
export interface WestlawCase {
  style: StyleOfCause | ThematicCaption;
  year: string;
  /** e.g. "CarswellAlta", "CarswellOnt". */
  databaseAbbreviation: string;
  documentNumber: string;
  court?: string;
}

export function formatWestlawCase(c: WestlawCase, opts?: CitationFormatOptions): string {
  let result = opts?.omitStyle
    ? `${c.year} ${c.databaseAbbreviation} ${c.documentNumber}`
    : `${formatCaption(c.style)}, ${c.year} ${c.databaseAbbreviation} ${c.documentNumber}`;
  if (c.court) result += ` (${c.court})`;
  result += ` (WC)`;
  return result;
}

/** CanLII — used when a decision has no neutral citation of its own; CanLII assigns one. Year is plain. */
export interface CanLIICase {
  style: StyleOfCause | ThematicCaption;
  year: string;
  sequenceNumber: string;
  courtCode?: string; 
  paragraph?: string;
  /** Jurisdiction exactly as CanLII writes it, e.g. "QC C.A.", "QC C.M.". */
  jurisdiction?: string;
}

export function formatCanLIICase(c: CanLIICase, opts?: CitationFormatOptions): string {
  let result: string;
  if (c.courtCode) {
    // Guide p. 77 -- "Construction R.S.R. Inc. c. Acier St-Denis Inc., 2007
    // QCCA 1466 (CanLII)": the decision already has its own neutral
    // citation, and "(CanLII)" is added only as a practical source note.
    const citation = `${c.year} ${c.courtCode} ${c.sequenceNumber}`;
    result = opts?.omitStyle ? `${citation} (CanLII)` : `${formatCaption(c.style)}, ${citation} (CanLII)`;
  } else {
    // Guide p. 77 -- "Chaoulli c. Québec (Procureur général), 2002
    // CanLII 33075 (QC C.A.)": no neutral citation, so CanLII's own
    // numbering IS the identifier -- "CanLII" isn't repeated as a trailing
    // marker, and the jurisdiction (exactly as CanLII writes it) comes
    // right after instead.
    const citation = `${c.year} CanLII ${c.sequenceNumber}`;
    result = opts?.omitStyle ? citation : `${formatCaption(c.style)}, ${citation}`;
    if (c.jurisdiction) result += ` (${c.jurisdiction})`;
  }
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  return result;
}

/** A decision cited via a website, using its neutral citation or unpublished-decision citation, with the URL appended for readers unfamiliar with legal research. */
export interface WebsiteCase {
  /** The decision's neutral or unpublished citation, already formatted. */
  citation: string;
  paragraph?: string;
  url: string;
}

export function formatWebsiteCase(c: WebsiteCase): string {
  let result = c.citation;
  if (c.paragraph) result += `, par. ${c.paragraph}`;
  result += `, en ligne : <${c.url}>`;
  return result;
}

// --- Jurisprudence inédite -----------------------------------------------

/** An unpublished decision of a judicial court (not in any print reporter or database). */
export interface UnpublishedJudicialDecision {
  style: StyleOfCause | ThematicCaption;
  /** Court initials, e.g. "C.S.", "C.Q.", "C.A.". */
  courtInitials: string;
  district: string;
  /** e.g. "(Ch. civ.)", "(Div. petites créances)". */
  chamberOrDivision?: string;
  docketNumber: string;
  date: string;
  /**
   * Family name(s) only — always required for an unpublished decision.
   * Guide p. 78: more than one judge gets "jj." instead of "j.".
   */
  judgeName: string | string[];
  page?: string;
  paragraph?: string;
}

export function formatUnpublishedJudicialDecision(d: UnpublishedJudicialDecision): string {
  let result = `${formatCaption(d.style)}, ${d.courtInitials} ${d.district}`;
  if (d.chamberOrDivision) result += ` ${d.chamberOrDivision}`;
  const judges = Array.isArray(d.judgeName) ? d.judgeName : [d.judgeName];
  const judgeLabel = judges.length > 1 ? "jj." : "j.";
  result += `, n° ${d.docketNumber}, ${d.date}, ${judgeLabel} ${formatPageList(judges)}`;
  if (d.page) result += `, p. ${d.page}`;
  if (d.paragraph) result += `, par. ${d.paragraph}`;
  return result;
}

/** An unpublished decision of an administrative organization or tribunal. */
export interface UnpublishedAdministrativeDecision {
  /** Style of cause, or subject when there are no opposing parties. */
  caption: string;
  decisionNumber?: string;
  docketNumbers?: string[];
  /**
   * Guide p. 80: showing "n°"/"nos" before the docket number(s) isn't
   * always necessary -- e.g. "dossier R-3555-2004", "dossier CMQ-57978".
   * Defaults to true, matching most examples (e.g. "dossiers nos 1272787
   * et 1273788", "dossier n° 237418-62B-0406"); set false to omit it.
   */
  showDocketNumeroPrefix?: boolean;
  date: string;
  /** The deciding organization's name, given in parentheses. */
  organization: string;
  url?: string;
}

export function formatUnpublishedAdministrativeDecision(d: UnpublishedAdministrativeDecision): string {
  let result = italic(d.caption);
  if (d.decisionNumber) result += `, décision ${d.decisionNumber}`;
  if (d.docketNumbers && d.docketNumbers.length > 0) {
    const plural = d.docketNumbers.length > 1;
    const numeroPrefix = d.showDocketNumeroPrefix === false ? "" : plural ? "nos " : "n° ";
    result += `, dossier${plural ? "s" : ""} ${numeroPrefix}${formatPageList(d.docketNumbers)}`;
  }
  result += `, ${d.date} (${d.organization})`;
  if (d.url) result += `, en ligne : <${d.url}>`;
  return result;
}

/**
 * A decision published in a special bulletin (guide p. 81) -- e.g. the
 * Bulletin de l'Autorité des marchés financiers or the Bulletin de la
 * Commission des valeurs mobilières du Québec -- issued by the Tribunal
 * administratif des marchés financiers (TMF), the Bureau de décision et de
 * révision (BDR/BDRVM) or a predecessor organization.
 */
export interface SpecialBulletinDecision {
  /** Style of cause, or a bare caption when there's a single party. */
  caption: string;
  year: string;
  /** Bulletin abbreviation, e.g. "Bull. AMF", "B.C.V.M.Q." */
  bulletinAbbreviation: string;
  volume?: string;
  issueNumber?: string;
  page?: string;
  /** Deciding organization's abbreviation, given in parentheses. */
  organization?: string;
  url?: string;
}

export function formatSpecialBulletinDecision(d: SpecialBulletinDecision): string {
  let result = `${italic(d.caption)}, (${d.year}) ${d.bulletinAbbreviation}`;
  if (d.volume) result += `, vol. ${d.volume}`;
  if (d.issueNumber) result += `, n° ${d.issueNumber}`;
  if (d.page) result += `, p. ${d.page}`;
  if (d.organization) result += ` (${d.organization})`;
  if (d.url) result += `, en ligne : <${d.url}>`;
  return result;
}

/**
 * A decision of the Conseil de la magistrature du Québec (guide pp. 82-83).
 * The Comité d'examen is cited under a plain "Rapport d'examen" caption; the
 * Comité d'enquête names the complainant and the judge(s) concerned, built
 * with formatConseilMagistratureJudge below.
 */
export interface ConseilMagistratureDecision {
  /** "Rapport d'examen" for the Comité d'examen, or a caption naming the
   * complainant and judge(s) for the Comité d'enquête. */
  caption: string;
  year: string;
  /** Guide p. 82: both "QCCMAG" and "CMQC" are in use. */
  courtCode: "QCCMAG" | "CMQC";
  sequenceNumber: string;
  paragraph?: string;
  /** e.g. "rapport d'enquête", "décision sur la requête en intervention d'un tiers", or a bare date. */
  note?: string;
}

export function formatConseilMagistratureDecision(d: ConseilMagistratureDecision): string {
  let result = `${italic(d.caption)}, ${d.year} ${d.courtCode} ${d.sequenceNumber}`;
  if (d.paragraph) result += `, par. ${d.paragraph}`;
  if (d.note) result += ` (${d.note})`;
  return result;
}

/**
 * A judge named as a respondent before the Comité d'enquête (guide p. 83):
 * always "M. le juge"/"Mme la juge" plus the full name -- never a bare
 * family name the way formatJudgeMention gives for a pinpoint mention.
 */
export interface ConseilMagistratureJudge {
  title: "M. le juge" | "Mme la juge";
  fullName: string;
}

export function formatConseilMagistratureJudge(j: ConseilMagistratureJudge): string {
  return `${j.title} ${j.fullName}`;
}

// ============================================================================
// VII. LÉGISLATION — RECUEILS ANNUELS, AUTRES PROVINCES, LOIS CONSTITUTIONNELLES,
//      PROJETS DE LOI, TRAVAUX PARLEMENTAIRES, ENTRÉE EN VIGUEUR, MODIFICATIONS
// ============================================================================

/** A statute of another Canadian province or federal territory. Adapt the recueil abbreviation to the jurisdiction and its editor's own conventions. */
export interface OtherProvinceStatute {
  title: string;
  /** e.g. "L.R.O.", "C.P.L.M.", "RSA", "SA", "L.R.N.-B.", "L.N.-B.", "L.R.T.N.-O.", "S.NU.". */
  recueilAbbreviation: string;
  year?: string;
  chapter: string;
  /** Common-law provinces pinpoint by "section" (s.) rather than "article" (art.). */
  useSectionAbbreviation?: boolean;
  articles?: string[];
}

export function formatOtherProvinceStatute(s: OtherProvinceStatute): string {
  let result = `${italic(s.title)}, ${s.recueilAbbreviation}`;
  if (s.year) result += s.recueilAbbreviation.includes(" ") ? `, ${s.year}` : ` ${s.year}`;
  result += `, c. ${s.chapter}`;
  if (s.articles && s.articles.length > 0) {
    const label = s.useSectionAbbreviation ? "s." : "art.";
    result += `, ${label} ${formatPageList(s.articles)}`;
  }
  return result;
}

/**
 * The Constitution Act, 1867 and 1982, the Canadian Charter, and the Quebec
 * Act, 1774 — pre-formatted since these fixed citations rarely vary.
 * Quasi-constitutional statutes (the Quebec Charter, the Canadian Bill of
 * Rights) are ordinary statutes and can be cited with `formatConsolidatedStatute`/
 * `formatAnnualStatute` as shown here.
 */
export const CONSTITUTIONAL_STATUTES = {
  constitutionAct1867: `${italic("Loi constitutionnelle de 1867")}, 30 & 31 Vict., c. 3 (R.-U.)`,
  constitutionAct1982: `${italic("Loi constitutionnelle de 1982")}, annexe B du Canada Act 1982, 1982, c. 11 (R.-U.)`,
  canadianCharter: `${italic("Charte canadienne des droits et libertés")}, partie I de la Loi constitutionnelle de 1982`,
  quebecAct1774: `${italic("Acte de Québec de 1774")}, 14 Geo. III, c. 83 (R.-U.)`,
} as const;

export const QUASI_CONSTITUTIONAL_STATUTES = {
  quebecCharter: formatConsolidatedStatute({
    kind: "consolidated",
    title: "Charte des droits et libertés de la personne",
    recueilAbbreviation: "RLRQ",
    chapter: "C-12",
  }),
  canadianBillOfRights: formatAnnualStatute({
    kind: "annual",
    title: "Déclaration canadienne des droits",
    recueilAbbreviation: "S.C.",
    year: "1960",
    chapter: "44",
  }),
} as const;

/** Parliamentary debates, minutes, or testimony (Journal des débats, Hansard, Délibérations, Témoignages, Procès-verbaux). */
export interface ParliamentaryDebate {
  /**
   * When the recueil title already names the chamber — "Débats de la
   * Chambre des communes", "Débats du Sénat" — the guide's own examples
   * (p. 18) use the bare "CANADA" / "QUÉBEC" prefix instead of repeating the
   * chamber. Use the fuller forms only when the recueil title does not
   * already identify the chamber (e.g. "Journal des débats", "Témoignages",
   * "Délibérations").
   */
  chamber: "CANADA" | "QUÉBEC" | "CANADA, SÉNAT" | "CANADA, CHAMBRE DES COMMUNES" | "QUÉBEC, ASSEMBLÉE NATIONALE" | "QUÉBEC, ASSEMBLÉE LÉGISLATIVE";
  /** e.g. "Journal des débats", "Débats de la Chambre des communes", "Délibérations du Comité sénatorial permanent...", "Témoignages". */
  recueilTitle: string;
  /** Only needed if the committee/commission name isn't already part of the recueil title. */
  committeeName?: string;
  session: string;
  legislature: string;
  fascicule?: string;
  tome?: string;
  date: string;
  /** Subject or legislative stage under discussion, quoted. */
  subjectOrStage?: string;
  time?: string;
  page?: string;
  speaker?: string;
}

export function formatParliamentaryDebate(d: ParliamentaryDebate): string {
  let result = `${d.chamber}, ${italic(d.recueilTitle)}`;
  if (d.committeeName) result += `, ${d.committeeName}`;
  result += `, ${d.session}, ${d.legislature}`;
  if (d.fascicule) result += `, fascicule n° ${d.fascicule}`;
  result += `, ${d.date}`;
  if (d.tome) result += `, tome ${d.tome}`;
  if (d.subjectOrStage) result += `, «${d.subjectOrStage}»`;
  if (d.time) result += `, ${d.time}`;
  if (d.page) result += `, p. ${d.page}`;
  if (d.speaker) result += ` (${d.speaker})`;
  return result;
}

/** A parliamentary committee report (final or interim). */
export interface ParliamentaryReport {
  chamber: "CANADA, SÉNAT" | "CANADA, CHAMBRE DES COMMUNES";
  reportTitle: string;
  /** The guide's table (p. 19) also allows a plain "Rapport" with no final/interim qualifier. */
  reportType: "Rapport" | "Rapport final" | "Rapport intérimaire";
  committeeName: string;
  session: string;
  legislature: string;
  monthYear: string;
  page?: string;
}

export function formatParliamentaryReport(r: ParliamentaryReport): string {
  let result = `${r.chamber}, ${italic(r.reportTitle)}, ${r.reportType} du ${r.committeeName}, ${r.session}, ${r.legislature}, ${r.monthYear}`;
  if (r.page) result += `, p. ${r.page}`;
  return result;
}

/**
 * Grammatical subject for the verb "entré(e)(s) en vigueur": agreement
 * follows whether the whole law/regulation (fem. "loi" / masc. "règlement",
 * singular) or one or more articles (masc. singular/plural) is what's
 * entering into force.
 */
export type EntryIntoForceSubject = "loi" | "reglement" | "article" | "articles";

function agreedEntre(subject: EntryIntoForceSubject): string {
  return subject === "loi" ? "entrée en vigueur" : subject === "articles" ? "entrés en vigueur" : "entré en vigueur";
}

/** Entry into force by proclamation or decree, with the enacting gazette reference. */
export interface EntryIntoForceByProclamation {
  /** Pre-formatted statute/regulation citation, with article numbers already included if relevant. */
  reference: string;
  subject: EntryIntoForceSubject;
  date: string;
  mode: "proclamation" | "décret";
  gazette: {
    year: string;
    volume: string;
    abbreviation: "G.O." | "Gaz. Can.";
    part: "I" | "II" | "III";
    firstPage?: string;
    /** Alternative identifier in lieu of a page number: "TR/année-n°" (federal) or "D. n-année" (Quebec). */
    alternativeId?: string;
  };
}

export function formatEntryIntoForceByProclamation(e: EntryIntoForceByProclamation): string {
  let result = `${e.reference}, ${agreedEntre(e.subject)} le ${e.date} (${e.mode})`;
  if (e.gazette.alternativeId) {
    result += `, ${e.gazette.alternativeId} (${e.gazette.abbreviation} ${e.gazette.part})`;
  } else {
    result += `, (${e.gazette.year}) ${e.gazette.volume} ${e.gazette.abbreviation} ${e.gazette.part}`;
    if (e.gazette.firstPage) result += `, ${e.gazette.firstPage}`;
  }
  return result;
}

/** Entry into force at the date of sanction, at a specific stated date, or under the default rule in the relevant interpretation act. */
export interface EntryIntoForceByProvision {
  reference: string;
  subject: EntryIntoForceSubject;
  date: string;
  /** e.g. "l'article 34 de cette loi", or "l'article 5 de la Loi d'interprétation, RLRQ, c. I-16". */
  byVirtueOf: string;
}

export function formatEntryIntoForceByProvision(e: EntryIntoForceByProvision): string {
  return `${e.reference}, ${agreedEntre(e.subject)} le ${e.date} en vertu de ${e.byVirtueOf}`;
}

/**
 * A generic amendment mention: `relationPhrase` should include the correctly
 * gendered verb and article, e.g. "modifiée par la" (for a fem. "loi"),
 * "modifié par le" (for a masc. "règlement"), "abrogée par la", "remplacé par le".
 */
export function formatAmendment(original: string, relationPhrase: string, by: string): string {
  return `${original}, ${relationPhrase} ${by}`;
}

// ============================================================================
// VIII. RÉGLEMENTATION — CAS PARTICULIERS
// ============================================================================

/** A draft regulation (projet de règlement), published in a gazette before adoption. */
export interface DraftRegulation {
  title: string;
  year: string;
  /** Annual volume number of the gazette (omit if none applies / consulted online without one). */
  gazetteVolume?: string;
  gazetteAbbreviation: "Gaz. Can." | "G.O.";
  gazettePart: "I" | "II" | "III";
  /** First page number, or — if consulted online without pagination — the publication date. */
  firstPageOrDate: string;
  articles?: string[];
}

export function formatDraftRegulation(r: DraftRegulation): string {
  let result = `${italic(r.title)} (projet), (${r.year})`;
  if (r.gazetteVolume) result += ` ${r.gazetteVolume}`;
  result += ` ${r.gazetteAbbreviation} ${r.gazettePart}, ${r.firstPageOrDate}`;
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  return result;
}

/** A regulation from another Canadian province or federal territory, consolidated or not. */
export interface OtherProvinceRegulation {
  title: string;
  /** Full designation as the jurisdiction cites it, e.g. "Reg. 154/2011", "R.R.O. 1990, Reg. 547", "Règl. 20/99". */
  designation: string;
  /** Province/territory abbreviation, added in parentheses when the designation doesn't already identify it. */
  provinceOrTerritory?: string;
  /** Common-law jurisdictions pinpoint by "s."; French-language ones by "art.". */
  useSectionAbbreviation?: boolean;
  articles?: string[];
}

export function formatOtherProvinceRegulation(r: OtherProvinceRegulation): string {
  let result = `${italic(r.title)}, ${r.designation}`;
  if (r.provinceOrTerritory) result += ` (${r.provinceOrTerritory})`;
  if (r.articles && r.articles.length > 0) {
    const label = r.useSectionAbbreviation ? "s." : "art.";
    result += `, ${label} ${formatPageList(r.articles)}`;
  }
  return result;
}

/** A municipal by-law or other institutional regulation (e.g. university policy). */
export interface MunicipalRegulation {
  title: string;
  /** The adopting body, e.g. "Conseil municipal de la Ville de Montréal". */
  decisionMakingBody: string;
  regulationNumber: string;
  adoptedDate?: string;
  inForceDate?: string;
  articles?: string[];
  url?: string;
}

export function formatMunicipalRegulation(r: MunicipalRegulation): string {
  let result = `${italic(r.title)}, ${r.decisionMakingBody}, règlement n° ${r.regulationNumber}`;
  if (r.adoptedDate) result += `, adopté le ${r.adoptedDate}`;
  if (r.inForceDate) result += `, entré en vigueur le ${r.inForceDate}`;
  if (r.articles && r.articles.length > 0) result += `, art. ${formatPageList(r.articles)}`;
  if (r.url) result += `, en ligne: <${r.url}>`;
  return result;
}

/** An administrative decree, decision, or notice published in a gazette (federal Orders in Council or Quebec decrees). */
export interface AdministrativeDecree {
  title: string;
  /** Federal Order in Council number, e.g. "C.P. 2007-13". */
  ordersInCouncilNumber?: string;
  /** Quebec decree number, e.g. "Décret 1241-2005" (usually folded into the title). */
  year: string;
  gazetteVolume: string;
  gazetteAbbreviation: "G.O." | "Gaz. Can.";
  gazettePart: "I" | "II";
  firstPage?: string;
  /** Alternative identifier in lieu of a page number: "TR/année-n°". */
  alternativeId?: string;
}

export function formatAdministrativeDecree(d: AdministrativeDecree): string {
  let result = italic(d.title);
  if (d.ordersInCouncilNumber) result += `, ${d.ordersInCouncilNumber}`;
  if (d.alternativeId) {
    result += `, ${d.alternativeId} (${d.gazetteAbbreviation} ${d.gazettePart})`;
  } else {
    result += `, (${d.year}) ${d.gazetteVolume} ${d.gazetteAbbreviation} ${d.gazettePart}`;
    if (d.firstPage) result += `, ${d.firstPage}`;
  }
  return result;
}

// ============================================================================
// IX. RÈGLES COMMUNES AUX LOIS ET AUX RÈGLEMENTS
// ============================================================================

/**
 * A pinpoint into the "dispositif" of a statute or regulation: article,
 * alinéa (unnumbered subdivision), paragraphe (numbered subdivision), and
 * sous-paragraphe (lettered subdivision). Punctuation differs by level:
 * numbered paragraphs/subparagraphs are appended directly in parentheses
 * with no comma; an alinéa is written "al. N" and separated by a space from
 * whatever parenthetical follows it. When citing an inserted article (one
 * the legislator added using a decimal or letter suffix, e.g. "1040a" or
 * "9.1"), reproduce that exact numbering in `article` rather than treating
 * the suffix as an alinéa or paragraphe.
 */
export interface DispositifPinpoint {
  article: string;
  alinea?: string;
  paragraph?: string;
  subparagraph?: string;
}

export function formatDispositifPinpoint(p: DispositifPinpoint): string {
  let result = `art. ${p.article}`;
  if (p.alinea) result += ` al. ${p.alinea}`;
  let bracket = "";
  if (p.paragraph) {
    bracket = `(${p.paragraph})`;
    if (p.subparagraph) bracket += `${p.subparagraph})`;
  } else if (p.subparagraph) {
    bracket = `(${p.subparagraph})`;
  }
  if (bracket) result += (p.alinea ? " " : "") + bracket;
  return result;
}

/**
 * Localisation rules: the reference that follows a statute/regulation title
 * (recueil, chapter, gazette, etc.) never appears in the running text —
 * only in the footnote. If the official title (long or short) is already
 * used in the body text, it need not be repeated in the note, which can
 * then give just the reference. If the text only refers to the enactment
 * implicitly, or uses an unofficial short form, the note must give both the
 * title and the reference.
 *
 * Italics: titles are italicized only when official (long or short form).
 * Generic terms used alone — "le Code civil", "la loi" — are not
 * italicized; "Code civil du Québec" and "Code civil du Bas Canada" as full
 * official titles are.
 *
 * Capitalization: "loi" and "règlement" take a capital only as part of an
 * official title; used generically they stay lowercase even when referring
 * to a specific enactment. "Code", "Charte", and "Constitution" are always
 * capitalized when referring to a specific text.
 */

/** In running prose, "article" is always spelled out in full. */
export function articleInProse(n: string): string {
  return `article ${n}`;
}

/** Outside of prose (a bare pinpoint or footnote), "article(s)" always abbreviates to "art." — singular or plural, never "a.", "aa.", or "arts". */
export function articleAbbreviated(n: string | string[]): string {
  const nums = Array.isArray(n) ? formatPageList(n) : n;
  return `art. ${nums}`;
}

/** "Alinéa" is spelled out in full only when it is the grammatical subject of the sentence. */
export function alineaInProse(n: string): string {
  return `alinéa ${n}`;
}

/** In any other position — prose or footnote, singular or plural — "alinéa" abbreviates to "al.". */
export function alineaAbbreviated(n: string | string[]): string {
  const nums = Array.isArray(n) ? formatPageList(n) : n;
  return `al. ${nums}`;
}

/**
 * Terminology usage notes for legislative writing — reference material, not
 * citation data. Each key is a discouraged usage; the value explains the
 * preferred alternative.
 */
export const LEGISLATIVE_TERMINOLOGY_NOTES: Record<string, string> = {
  "la loi stipule": "\"Stipuler\" appartient au domaine contractuel; écrire plutôt \"la loi prévoit\" ou, mieux, \"la loi dispose\".",
  "par le biais de l'article": "Dénote un moyen détourné; formuler directement, ex. \"à l'article\".",
  "la loi est à l'effet que": "Anglicisme; préférer \"aux termes de la loi\" ou \"la loi précise\".",
  "la loi a été amendée": "Préférer \"la loi a été modifiée\"; réserver \"amendement\" aux projets de loi.",
  "juridiction (au sens de compétence)": "Anglicisme en matière législative; réserver \"juridiction\" au domaine judiciaire et écrire \"compétence\".",
  "sous l'article 10 / sous la Loi X": "Anglicisme; préférer \"en vertu de l'article 10\" ou \"sous l'empire de la Loi X\".",
  "ce texte a été initié par": "Anglicisme; préférer une formule du type \"adopté à l'initiative de\".",
};

/**
 * Codes are technically ordinary statutes, but the following are cited so
 * frequently that a full reference is unnecessary. The abbreviation is
 * never italicized. Give the full title and reference when the audience
 * isn't familiar with the law.
 */
export const COMMON_CODE_ABBREVIATIONS: Record<string, string> = {
  "Code canadien du travail": "C.c.t.",
  "Code civil du Québec": "C.c.Q.",
  "Code civil du Québec (1980)": "C.c.Q. (1980)",
  "Code civil du Bas Canada": "C.c.B.C.",
  "Code de procédure civile (actuel)": "C.p.c.",
  "Code de procédure civile (antérieur, 1965)": "C.p.c. (1965)",
  "Code du travail": "C.t.",
  "Code des professions": "C. prof.",
  "Code criminel": "C.cr.",
};

/** A statute-abbreviation dictionary entry: the common abbreviation to use once introduced, and the first-mention footnote text establishing it. */
export interface AbbreviationIntroduction {
  /** e.g. "RLRQ, c. A-25 (ci-après « L.a.a. »)" — the reference, ending with the parenthetical introducing the abbreviation. */
  reference: string;
  abbreviation: string;
}

export function formatAbbreviationIntroduction(a: AbbreviationIntroduction): string {
  return `${a.reference} (ci-après «${a.abbreviation}»)`;
}

// ============================================================================
// USAGE EXAMPLES (based on the guide's own worked examples)
// ============================================================================

/*
formatMonograph({
  authors: [{ firstName: "Pierre-André", lastName: "Côté" }],
  title: "Interprétation des lois",
  city: "Cowansville",
  publisher: "Éditions Yvon Blais",
  year: "1982",
  pages: ["318", "319"],
});
// → Pierre-André CÔTÉ, Interprétation des lois, Cowansville, Éditions Yvon Blais, 1982, p. 318 et 319

formatPeriodicalArticle({
  authors: [{ firstName: "Albert", lastName: "Mayrand" }],
  title: "L'assurance au profit du concubin",
  year: "1958-59",
  volume: "3",
  journalAbbreviation: "Thémis",
  firstPage: "225",
  citedPages: ["225", "227"],
});
// → Albert MAYRAND, «L'assurance au profit du concubin», (1958-59) 3 Thémis 225, 225 et 227

formatNeutralCitationCase({
  style: { plaintiff: "Dunsmuir", defendant: "Nouveau-Brunswick" },
  year: "2008",
  courtCode: "CSC",
  sequenceNumber: "9",
});
// → Dunsmuir c. Nouveau-Brunswick, 2008 CSC 9

formatConsolidatedStatute({
  kind: "consolidated",
  title: "Loi sur les lettres de change",
  recueilAbbreviation: "L.R.C.",
  year: "1985",
  chapter: "B-4",
});
// → Loi sur les lettres de change, L.R.C. 1985, c. B-4

formatQuebecRLRQRegulation({
  title: "Règles de procédure du Tribunal administratif du Québec",
  chapter: "J-3",
  regulationNumber: "r. 3",
  articles: ["3"],
});
// → Règles de procédure du Tribunal administratif du Québec, RLRQ, c. J-3, r. 3, art. 3
*/

// =============================================================================
// SHORT CITATIONS (références subséquentes)
// Guide des références juridiques — Chapter on repeated citations
// =============================================================================

/**
 * "Ibid." — used when the immediately preceding footnote cited the same source.
 * If the page/paragraph is the same, just "Ibid."
 * If different, "Ibid., p. X" or "Ibid., par. X"
 */
export function formatIbid(pinpoint?: { page?: string; paragraph?: string }): string {
  if (!pinpoint?.page && !pinpoint?.paragraph) return "Ibid.";
  if (pinpoint.paragraph) return `Ibid., par. ${pinpoint.paragraph}`;
  return `Ibid., p. ${pinpoint.page}`;
}

/**
 * "Préc." — used for doctrine when the source was cited in a previous note
 * (but not immediately preceding). Format:
 * LASTNAME, Short Title, préc., note X, p. Y
 */
export function formatPrec(options: {
  authorLastName: string;
  shortTitle?: string;
  noteNumber: number;
  pinpoint?: { page?: string; paragraph?: string };
}): string {
  let result = options.authorLastName.toUpperCase();
  if (options.shortTitle) result += `, ${italic(options.shortTitle)}`;
  result += `, préc., note ${options.noteNumber}`;
  if (options.pinpoint?.paragraph) result += `, par. ${options.pinpoint.paragraph}`;
  else if (options.pinpoint?.page) result += `, p. ${options.pinpoint.page}`;
  return result;
}

/**
 * Short form for jurisprudence — style of cause + "préc., note X"
 * e.g. Dunsmuir, préc., note 3, par. 47
 */
export function formatCasePrec(options: {
  shortStyleOfCause: string;  // Usually just the plaintiff name
  noteNumber: number;
  pinpoint?: { page?: string; paragraph?: string };
}): string {
  let result = italic(options.shortStyleOfCause) + `, préc., note ${options.noteNumber}`;
  if (options.pinpoint?.paragraph) result += `, par. ${options.pinpoint.paragraph}`;
  else if (options.pinpoint?.page) result += `, p. ${options.pinpoint.page}`;
  return result;
}

/**
 * Supra / Infra cross-references
 * e.g. "Voir supra, note 14" or "Voir infra, notes 22-25"
 */
export function formatCrossReference(
  direction: "supra" | "infra",
  noteNumbers: number[]
): string {
  const notes = noteNumbers.length === 1
    ? `note ${noteNumbers[0]}`
    : `notes ${noteNumbers[0]}-${noteNumbers[noteNumbers.length - 1]}`;
  return `Voir ${direction}, ${notes}.`;
}