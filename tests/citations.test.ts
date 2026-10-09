/**
 * Citation correctness tests
 * Run with: npm test
 *
 * Each test case is taken directly from the Guide des références juridiques.
 * If a test fails, the formatter is wrong.
 */

import {
  formatMonograph,
  formatPeriodicalArticle,
  formatNeutralCitationCase,
  formatReportedCase,
  formatCanLIICase,
  formatConsolidatedStatute,
  formatAnnualStatute,
  formatBill,
  formatStudyInCollectiveWork,
  formatUnpublishedThesis,
  formatBlogOrNewspaperArticle,
  formatLexisAdvanceCase,
  formatParallelCitations,
  formatSoquijAzCase,
  formatDatabaseCase,
  formatUnpublishedJudicialDecision,
  formatUnpublishedAdministrativeDecision,
  formatWebsiteCase,
  formatSpecialBulletinDecision,
  formatConseilMagistratureDecision,
  formatConseilMagistratureJudge,
  formatParliamentaryDebate,
  formatParliamentaryReport,
  formatAmendedStatute,
  ITALIC_OPEN,
  ITALIC_CLOSE,
} from "../src/lib/legal-citations";
import { it, expect } from "vitest";

// ─── helpers ────────────────────────────────────────────────────────────────

function em(text: string): string {
  return `${ITALIC_OPEN}${text}${ITALIC_CLOSE}`;
}

function test(name: string, actual: string, expected: string) {
  it(name, () => {
    // Strip HTML tags for comparison if using <em>
    const clean = (s: string) => s.replace(/<[^>]+>/g, "");
    expect(clean(actual)).toBe(clean(expected));
  });
}

// ─── DOCTRINE ────────────────────────────────────────────────────────────────

console.log("\nI. DOCTRINE\n");

// Monograph — Guide QC example
test(
  "Monograph — basic",
  formatMonograph({
    authors: [{ firstName: "Didier", lastName: "Lluelles" }, { firstName: "Benoît", lastName: "Moore" }],
    title: "Droit des obligations",
    city: "Montréal",
    publisher: "Thémis",
    year: "2018",
  }),
  "Didier LLUELLES et Benoît MOORE, Droit des obligations, Montréal, Thémis, 2018"
);

// Monograph with edition
test(
  "Monograph — with edition",
  formatMonograph({
    authors: [{ firstName: "Pierre-André", lastName: "Côté" }],
    title: "Interprétation des lois",
    edition: "4e éd.",
    city: "Montréal",
    publisher: "Thémis",
    year: "2009",
  }),
  "Pierre-André CÔTÉ, Interprétation des lois, 4e éd., Montréal, Thémis, 2009"
);

// Monograph with pages cited
test(
  "Monograph — with pages",
  formatMonograph({
    authors: [{ firstName: "Didier", lastName: "Lluelles" }],
    title: "Droit des obligations",
    city: "Montréal",
    publisher: "Thémis",
    year: "2018",
    pages: ["123"],
  }),
  "Didier LLUELLES, Droit des obligations, Montréal, Thémis, 2018, p. 123"
);

// Periodical article
test(
  "Periodical article",
  formatPeriodicalArticle({
    authors: [{ firstName: "Albert", lastName: "Mayrand" }],
    title: "L'assurance au profit du concubin",
    year: "1958-59",
    journalAbbreviation: "Thémis",
    firstPage: "225",
  }),
  "Albert MAYRAND, «L'assurance au profit du concubin», (1958-59) Thémis 225"
);

// Periodical with volume
test(
  "Periodical article — with volume",
  formatPeriodicalArticle({
    authors: [{ firstName: "Pierre", lastName: "Legrand" }],
    title: "Le droit comparé",
    year: "1999",
    volume: "44",
    journalAbbreviation: "RD McGill",
    firstPage: "567",
    citedPages: ["570"],
  }),
  "Pierre LEGRAND, «Le droit comparé», (1999) 44 RD McGill 567, 570"
);

// Blog/newspaper
test(
  "Blog article — with author",
  formatBlogOrNewspaperArticle({
    author: { firstName: "Jean", lastName: "Tremblay" },
    title: "La réforme du droit civil",
    source: "Le Devoir",
    date: "13 juillet 2017",
    url: "https://ledevoir.com/article",
  }),
  "Jean TREMBLAY, «La réforme du droit civil», Le Devoir, 13 juillet 2017, en ligne: <https://ledevoir.com/article>"
);

// Blog — no author (starts with title)
test(
  "Blog article — no author",
  formatBlogOrNewspaperArticle({
    author: { firstName: "", lastName: "" },
    title: "Loi 101",
    source: "L'Encyclopédie canadienne",
    date: "15 septembre 2026",
    url: "https://encyclopediecanadienne.ca/loi-101",
  }),
  "«Loi 101», L'Encyclopédie canadienne, 15 septembre 2026, en ligne: <https://encyclopediecanadienne.ca/loi-101>"
);

// ─── JURISPRUDENCE ───────────────────────────────────────────────────────────

console.log("\nII. JURISPRUDENCE\n");

// Neutral citation
test(
  "Neutral citation",
  formatNeutralCitationCase({
    style: { plaintiff: "Dunsmuir", defendant: "Nouveau-Brunswick", connector: "c." },
    year: "2008",
    courtCode: "CSC",
    sequenceNumber: "9",
  }),
  "Dunsmuir c. Nouveau-Brunswick, 2008 CSC 9"
);

// Neutral with paragraph
test(
  "Neutral citation — with paragraph",
  formatNeutralCitationCase({
    style: { plaintiff: "Dunsmuir", defendant: "Nouveau-Brunswick", connector: "c." },
    year: "2008",
    courtCode: "CSC",
    sequenceNumber: "9",
    paragraph: "47",
  }),
  "Dunsmuir c. Nouveau-Brunswick, 2008 CSC 9, par. 47"
);

// Neutral — English connector
test(
  "Neutral citation — English v.",
  formatNeutralCitationCase({
    style: { plaintiff: "R", defendant: "Oakes", connector: "v." },
    year: "1986",
    courtCode: "CSC",
    sequenceNumber: "46",
  }),
  "R v. Oakes, 1986 CSC 46"
);

// Reported case — square brackets
test(
  "Reported case — [year] identifies volume",
  formatReportedCase({
    style: { plaintiff: "Doré", defendant: "Barreau du Québec", connector: "c." },
    year: "2012",
    yearBrackets: "[]",
    volume: "1",
    reportAbbreviation: "RCS",
    firstPage: "395",
    citedPages: ["400"],
  }),
  "Doré c. Barreau du Québec, [2012] 1 RCS 395, 400"
);

// Reported case — round brackets
test(
  "Reported case — (year) doesn't identify volume",
  formatReportedCase({
    style: { plaintiff: "Béliveau St-Jacques", defendant: "Fédération des employées", connector: "c." },
    year: "1996",
    yearBrackets: "()",
    volume: "2",
    reportAbbreviation: "RCS",
    firstPage: "345",
  }),
  "Béliveau St-Jacques c. Fédération des employées, (1996) 2 RCS 345"
);

// Guide p. 52 "Exemples 2" — civilist tradition: parenthetical year (tied
// to a continuously-numbered volume) goes AFTER the comma.
test(
  "Reported case — civilist round-bracket year (after comma)",
  formatReportedCase({
    style: { plaintiff: "Villard", defendant: "Mercier", connector: "c." },
    year: "1935",
    yearBrackets: "()",
    volume: "73",
    reportAbbreviation: "C.S.",
    firstPage: "51",
  }),
  "Villard c. Mercier, (1935) 73 C.S. 51"
);

// Guide p. 52 "Exemples 2" — common law tradition: parenthetical year goes
// BEFORE the comma, right after the style of cause (inferred here from the
// "v." connector).
test(
  "Reported case — common law round-bracket year (before comma)",
  formatReportedCase({
    style: { plaintiff: "R.", defendant: "Talbourdet", connector: "v." },
    year: "1984",
    yearBrackets: "()",
    volume: "12",
    reportAbbreviation: "C.C.C.",
    seriesNumber: "3d",
    firstPage: "173",
    court: "Sask. C.A.",
  }),
  "R. v. Talbourdet (1984), 12 C.C.C. (3d) 173 (Sask. C.A.)"
);

test(
  "Reported case — common law round-bracket year, second guide example",
  formatReportedCase({
    style: { plaintiff: "R.", defendant: "Hayden", connector: "v." },
    year: "1984",
    yearBrackets: "()",
    volume: "3",
    reportAbbreviation: "D.L.R.",
    seriesNumber: "4th",
    firstPage: "361",
    court: "Man. C.A.",
  }),
  "R. v. Hayden (1984), 3 D.L.R. (4th) 361 (Man. C.A.)"
);

test(
  "Reported case — common law round-bracket year, parallel Sask. R. reference",
  formatReportedCase({
    style: { plaintiff: "R.", defendant: "Therens", connector: "v." },
    year: "1983",
    yearBrackets: "()",
    volume: "23",
    reportAbbreviation: "Sask. R.",
    firstPage: "81",
    court: "C.A.",
  }),
  "R. v. Therens (1983), 23 Sask. R. 81 (C.A.)"
);

// Guide p. 51 s. B — decision year (in parens, before the comma) is added
// when the publication year is more than three years later.
test(
  "Reported case — decision year more than 3 years before publication",
  formatReportedCase({
    style: { plaintiff: "Lazanik", defendant: "Ford Motor Co. of Canada", connector: "c." },
    year: "1977",
    yearBrackets: "[]",
    decisionYear: "1965",
    reportAbbreviation: "R.L.",
    firstPage: "262",
    court: "C.S.",
  }),
  "Lazanik c. Ford Motor Co. of Canada (1965), [1977] R.L. 262 (C.S.)"
);

// Guide p. 52 "Exemples 1" — square-bracket years always go after the
// comma, even with a volume number and an English-language reporter.
test(
  "Reported case — bracketed year with volume stays after the comma",
  formatReportedCase({
    style: { plaintiff: "Société Radio-Canada", defendant: "Commission de police du Québec", connector: "c." },
    year: "1979",
    yearBrackets: "[]",
    volume: "2",
    reportAbbreviation: "R.C.S.",
    firstPage: "618",
  }),
  "Société Radio-Canada c. Commission de police du Québec, [1979] 2 R.C.S. 618"
);

test(
  "Reported case — bracketed year, English report, stays after the comma",
  formatReportedCase({
    style: { plaintiff: "Pengelly", defendant: "British Empire Assurance Co.", connector: "v." },
    year: "1973",
    yearBrackets: "[]",
    volume: "6",
    reportAbbreviation: "W.W.R.",
    firstPage: "68",
    court: "Sask. Q.B.",
  }),
  "Pengelly v. British Empire Assurance Co., [1973] 6 W.W.R. 68 (Sask. Q.B.)"
);

// Explicit override — force common law placement even with the "c." connector.
test(
  "Reported case — explicit yearPosition override",
  formatReportedCase({
    style: { plaintiff: "X", defendant: "Y", connector: "c." },
    year: "1990",
    yearBrackets: "()",
    yearPosition: "beforeComma",
    volume: "5",
    reportAbbreviation: "C.R.",
    firstPage: "1",
  }),
  "X c. Y (1990), 5 C.R. 1"
);

// CanLII
test(
  "CanLII case",
  formatCanLIICase({
    style: { plaintiff: "Dupont", defendant: "Martin", connector: "c." },
    year: "2023",
    sequenceNumber: "1657",
    courtCode: "QCCA",
    jurisdiction: "QC C.A.",
  }),
  "Dupont c. Martin, 2023 QCCA 1657 (CanLII)"
);

// ─── PARALLEL CITATIONS (guide p. 58, s. H) ───────────────────────────────────
// Further references to the SAME decision, most authoritative first, joined
// by commas — the style of cause is only given once, on the primary one.

console.log("\nII.b PARALLEL CITATIONS\n");

// omitStyle drops the leading "Style, " so a fragment can be joined onto a
// primary citation without repeating the party names.
test(
  "formatReportedCase — omitStyle drops the style of cause",
  formatReportedCase({
    style: { plaintiff: "R.", defendant: "Talbourdet", connector: "v." },
    year: "1984",
    yearBrackets: "()",
    volume: "12",
    reportAbbreviation: "C.C.C.",
    seriesNumber: "3d",
    firstPage: "173",
    court: "Sask. C.A.",
  }, { omitStyle: true }),
  "(1984) 12 C.C.C. (3d) 173 (Sask. C.A.)"
);

test(
  "formatNeutralCitationCase — omitStyle drops the style of cause",
  formatNeutralCitationCase({
    style: { plaintiff: "Harper", defendant: "Canada (Attorney General)", connector: "v." },
    year: "2001",
    courtCode: "ABQB",
    sequenceNumber: "558",
  }, { omitStyle: true }),
  "2001 ABQB 558"
);

// Guide p. 58 — Colombie-Britannique c. Zastowny, 2008 CSC 4, en ligne: <...>
// (built from formatNeutralCitationCase + formatWebsiteCase; no parallel
// reference needed since there is only one citation here — sanity check
// that the primary/omitStyle split doesn't affect the single-reference case)
test(
  "Neutral citation alone is unaffected by the omitStyle option",
  formatNeutralCitationCase({
    style: { plaintiff: "Colombie-Britannique", defendant: "Zastowny", connector: "c." },
    year: "2008",
    courtCode: "CSC",
    sequenceNumber: "4",
  }),
  "Colombie-Britannique c. Zastowny, 2008 CSC 4"
);

// Guide p. 59 — Harper v. Canada (Attorney General), 2001 ABQB 558, (2001)
// 93 Alta. L.R. (3d) 281 (Q.B.), [2001] A.J. No. 808 (LAd/QL)
test(
  "Harper v. Canada — neutral + reported + Quicklaw parallel citation",
  formatParallelCitations({
    primary: formatNeutralCitationCase({
      style: { plaintiff: "Harper", defendant: "Canada (Attorney General)", connector: "v." },
      year: "2001",
      courtCode: "ABQB",
      sequenceNumber: "558",
    }),
    additional: [
      formatReportedCase({
        style: { plaintiff: "Harper", defendant: "Canada (Attorney General)", connector: "v." },
        year: "2001",
        yearBrackets: "()",
        volume: "93",
        reportAbbreviation: "Alta. L.R.",
        seriesNumber: "3d",
        firstPage: "281",
        court: "Q.B.",
      }, { omitStyle: true }),
      formatLexisAdvanceCase({
        style: { plaintiff: "Harper", defendant: "Canada (Attorney General)", connector: "v." },
        year: "2001",
        courtIdentifier: "A.J.",
        documentNumber: "808",
      }, { omitStyle: true }),
    ],
  }),
  "Harper v. Canada (Attorney General), 2001 ABQB 558, (2001) 93 Alta. L.R. (3d) 281 (Q.B.), [2001] A.J. No. 808 (LAd/QL)"
);

// Guide p. 58 — Chaoulli c. Procureur général du Québec, [2005] 1 R.C.S.
// 791, J.E. 2005-1144 (parallel reference is a resumé collection, itself a
// bracketed reference — style of cause omitted on it too)
test(
  "Chaoulli — reported RCS + J.E. summary parallel citation",
  formatParallelCitations({
    primary: formatReportedCase({
      style: { plaintiff: "Chaoulli", defendant: "Procureur général du Québec", connector: "c." },
      year: "2005",
      yearBrackets: "[]",
      volume: "1",
      reportAbbreviation: "R.C.S.",
      firstPage: "791",
    }),
    additional: ["J.E. 2005-1144"],
  }),
  "Chaoulli c. Procureur général du Québec, [2005] 1 R.C.S. 791, J.E. 2005-1144"
);

// ─── PP. 49-68 RE-VERIFICATION PASS ────────────────────────────────────────
// Fixes confirmed directly against guide pages 49-68 examples.

console.log("\nII.c PP. 49-68 FIXES\n");

// Guide p. 57 — "Carlo Destin et Agence de personnel Rive-Sud 2000 et
// Commission de la santé et de la sécurité du travail, [2004] n° AZ-50265220
// (C.L.P.)" — the SOQUIJ-AZ morphology needs "n°" before the AZ number, and
// the "et" connector (guide p. 49) replaces "c." in some administrative
// decisions.
test(
  "formatSoquijAzCase — \"n°\" prefix and \"et\" connector",
  formatSoquijAzCase({
    style: {
      plaintiff: "Carlo Destin",
      defendant: "Agence de personnel Rive-Sud 2000 et Commission de la santé et de la sécurité du travail",
      connector: "et",
    },
    year: "2004",
    azNumber: "AZ-50265220",
    court: "C.L.P.",
  }),
  "Carlo Destin et Agence de personnel Rive-Sud 2000 et Commission de la santé et de la sécurité du travail, [2004] n° AZ-50265220 (C.L.P.)"
);

// Guide p. 54, note 2 — "Dupuis c. Phoenix du Canada, J.E. 83-851 (C.S.)" —
// a résumé-collection reference (J.E., EXP, D.T.E.…) never carries a
// separate year; it's embedded in the document number itself.
test(
  "formatDatabaseCase — résumé collection has no separate year",
  formatDatabaseCase({
    style: { plaintiff: "Dupuis", defendant: "Phoenix du Canada", connector: "c." },
    databaseAbbreviation: "J.E.",
    documentNumber: "83-851",
    court: "C.S.",
  }),
  "Dupuis c. Phoenix du Canada, J.E. 83-851 (C.S.)"
);

// Guide p. 56 — "Alex Couture Inc. c. Québec (Ministère de l'environnement),
// J.E. 2003-316 (C.A.)"
test(
  "formatDatabaseCase — résumé collection, second example",
  formatDatabaseCase({
    style: { plaintiff: "Alex Couture Inc.", defendant: "Québec (Ministère de l'environnement)", connector: "c." },
    databaseAbbreviation: "J.E.",
    documentNumber: "2003-316",
    court: "C.A.",
  }),
  "Alex Couture Inc. c. Québec (Ministère de l'environnement), J.E. 2003-316 (C.A.)"
);

// Guide p. 58 — Chaoulli's J.E. parallel fragment ("J.E. 2005-1144"), this
// time built through the real (fixed) formatDatabaseCase with omitStyle,
// rather than a hardcoded string.
test(
  "formatDatabaseCase — omitStyle, no year (parallel-citation fragment)",
  formatDatabaseCase({
    style: { plaintiff: "[unused]", defendant: "[unused]" },
    databaseAbbreviation: "J.E.",
    documentNumber: "2005-1144",
  }, { omitStyle: true }),
  "J.E. 2005-1144"
);

// Guide p. 51 s. A.2 / p. 61 — "Droit de la famille — 08162, 2008 QCCS 285"
// — a thematic caption used in place of a two-party style of cause.
test(
  "formatNeutralCitationCase — thematic caption",
  formatNeutralCitationCase({
    style: { theme: "Droit de la famille — 08162" },
    year: "2008",
    courtCode: "QCCS",
    sequenceNumber: "285",
  }),
  "Droit de la famille — 08162, 2008 QCCS 285"
);

// Guide p. 51 — "Renvoi relatif à la Chambre haute" thematic caption, used
// with a reported (jurisdictional-reporter) citation instead of a neutral one.
test(
  "formatReportedCase — thematic caption",
  formatReportedCase({
    style: { theme: "Renvoi relatif à la Chambre haute" },
    year: "1980",
    yearBrackets: "[]",
    reportAbbreviation: "R.C.S.",
    firstPage: "1",
  }),
  "Renvoi relatif à la Chambre haute, [1980] R.C.S. 1"
);

// ─── PP. 69-83 RE-VERIFICATION PASS ────────────────────────────────────────
// Fixes confirmed directly against guide pages 69-83 examples.

console.log("\nII.d PP. 69-83 FIXES\n");

// Guide p. 51/61 pattern reconfirmed on p. 69 — "Droit de la famille — 2235,
// [1995] R.D.F. 494 (C.S.)" — thematic caption + reported case.
test(
  "formatReportedCase — thematic caption, second guide confirmation",
  formatReportedCase({
    style: { theme: "Droit de la famille – 2235" },
    year: "1995",
    yearBrackets: "[]",
    reportAbbreviation: "R.D.F.",
    firstPage: "494",
    court: "C.S.",
  }),
  "Droit de la famille – 2235, [1995] R.D.F. 494 (C.S.)"
);

// Guide p. 70 — "Haefner c. Boisjoly, (1968) 14 McGill L.J. 99, 101 (C.S.)"
// — decision reproduced in a law review: the journal abbreviation is
// italicized (stripped by the test helper, but exercises reportIsJournal).
test(
  "formatReportedCase — decision reproduced in a law review",
  formatReportedCase({
    style: { plaintiff: "Haefner", defendant: "Boisjoly", connector: "c." },
    year: "1968",
    yearBrackets: "()",
    volume: "14",
    reportAbbreviation: "McGill L.J.",
    reportIsJournal: true,
    firstPage: "99",
    citedPages: ["101"],
    court: "C.S.",
  }),
  "Haefner c. Boisjoly, (1968) 14 McGill L.J. 99, 101 (C.S.)"
);

// Guide p. 70 — "P.T. c. B.R., (1994) 28 R.J.T. 300 (C.S.), commentaires A.
// Popovici, id., 289" — a trailing doctrinal-commentary cross-reference.
test(
  "formatReportedCase — commentary cross-reference",
  formatReportedCase({
    style: { plaintiff: "P.T.", defendant: "B.R.", connector: "c." },
    year: "1994",
    yearBrackets: "()",
    volume: "28",
    reportAbbreviation: "R.J.T.",
    reportIsJournal: true,
    firstPage: "300",
    court: "C.S.",
    commentary: { author: "A. Popovici", page: "289" },
  }),
  "P.T. c. B.R., (1994) 28 R.J.T. 300 (C.S.), commentaires A. Popovici, id., 289"
);

// Guide p. 71 — "Matte c. Gatineau (Ville), [2005] R.R.A. 1299 (rés.) (C.Q.)"
// — a résumé reproduced inside an otherwise full-text reporter.
test(
  "formatReportedCase — (rés.) flag",
  formatReportedCase({
    style: { plaintiff: "Matte", defendant: "Gatineau (Ville)", connector: "c." },
    year: "2005",
    yearBrackets: "[]",
    reportAbbreviation: "R.R.A.",
    firstPage: "1299",
    isSummary: true,
    court: "C.Q.",
  }),
  "Matte c. Gatineau (Ville), [2005] R.R.A. 1299 (rés.) (C.Q.)"
);

// Guide p. 71 — "Beaulieu c. Turcotte, J.E. 86-459 (C.A.)" — a plain résumé
// collection citation (no year at all).
test(
  "formatDatabaseCase — résumé collection, no year",
  formatDatabaseCase({
    style: { plaintiff: "Beaulieu", defendant: "Turcotte", connector: "c." },
    databaseAbbreviation: "J.E.",
    documentNumber: "86-459",
    court: "C.A.",
  }),
  "Beaulieu c. Turcotte, J.E. 86-459 (C.A.)"
);

// Guide p. 71 — "Fraser et Résidence Étienne Simard, CLPE 99 LP-1 (C.L.P.)"
// — the "et" connector again, this time on a plain résumé citation.
test(
  "formatDatabaseCase — \"et\" connector",
  formatDatabaseCase({
    style: { plaintiff: "Fraser", defendant: "Résidence Étienne Simard", connector: "et" },
    databaseAbbreviation: "CLPE",
    documentNumber: "99 LP-1",
    court: "C.L.P.",
  }),
  "Fraser et Résidence Étienne Simard, CLPE 99 LP-1 (C.L.P.)"
);

// Guide p. 71 — "Commission scolaire de Montréal c. Mirabel (Ville), 2014
// EXP-1495 (T.A.Q.)" — the newer EXP electronic bulletin takes a bare,
// unbracketed year, unlike the older print résumé collections.
test(
  "formatDatabaseCase — EXP bulletin, bare year",
  formatDatabaseCase({
    style: { plaintiff: "Commission scolaire de Montréal", defendant: "Mirabel (Ville)", connector: "c." },
    year: "2014",
    yearBrackets: "none",
    databaseAbbreviation: "",
    documentNumber: "EXP-1495",
    court: "T.A.Q.",
  }),
  "Commission scolaire de Montréal c. Mirabel (Ville), 2014 EXP-1495 (T.A.Q.)"
);

// Guide p. 77 — "Chaoulli c. Québec (Procureur général), 2002 CanLII 33075
// (QC C.A.)" — no neutral citation, so no trailing "(CanLII)" marker.
test(
  "formatCanLIICase — no neutral citation, no trailing (CanLII)",
  formatCanLIICase({
    style: { plaintiff: "Chaoulli", defendant: "Québec (Procureur général)", connector: "c." },
    year: "2002",
    sequenceNumber: "33075",
    jurisdiction: "QC C.A.",
  }),
  "Chaoulli c. Québec (Procureur général), 2002 CanLII 33075 (QC C.A.)"
);

// Guide p. 77 — "Construction R.S.R. Inc. c. Acier St-Denis Inc., 2007 QCCA
// 1466 (CanLII)" — decision has its own neutral citation; "(CanLII)" is a
// practical source note here instead.
test(
  "formatCanLIICase — with neutral citation, trailing (CanLII)",
  formatCanLIICase({
    style: { plaintiff: "Construction R.S.R. Inc.", defendant: "Acier St-Denis Inc.", connector: "c." },
    year: "2007",
    courtCode: "QCCA",
    sequenceNumber: "1466",
  }),
  "Construction R.S.R. Inc. c. Acier St-Denis Inc., 2007 QCCA 1466 (CanLII)"
);

// Guide p. 78 — "Nanas c. Lopez, C.Q. Montréal (Ch. civ.), n° 500-22-059916-018,
// 30 novembre 2001, j. Roy, en ligne : <http://citoyens.soquij.qc.ca>"
test(
  "formatWebsiteCase — \"en ligne :\" spacing",
  formatWebsiteCase({
    citation: formatUnpublishedJudicialDecision({
      style: { plaintiff: "Nanas", defendant: "Lopez" },
      courtInitials: "C.Q.",
      district: "Montréal",
      chamberOrDivision: "(Ch. civ.)",
      docketNumber: "500-22-059916-018",
      date: "30 novembre 2001",
      judgeName: "Roy",
    }),
    url: "http://citoyens.soquij.qc.ca",
  }),
  "Nanas c. Lopez, C.Q. Montréal (Ch. civ.), n° 500-22-059916-018, 30 novembre 2001, j. Roy, en ligne : <http://citoyens.soquij.qc.ca>"
);

// Guide p. 79 — "Latulippe c. Services de remorquage Direct Inc., C.Q.
// Montréal (Div. petites créances), n° 500-32-062575-016, 28 mars 2002, j.
// Marengo, par. 4"
test(
  "formatUnpublishedJudicialDecision — single judge",
  formatUnpublishedJudicialDecision({
    style: { plaintiff: "Latulippe", defendant: "Services de remorquage Direct Inc." },
    courtInitials: "C.Q.",
    district: "Montréal",
    chamberOrDivision: "(Div. petites créances)",
    docketNumber: "500-32-062575-016",
    date: "28 mars 2002",
    judgeName: "Marengo",
    paragraph: "4",
  }),
  "Latulippe c. Services de remorquage Direct Inc., C.Q. Montréal (Div. petites créances), n° 500-32-062575-016, 28 mars 2002, j. Marengo, par. 4"
);

// Guide p. 78 morphology table: "jj." replaces "j." for more than one judge
// (no worked multi-judge example in the guide, so this exercises the rule
// stated in the table itself using the guide's own multi-item joining
// convention -- "et" for two names).
test(
  "formatUnpublishedJudicialDecision — multiple judges use \"jj.\"",
  formatUnpublishedJudicialDecision({
    style: { plaintiff: "X", defendant: "Y" },
    courtInitials: "C.A.",
    district: "Montréal",
    docketNumber: "500-09-000000-000",
    date: "1 janvier 2020",
    judgeName: ["Smith", "Jones"],
  }),
  "X c. Y, C.A. Montréal, n° 500-09-000000-000, 1 janvier 2020, jj. Smith et Jones"
);

// Guide p. 80 — "Gagnon c. Régie de l'assurance maladie du Québec, dossiers
// nos 1272787 et 1273788, 7 décembre 2007 (Commission de la fonction
// publique du Québec), en ligne : <http://citoyens.soquij.qc.ca>"
test(
  "formatUnpublishedAdministrativeDecision — plural docket numbers with \"nos\"",
  formatUnpublishedAdministrativeDecision({
    caption: "Gagnon c. Régie de l'assurance maladie du Québec",
    docketNumbers: ["1272787", "1273788"],
    date: "7 décembre 2007",
    organization: "Commission de la fonction publique du Québec",
    url: "http://citoyens.soquij.qc.ca",
  }),
  "Gagnon c. Régie de l'assurance maladie du Québec, dossiers nos 1272787 et 1273788, 7 décembre 2007 (Commission de la fonction publique du Québec), en ligne : <http://citoyens.soquij.qc.ca>"
);

// Guide p. 80 — "Regroupement national des conseils régionaux de
// l'environnement du Québec (RNCREQ) et Hydro-Québec, décision D-2005-216,
// dossier R-3555-2004, 1er décembre 2005 (Régie de l'énergie du Québec), en
// ligne : <www.regie-energie.qc.ca>" — here "n°" is NOT shown.
test(
  "formatUnpublishedAdministrativeDecision — decision + docket, no \"n°\"",
  formatUnpublishedAdministrativeDecision({
    caption: "Regroupement national des conseils régionaux de l'environnement du Québec (RNCREQ) et Hydro-Québec",
    decisionNumber: "D-2005-216",
    docketNumbers: ["R-3555-2004"],
    showDocketNumeroPrefix: false,
    date: "1er décembre 2005",
    organization: "Régie de l'énergie du Québec",
    url: "www.regie-energie.qc.ca",
  }),
  "Regroupement national des conseils régionaux de l'environnement du Québec (RNCREQ) et Hydro-Québec, décision D-2005-216, dossier R-3555-2004, 1er décembre 2005 (Régie de l'énergie du Québec), en ligne : <www.regie-energie.qc.ca>"
);

// Guide p. 80 — "Groupe Canam Manac Inc., dossier n° 237418-62B-0406, 31 mai
// 2005 (C.L.P.), en ligne : <http://citoyens.soquij.qc.ca>" — singular "n°".
test(
  "formatUnpublishedAdministrativeDecision — singular docket with \"n°\"",
  formatUnpublishedAdministrativeDecision({
    caption: "Groupe Canam Manac Inc.",
    docketNumbers: ["237418-62B-0406"],
    date: "31 mai 2005",
    organization: "C.L.P.",
    url: "http://citoyens.soquij.qc.ca",
  }),
  "Groupe Canam Manac Inc., dossier n° 237418-62B-0406, 31 mai 2005 (C.L.P.), en ligne : <http://citoyens.soquij.qc.ca>"
);

// Guide p. 81 — "Autorité des marchés financiers c. Angelopoulos, (2008)
// Bull. AMF, vol. 5, n° 5, p. 46 (BDRVM), en ligne : <www.lautorite.qc.ca>"
test(
  "formatSpecialBulletinDecision",
  formatSpecialBulletinDecision({
    caption: "Autorité des marchés financiers c. Angelopoulos",
    year: "2008",
    bulletinAbbreviation: "Bull. AMF",
    volume: "5",
    issueNumber: "5",
    page: "46",
    organization: "BDRVM",
    url: "www.lautorite.qc.ca",
  }),
  "Autorité des marchés financiers c. Angelopoulos, (2008) Bull. AMF, vol. 5, n° 5, p. 46 (BDRVM), en ligne : <www.lautorite.qc.ca>"
);

// Guide p. 82 — "Rapport d'examen, 2012 QCCMAG 40, par. 39" and "Rapport
// d'examen, 2013 CMQC 067 (29 janvier 2014)" — Comité d'examen decisions.
test(
  "formatConseilMagistratureDecision — Comité d'examen, with paragraph",
  formatConseilMagistratureDecision({
    caption: "Rapport d'examen",
    year: "2012",
    courtCode: "QCCMAG",
    sequenceNumber: "40",
    paragraph: "39",
  }),
  "Rapport d'examen, 2012 QCCMAG 40, par. 39"
);
test(
  "formatConseilMagistratureDecision — Comité d'examen, with date note",
  formatConseilMagistratureDecision({
    caption: "Rapport d'examen",
    year: "2013",
    courtCode: "CMQC",
    sequenceNumber: "067",
    note: "29 janvier 2014",
  }),
  "Rapport d'examen, 2013 CMQC 067 (29 janvier 2014)"
);

// Guide p. 83 — "M. le juge Gilles Charest et M. le juge Richard Alary, 2008
// CMQC 87 (rapport du comité d'enquête – 24 mars 2010)" — Comité d'enquête.
test(
  "formatConseilMagistratureDecision — Comité d'enquête, two judges",
  formatConseilMagistratureDecision({
    caption: `${formatConseilMagistratureJudge({ title: "M. le juge", fullName: "Gilles Charest" })} et ${formatConseilMagistratureJudge({ title: "M. le juge", fullName: "Richard Alary" })}`,
    year: "2008",
    courtCode: "CMQC",
    sequenceNumber: "87",
    note: "rapport du comité d'enquête – 24 mars 2010",
  }),
  "M. le juge Gilles Charest et M. le juge Richard Alary, 2008 CMQC 87 (rapport du comité d'enquête – 24 mars 2010)"
);

// ─── LÉGISLATION ─────────────────────────────────────────────────────────────

console.log("\nIII. LÉGISLATION\n");

// Consolidated statute — RLRQ (no year)
test(
  "Consolidated statute — RLRQ",
  formatConsolidatedStatute({
    kind: "consolidated",
    title: "Charte des droits et libertés de la personne",
    recueilAbbreviation: "RLRQ",
    chapter: "C-12",
    articles: ["10"],
  }),
  "Charte des droits et libertés de la personne, RLRQ, c. C-12, art. 10"
);

// Consolidated statute — L.R.C. (with year)
test(
  "Consolidated statute — L.R.C.",
  formatConsolidatedStatute({
    kind: "consolidated",
    title: "Loi constitutionnelle de 1982",
    recueilAbbreviation: "L.R.C.",
    year: "1985",
    chapter: "1 (2e supp.)",
  }),
  "Loi constitutionnelle de 1982, L.R.C. 1985, c. 1 (2e supp.)"
);

// Annual statute
test(
  "Annual statute — L.Q.",
  formatAnnualStatute({
    kind: "annual",
    title: "Loi sur la distribution de produits et services financiers",
    recueilAbbreviation: "L.Q.",
    year: "1998",
    chapter: "37",
  }),
  "Loi sur la distribution de produits et services financiers, L.Q. 1998, c. 37"
);

// Bill
test(
  "Bill — Quebec",
  formatBill({
    projectedTitle: "Loi sur la distribution de produits et services financiers",
    billNumber: "188",
    sessionOrdinal: "2e",
    legislatureOrdinal: "35e",
    legislature: "Qc",
  }),
  "Loi sur la distribution de produits et services financiers, projet de loi n° 188, 2e sess., 35e légis. (Qc)"
);

test(
  "Loi constitutionnelle de 1982 — correct reference",
  formatConsolidatedStatute({
    kind: "consolidated",
    title: "Loi constitutionnelle de 1982",
    recueilAbbreviation: "annexe B du Canada Act 1982",
    year: "1982",
    chapter: "11 (R.-U.)",
  }),
  "Loi constitutionnelle de 1982, annexe B du Canada Act 1982, 1982, c. 11 (R.-U.)"
);

// (vitest reports pass/fail counts itself — no manual summary needed)

// ─── NEW TESTS from Guide Modifications document ─────────────────────────────

console.log("\nGUIDE MODIFICATIONS FIXES\n");

// Supplement uses a space, not a comma
test(
  "Consolidated statute — supplement (guide p. 7: \"L.R.C. 1985, c. 1 (5e supp.)\")",
  formatConsolidatedStatute({
    kind: "consolidated",
    title: "Loi de l'impôt sur le revenu",
    recueilAbbreviation: "L.R.C.",
    year: "1985",
    chapter: "1",
    supplement: "(5e supp.)",
  }),
  "Loi de l'impôt sur le revenu, L.R.C. 1985, c. 1 (5e supp.)"
);

// Parliamentary debate — tome follows the date (guide p. 18, 28 juin 1977 example),
// not fascicule's position before the date.
test(
  "Parliamentary debate — tome follows the date",
  formatParliamentaryDebate({
    chamber: "QUÉBEC, ASSEMBLÉE NATIONALE",
    recueilTitle: "Journal des débats. Commissions parlementaires",
    committeeName: "Commission permanente de l'éducation, des affaires culturelles et des communications",
    session: "2e sess.",
    legislature: "31e légis.",
    tome: "12",
    date: "28 juin 1977",
    subjectOrStage: "Audition des mémoires sur le projet de loi n° 1 : Charte de la langue française au Québec (14)",
    page: "CLF-901",
    speaker: "M. Camille Laurin",
  }),
  "QUÉBEC, ASSEMBLÉE NATIONALE, <em>Journal des débats. Commissions parlementaires</em>, Commission permanente de l'éducation, des affaires culturelles et des communications, 2e sess., 31e légis., 28 juin 1977, tome 12, «Audition des mémoires sur le projet de loi n° 1 : Charte de la langue française au Québec (14)», p. CLF-901 (M. Camille Laurin)"
);

// Parliamentary debate — Hansard-style recueils name the chamber in their own title,
// so the chamber prefix is bare "CANADA" (guide p. 18).
test(
  "Parliamentary debate — Hansard uses bare chamber label",
  formatParliamentaryDebate({
    chamber: "CANADA",
    recueilTitle: "Débats de la Chambre des communes",
    session: "2e sess.",
    legislature: "37e légis.",
    date: "28 janvier 2003",
    subjectOrStage: "Initiatives ministérielles. Loi sur la procréation assistée",
    page: "2767",
    speaker: "M. Réal Ménard",
  }),
  "CANADA, <em>Débats de la Chambre des communes</em>, 2e sess., 37e légis., 28 janvier 2003, «Initiatives ministérielles. Loi sur la procréation assistée», p. 2767 (M. Réal Ménard)"
);

// Parliamentary report — the guide's table also allows a plain "Rapport" with no qualifier.
test(
  "Parliamentary report — plain 'Rapport' with no qualifier",
  formatParliamentaryReport({
    chamber: "CANADA, SÉNAT",
    reportTitle: "Exemple de rapport",
    reportType: "Rapport",
    committeeName: "Comité sénatorial permanent des affaires juridiques et constitutionnelles",
    session: "1re sess.",
    legislature: "40e légis.",
    monthYear: "mars 2010",
  }),
  "CANADA, SÉNAT, <em>Exemple de rapport</em>, Rapport du Comité sénatorial permanent des affaires juridiques et constitutionnelles, 1re sess., 40e légis., mars 2010"
);

// Amended statute — a Code is masculine ("modifié"/"remplacé"), unlike a loi ("modifiée"/"remplacée").
// Cf. guide p. 14 n.19: the current Code de procédure civile replaced the 1965 one.
test(
  "Amended statute — masculine agreement for a Code",
  formatAmendedStatute({
    original: {
      kind: "consolidated",
      title: "Code de procédure civile",
      recueilAbbreviation: "RLRQ",
      chapter: "C-25",
    },
    originalGender: "masculin",
    relation: "remplacee",
    by: {
      kind: "annual",
      title: "Loi instituant le nouveau Code de procédure civile",
      recueilAbbreviation: "L.Q.",
      year: "2014",
      chapter: "1",
    },
  }),
  "Code de procédure civile, RLRQ, c. C-25, remplacé par la Loi instituant le nouveau Code de procédure civile, L.Q. 2014, c. 1"
);

// Loi constitutionnelle de 1982
test(
  "Loi constitutionnelle de 1982 — correct reference",
  formatConsolidatedStatute({
    kind: "consolidated",
    title: "Loi constitutionnelle de 1982",
    recueilAbbreviation: "annexe B du Canada Act 1982",
    year: "1982",
    chapter: "11 (R.-U.)",
  }),
  "Loi constitutionnelle de 1982, annexe B du Canada Act 1982, 1982, c. 11 (R.-U.)"
);
// ─── ITALIC TESTS ────────────────────────────────────────────────────────────

console.log("\nITALICS VERIFICATION\n");

// Titles must be in <em> tags
function testItalics(name: string, result: string, fieldThatShouldBeItalic: string) {
  it(`${name} — "${fieldThatShouldBeItalic}" is italic`, () => {
    expect(result).toContain(`<em>${fieldThatShouldBeItalic}</em>`);
  });
}

testItalics(
  "Monograph title is italic",
  formatMonograph({ authors: [{ firstName: "Pierre-André", lastName: "Côté" }], title: "Interprétation des lois", city: "Montréal", publisher: "Thémis", year: "2009" }),
  "Interprétation des lois"
);

testItalics(
  "Periodical journal abbreviation is italic",
  formatPeriodicalArticle({ authors: [{ firstName: "Albert", lastName: "Mayrand" }], title: "L'assurance au profit du concubin", year: "1958-59", journalAbbreviation: "Thémis", firstPage: "225" }),
  "Thémis"
);

testItalics(
  "Consolidated statute title is italic",
  formatConsolidatedStatute({ kind: "consolidated", title: "Charte des droits et libertés de la personne", recueilAbbreviation: "RLRQ", chapter: "C-12" }),
  "Charte des droits et libertés de la personne"
);

testItalics(
  "Blog source name is italic",
  formatBlogOrNewspaperArticle({ author: { firstName: "Jean", lastName: "Tremblay" }, title: "Article", source: "Le Devoir", date: "13 juillet 2017" }),
  "Le Devoir"
);

testItalics(
  "Bill title is italic",
  formatBill({ projectedTitle: "Loi sur la distribution de produits et services financiers", billNumber: "188", sessionOrdinal: "2e", legislatureOrdinal: "35e", legislature: "Qc" }),
  "Loi sur la distribution de produits et services financiers"
);

// Fix for style of cause italic test — parties are wrapped individually
test(
  "Style of cause parties are individually italic",
  formatNeutralCitationCase({
    style: { plaintiff: "Dunsmuir", defendant: "Nouveau-Brunswick", connector: "c." },
    year: "2008",
    courtCode: "CSC",
    sequenceNumber: "9",
  }),
  "<em>Dunsmuir</em> c. <em>Nouveau-Brunswick</em>, 2008 CSC 9"
);

// Style of cause — verify both parties are wrapped in em tags
it("Style of cause — both parties are italic", () => {
  const neutralResult = formatNeutralCitationCase({
    style: { plaintiff: "Dunsmuir", defendant: "Nouveau-Brunswick", connector: "c." },
    year: "2008", courtCode: "CSC", sequenceNumber: "9",
  });
  expect(neutralResult).toContain("<em>Dunsmuir</em>");
  expect(neutralResult).toContain("<em>Nouveau-Brunswick</em>");
});
