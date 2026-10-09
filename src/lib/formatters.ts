// =============================================================================
// CITATION FORMATTERS
// =============================================================================
// Edit formatter functions below to change citation output format.
// Edit FIELDS_BY_SOURCE in src/app/page.tsx to change form field order.
//
// Missing field conventions per guide:
//
//   McGill (FR):   no author → omit   no date → (s.d.)   no place → s.l.   no pub → s.n.
//   Bluebook (EN): no author → omit   no date → n.d.      no place → n.p.   no pub → n.p.
//   Chicago (EN):  no author → omit   no date → n.d.      no place → n.p.   no pub → n.p.
//   AMA (EN):      no author → omit   no date → n.d.      no place → n.p.   no pub → n.p.
//   IEEE (EN):     no author → omit   no date → n.d.      no place → n.p.   no pub → n.p.
//   Vancouver:     no author → omit   no date → [date unknown]  etc.
//
//   Volume/issue/pages/doi/edition → always omit silently if missing
//   Journal name missing → [journal?]
//   Book title missing   → [title?]
// =============================================================================

export interface SourceData {
  author: string;
  title: string;
  journalName?: string;
  bookTitle?: string;
  publisher?: string;
  publisherCity?: string;
  year?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
  doi?: string;
  edition?: string;
  editors?: string;
  sourceType: "book" | "article" | "website" | "chapter";
}

export type StyleKey = keyof typeof formatters;
type Lang = "en" | "fr";

// =============================================================================
// HELPERS
// =============================================================================

export function italics(text: string): string {
  if (!text) return "";
  return `<em>${text}</em>`;
}

function initials(fullName: string): string {
  if (!fullName?.trim()) return "";
  if (fullName.includes(",")) {
    const [last, rest] = fullName.split(",").map(s => s.trim());
    return `${last} ${rest.split(" ").filter(Boolean).map(n => n[0]?.toUpperCase() + ".").join("")}`;
  }
  const parts = fullName.trim().split(" ").filter(Boolean);
  const last = parts[parts.length - 1];
  const fi = parts.slice(0, -1).map(n => n[0]?.toUpperCase() + ".").join("");
  return fi ? `${last} ${fi}` : last;
}

// Return value only if non-empty and not literally "undefined"
function v(val: string | undefined): string {
  if (!val || val.trim() === "" || val === "undefined") return "";
  return val.trim();
}

// IEEE-style author: "J. Smith"
function ieeeAuthor(name: string): string {
  if (!name?.trim()) return "";
  if (name.includes(",")) {
    const [last, rest] = name.split(",").map(n => n.trim());
    const fi = rest.split(" ").filter(Boolean).map(n => n[0]?.toUpperCase() + ".").join(" ");
    return `${fi} ${last}`;
  }
  const parts = name.trim().split(" ").filter(Boolean);
  const last = parts[parts.length - 1];
  const fi = parts.slice(0, -1).map(n => n[0]?.toUpperCase() + ".").join(" ");
  return fi ? `${fi} ${last}` : last;
}

// Prepend author to citation — if no author, start with the rest directly
function withAuthor(a: string, rest: string): string {
  return a ? `${a}, ${rest}` : rest;
}

// =============================================================================
// MISSING FIELD TERMS
// =============================================================================
const M: Record<string, Record<Lang, string>> = {
  date:      { en: "n.d.",               fr: "s.d." },
  place:     { en: "n.p.",               fr: "s.l." },
  publisher: { en: "n.p.",               fr: "s.n." },
  dateVan:   { en: "[date unknown]",     fr: "[date inconnue]" },
  placeVan:  { en: "[place unknown]",    fr: "[lieu inconnu]" },
  pubVan:    { en: "[publisher unknown]",fr: "[éditeur inconnu]" },
  online:    { en: "online",             fr: "en ligne" },
  accessed:  { en: "last visited",       fr: "consulté le" },
  citedVan:  { en: "cited",              fr: "cité le" },
  available: { en: "Available",          fr: "Disponible" },
  editedBy:  { en: "edited by",          fr: "sous la dir. de" },
  in:        { en: "In",                 fr: "Dans" },
  lastMod:   { en: "Last modified",      fr: "Modifié le" },
  published: { en: "Published",          fr: "Publié en" },
  accessed2: { en: "Accessed",           fr: "Consulté le" },
  ed:        { en: "ed",                 fr: "éd" },
  journal:   { en: "[journal?]",         fr: "[revue ?]" },
  booktitle: { en: "[book title?]",      fr: "[titre de l'ouvrage ?]" },
};

function m(key: string, lang: Lang): string {
  return M[key]?.[lang] ?? M[key]?.en ?? "";
}

// =============================================================================
// FORMATTERS
// =============================================================================

export const formatters = {

  // ---------------------------------------------------------------------------
  // McGill Guide (9e éd.)
  // ---------------------------------------------------------------------------
  mcgill: (s: SourceData, lang: Lang = "en"): string => {
    const a = v(s.author);

    if (s.sourceType === "article") {
      const vol   = v(s.volume) ? `${s.volume} ` : "";
      const issue = v(s.issue) ? `:${s.issue}` : "";
      const pages = v(s.pages)  ? ` ${s.pages}`   : "";
      const jour  = italics(v(s.journalName) || m("journal", lang));
      const yr    = v(s.year) || m("date", lang);
      return withAuthor(a, `"${s.title}" (${yr}) ${vol}${issue} ${jour}${pages}.`);
    }

    if (s.sourceType === "website") {
      const yr  = v(s.year) ? `(${s.year})` : `(${m("date", lang)})`;
      const url = v(s.url)  ? `, ${m("online", lang)}: &lt;${s.url}&gt;` : "";
      return withAuthor(a, `${italics(s.title)} ${yr}${url}.`);
    }

    // book or chapter
    const ed    = v(s.edition)       ? `, ${s.edition} ${m("ed", lang)}`  : "";
    const pages = v(s.pages)         ? ` à la p ${s.pages}`               : "";
    const place = v(s.publisherCity) || m("place", lang);
    const pub   = v(s.publisher)     || m("publisher", lang);
    const yr    = v(s.year)          || m("date", lang);
    return withAuthor(a, `${italics(s.title)}${ed} (${place} : ${pub}, ${yr})${pages}.`);
  },

  // ---------------------------------------------------------------------------
  // Bluebook (21st ed.)
  // ---------------------------------------------------------------------------
  bluebook: (s: SourceData, lang: Lang = "en"): string => {
    const a     = v(s.author);
    const place = v(s.publisherCity) || m("place", lang);
    const pub   = v(s.publisher)     || m("publisher", lang);
    const yr    = v(s.year)          || m("date", lang);

    if (s.sourceType === "article") {
      const vol       = v(s.volume) ? `${s.volume} ` : "";
      const jour      = v(s.journalName) || m("journal", lang);
      const firstPage = s.pages ? s.pages.split("-")[0] : "[p. ?]";
      return withAuthor(a, `${italics(s.title)}, ${vol}${jour} ${firstPage} (${yr}).`);
    }
    if (s.sourceType === "website") {
      const acc = v(s.accessDate) ? ` (${m("accessed", lang)} ${s.accessDate})` : "";
      return withAuthor(a, `${italics(s.title)}, ${v(s.url) || "[URL]"}${acc}.`);
    }
    const ed        = v(s.edition) ? ` ${s.edition} ${m("ed", lang)},` : "";
    const firstPage = s.pages ? s.pages.split("-")[0] : "";
    const pp        = firstPage ? ` ${firstPage}` : "";
    return withAuthor(a, `${italics(s.title)}${ed}${pp} (${place}: ${pub}, ${yr}).`);
  },

  // ---------------------------------------------------------------------------
  // Vancouver
  // ---------------------------------------------------------------------------
  vancouver: (s: SourceData, lang: Lang = "en"): string => {
    const a     = initials(s.author);
    const place = v(s.publisherCity) || m("placeVan", lang);
    const pub   = v(s.publisher)     || m("pubVan", lang);
    const yr    = v(s.year)          || m("dateVan", lang);

    if (s.sourceType === "article") {
      const vol   = v(s.volume) || "";
      const issue = v(s.issue)  ? `(${s.issue})` : "";
      const pages = v(s.pages)  ? `:${s.pages}`  : "";
      const doi   = v(s.doi)    ? ` doi:${s.doi}` : "";
      const jour  = italics(v(s.journalName) || m("journal", lang));
      const core  = `${s.title}. ${jour}. ${yr};${vol}${issue}${pages}.${doi}`;
      return a ? `${a}. ${core}` : core;
    }
    if (s.sourceType === "website") {
      const cited = v(s.accessDate) ? ` [${m("citedVan", lang)} ${s.accessDate}]` : "";
      const url   = v(s.url) ? `. ${m("available", lang)}: ${s.url}` : "";
      const core  = `${s.title} [Internet]. ${place}: ${pub}; ${yr}${cited}${url}`;
      return a ? `${a}. ${core}` : core;
    }
    const ed    = v(s.edition) ? `, ${s.edition} ${m("ed", lang)}` : "";
    const pages = v(s.pages)   ? `p. ${s.pages}.` : "";
    const core  = `${s.title}${ed}. ${place}: ${pub}; ${yr}. ${pages}`.trim();
    return a ? `${a}. ${core}` : core;
  },

  // ---------------------------------------------------------------------------
  // IEEE
  // ---------------------------------------------------------------------------
  ieee: (s: SourceData, lang: Lang = "en"): string => {
    const a     = ieeeAuthor(s.author);
    const place = v(s.publisherCity) || m("place", lang);
    const pub   = v(s.publisher)     || m("publisher", lang);
    const yr    = v(s.year)          || m("date", lang);

    if (s.sourceType === "article") {
      const vol  = v(s.volume) ? `, vol. ${s.volume}` : "";
      const no   = v(s.issue)  ? `, no. ${s.issue}`   : "";
      const pp   = v(s.pages)  ? `, pp. ${s.pages}`   : "";
      const doi  = v(s.doi)    ? `, doi: ${s.doi}`    : "";
      const jour = italics(v(s.journalName) || m("journal", lang));
      const core = `"${s.title}," ${jour}${vol}${no}${pp}, ${yr}${doi}.`;
      return a ? `${a}, ${core}` : core;
    }
    if (s.sourceType === "website") {
      const acc  = v(s.accessDate) ? ` (${lang === "fr" ? "consulté le" : "accessed"} ${s.accessDate})` : "";
      const core = `"${s.title}." ${v(s.url) || "[URL]"}${acc}.`;
      return a ? `${a}, ${core}` : core;
    }
    const ed   = v(s.edition) ? `, ${s.edition} ${m("ed", lang)}.` : "";
    const core = `${italics(s.title)}${ed}. ${place}: ${pub}, ${yr}.`;
    return a ? `${a}, ${core}` : core;
  },

  // ---------------------------------------------------------------------------
  // Chicago Notes-Bibliography (17th ed.)
  // ---------------------------------------------------------------------------
  chicago: (s: SourceData, lang: Lang = "en"): string => {
    const a     = v(s.author);
    const place = v(s.publisherCity) || m("place", lang);
    const pub   = v(s.publisher)     || m("publisher", lang);
    const yr    = v(s.year)          || m("date", lang);

    if (s.sourceType === "article") {
      const vol   = v(s.volume) || "";
      const issue = v(s.issue)  ? `, no. ${s.issue}` : "";
      const pages = v(s.pages)  ? `: ${s.pages}`     : "";
      const jour  = italics(v(s.journalName) || m("journal", lang));
      return withAuthor(a, `"${s.title}." ${jour} ${vol}${issue} (${yr})${pages}.`);
    }
    if (s.sourceType === "website") {
      const url = v(s.url) ? ` ${s.url}.` : "";
      return withAuthor(a, `"${s.title}." ${m("lastMod", lang)} ${yr}.${url}`);
    }
    if (s.sourceType === "chapter") {
      const eds   = v(s.editors) ? `${m("editedBy", lang)} ${s.editors}, ` : "";
      const pages = v(s.pages)   ? ` ${s.pages}.` : ".";
      const book  = italics(v(s.bookTitle) || m("booktitle", lang));
      return withAuthor(a, `"${s.title}." ${m("in", lang)} ${book}, ${eds}${place}: ${pub}, ${yr}${pages}`);
    }
    const ed = v(s.edition) ? ` ${s.edition} ${m("ed", lang)}.` : "";
    return withAuthor(a, `${italics(s.title)}.${ed} ${place}: ${pub}, ${yr}.`);
  },

  // ---------------------------------------------------------------------------
  // AMA (11th ed.)
  // ---------------------------------------------------------------------------
  ama: (s: SourceData, lang: Lang = "en"): string => {
    const a   = initials(s.author);
    const pub = v(s.publisher) || m("publisher", lang);
    const yr  = v(s.year)      || m("date", lang);

    if (s.sourceType === "article") {
      const vol   = v(s.volume) || "";
      const issue = v(s.issue)  ? `(${s.issue})` : "";
      const pages = v(s.pages)  ? `:${s.pages}`  : "";
      const jour  = italics(v(s.journalName) || m("journal", lang));
      const core  = `${s.title}. ${jour}. ${yr};${vol}${issue}${pages}.`;
      return a ? `${a}. ${core}` : core;
    }
    if (s.sourceType === "website") {
      const acc  = v(s.accessDate) ? ` ${m("accessed2", lang)} ${s.accessDate}.` : "";
      const url  = v(s.url) ? ` ${s.url}` : "";
      const core = `${s.title}. ${pub}. ${m("published", lang)} ${yr}.${acc}${url}`;
      return a ? `${a}. ${core}` : core;
    }
    const ed   = v(s.edition) ? ` ${s.edition} ${m("ed", lang)}.` : "";
    const core = `${italics(s.title)}.${ed} ${pub}; ${yr}.`;
    return a ? `${a}. ${core}` : core;
  },

  // ---------------------------------------------------------------------------
  // ✏️  ADD YOUR OWN STYLE HERE
  // myStyle: (s: SourceData, lang: Lang = "en"): string => { ... }
  // ---------------------------------------------------------------------------

} as const;

// =============================================================================
// LABELS
// =============================================================================
export const STYLE_LABELS: Record<StyleKey, string> = {
  mcgill:    "McGill Guide (9e éd.)",
  bluebook:  "Bluebook (21st ed.)",
  vancouver: "Vancouver",
  ieee:      "IEEE",
  chicago:   "Chicago Notes-Bibliography (17th ed.)",
  ama:       "AMA (11th ed.)",
};

export const SOURCE_TYPE_LABELS = {
  book:    "Book",
  article: "Journal Article",
  website: "Website",
  chapter: "Book Chapter",
};
