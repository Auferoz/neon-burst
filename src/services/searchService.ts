/**
 * Global search (Ctrl+K) — one LIKE query per public section, run in
 * parallel, mapped through the pure functions in `src/utils/search.ts`.
 *
 * Private sections never appear here on purpose: `/streaming` and
 * `/myTodoist` (streaming_accounts, todo_*) are intentionally excluded.
 */

import {
  toLikePattern,
  toPrefixPattern,
  mapGameRow,
  mapLibraryRow,
  mapSteamRow,
  mapMovieRow,
  mapSeriesRow,
  mapMangaRow,
  type SearchResult,
  type GameSearchRow,
  type LibrarySearchRow,
  type SteamSearchRow,
  type MovieSearchRow,
  type SeriesSearchRow,
  type MangaSearchRow,
} from '../utils/search';

const RESULTS_PER_SECTION = 5;

/**
 * Every query binds ?1 = contains-pattern (the filter) and ?2 = prefix-pattern
 * (the ranking): titles that start with the query come first, then the rest
 * alphabetically. Without it, LIMIT would keep an arbitrary 5 of the matches.
 */
function rankBy(column: string): string {
  return `ORDER BY CASE WHEN ${column} LIKE ?2 ESCAPE '\\' THEN 0 ELSE 1 END, ${column} COLLATE NOCASE`;
}

async function searchGames(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT id, title, is_demo, poster FROM games
     WHERE title LIKE ?1 ESCAPE '\\'
     ${rankBy('title')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<GameSearchRow>();
  return results.map(mapGameRow);
}

async function searchLibrary(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT id, title, store, poster FROM library_games
     WHERE title LIKE ?1 ESCAPE '\\'
     ${rankBy('title')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<LibrarySearchRow>();
  return results.map(mapLibraryRow);
}

async function searchSteam(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT appid, name, poster FROM steam_cache
     WHERE name LIKE ?1 ESCAPE '\\'
     ${rankBy('name')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<SteamSearchRow>();
  return results.map(mapSteamRow);
}

async function searchMovies(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT DISTINCT mc.tmdb_id AS tmdb_id, mc.title AS title, mc.year AS year, mc.poster AS poster
     FROM movies_cache mc
     JOIN movies_watched mw ON mw.tmdb_id = mc.tmdb_id
     WHERE mc.title LIKE ?1 ESCAPE '\\'
     ${rankBy('mc.title')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<MovieSearchRow>();
  return results.map(mapMovieRow);
}

async function searchSeries(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT DISTINCT sc.trakt_slug AS trakt_slug, sc.title AS title, sc.year AS year, sc.poster AS poster
     FROM series_cache sc
     JOIN series_watched sw ON sw.trakt_slug = sc.trakt_slug
     WHERE sc.title LIKE ?1 ESCAPE '\\'
     ${rankBy('sc.title')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<SeriesSearchRow>();
  return results.map(mapSeriesRow);
}

async function searchManga(db: D1Database, pattern: string, prefix: string): Promise<SearchResult[]> {
  const { results } = await db.prepare(
    `SELECT DISTINCT mc.anilist_id AS anilist_id, mc.title_romaji AS title_romaji,
            mc.title_english AS title_english, mc.title_native AS title_native, mc.cover AS cover
     FROM manga_cache mc
     JOIN manga_read mr ON mr.anilist_id = mc.anilist_id
     WHERE mc.title_romaji LIKE ?1 ESCAPE '\\'
        OR mc.title_english LIKE ?1 ESCAPE '\\'
        OR mc.title_native LIKE ?1 ESCAPE '\\'
     ${rankBy('COALESCE(mc.title_english, mc.title_romaji)')}
     LIMIT ${RESULTS_PER_SECTION}`
  ).bind(pattern, prefix).all<MangaSearchRow>();
  return results.map(mapMangaRow);
}

/** Runs one LIKE query per public section in parallel and flattens the results. */
export async function searchAll(db: D1Database, query: string): Promise<SearchResult[]> {
  const pattern = toLikePattern(query);
  const prefix = toPrefixPattern(query);

  const sections = await Promise.all([
    searchGames(db, pattern, prefix),
    searchLibrary(db, pattern, prefix),
    searchSteam(db, pattern, prefix),
    searchMovies(db, pattern, prefix),
    searchSeries(db, pattern, prefix),
    searchManga(db, pattern, prefix),
  ]);

  return sections.flat();
}
