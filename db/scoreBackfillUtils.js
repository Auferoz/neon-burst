/**
 * Pure helpers shared by the score backfill scripts (db/fetch-*-scores.js).
 * Plain JS on purpose: these scripts run standalone via `node --env-file=.env`,
 * outside the Astro/Cloudflare toolchain, so they can't import from src/.
 */

/** Escape a value for a single-quoted SQL literal. */
export function sqlQuote(value) {
  return String(value).replace(/'/g, "''");
}

/**
 * Converts a Trakt slug into a search term + optional year.
 * "the-office-2005" → { query: "the office", year: 2005 }
 * "my-hero-academia" → { query: "my hero academia" }
 * Mirrors src/utils/mediaQuery.ts#slugToQuery (kept separate: that module is
 * TS and imports nothing these scripts can reach).
 */
export function slugToSearchQuery(slug) {
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /^\d{4}$/.test(last)) {
    const year = Number(last);
    if (year >= 1900 && year <= new Date().getFullYear() + 5) {
      return { query: parts.slice(0, -1).join(' '), year };
    }
  }
  return { query: parts.join(' ') };
}
