/**
 * Global search (Ctrl+K) — pure functions, no `cloudflare:workers` import, so
 * Vitest can exercise them directly (same pattern as `ratingBands.ts` and
 * `anilist.ts`'s pure helpers). `searchService.ts` does the actual D1 reads
 * and calls these mappers to shape the rows into `SearchResult`s.
 *
 * Only public sections are covered here on purpose: `/streaming` and
 * `/myTodoist` (and their tables) must never be searchable.
 */

import { igdbImage } from './igdbImage';

export type SearchSectionKey = 'games' | 'library' | 'steam' | 'movies' | 'series' | 'manga';

export interface SearchSectionInfo {
  key: SearchSectionKey;
  label: string;
}

/** Order also drives the group order in the UI. */
export const SEARCH_SECTIONS: SearchSectionInfo[] = [
  { key: 'games', label: 'Jugados' },
  { key: 'library', label: 'Biblioteca' },
  { key: 'steam', label: 'Steam' },
  { key: 'movies', label: 'Películas' },
  { key: 'series', label: 'Series' },
  { key: 'manga', label: 'Manga' },
];

export interface SearchResult {
  section: SearchSectionKey;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  image?: string;
}

export interface SearchResultGroup {
  key: SearchSectionKey;
  label: string;
  results: SearchResult[];
}

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

/**
 * Trims and collapses internal whitespace; returns null when the query is
 * too short (< 2 chars) or absurdly long (> 100 chars) to be worth a D1 hit.
 */
export function normalizeSearchQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (collapsed.length < MIN_QUERY_LENGTH || collapsed.length > MAX_QUERY_LENGTH) return null;
  return collapsed;
}

/**
 * Escapes `\`, `%` and `_` (in that order — `\` first, or escaping the other
 * two would double-escape) and wraps the result for a `LIKE ? ESCAPE '\'`
 * query, so a literal `%`/`_` typed by the user is matched literally instead
 * of acting as a wildcard.
 */
function escapeLike(query: string): string {
  return query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function toLikePattern(query: string): string {
  return `%${escapeLike(query)}%`;
}

/** Matches only titles that start with the query; used to rank those first. */
export function toPrefixPattern(query: string): string {
  return `${escapeLike(query)}%`;
}

// ── Row shapes (the columns searchService.ts actually selects per section) ──

export interface GameSearchRow {
  id: number;
  title: string;
  is_demo: number;
  poster: string | null;
}

export interface LibrarySearchRow {
  id: number;
  title: string;
  store: string;
  poster: string | null;
}

export interface SteamSearchRow {
  appid: number;
  name: string;
  poster: string | null;
}

export interface MovieSearchRow {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster: string | null;
}

export interface SeriesSearchRow {
  trakt_slug: string;
  title: string;
  year: number | null;
  poster: string | null;
}

export interface MangaSearchRow {
  anilist_id: number;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  cover: string | null;
}

// ── Row → SearchResult mappers ──

export function mapGameRow(row: GameSearchRow): SearchResult {
  return {
    section: 'games',
    id: String(row.id),
    title: row.title,
    subtitle: row.is_demo ? 'Demo' : undefined,
    href: `/playedGames/${row.id}`,
    image: row.poster ? igdbImage(row.poster, 'cover_small') : undefined,
  };
}

export function mapLibraryRow(row: LibrarySearchRow): SearchResult {
  return {
    section: 'library',
    id: String(row.id),
    title: row.title,
    subtitle: row.store,
    href: '/myLibrary',
    image: row.poster ? igdbImage(row.poster, 'cover_small') : undefined,
  };
}

export function mapSteamRow(row: SteamSearchRow): SearchResult {
  return {
    section: 'steam',
    id: String(row.appid),
    title: row.name,
    href: '/mySteamGames',
    image: row.poster || undefined,
  };
}

export function mapMovieRow(row: MovieSearchRow): SearchResult {
  return {
    section: 'movies',
    id: String(row.tmdb_id),
    title: row.title,
    subtitle: row.year ? String(row.year) : undefined,
    href: `/movies/${row.tmdb_id}`,
    image: row.poster || undefined,
  };
}

export function mapSeriesRow(row: SeriesSearchRow): SearchResult {
  return {
    section: 'series',
    id: row.trakt_slug,
    title: row.title,
    subtitle: row.year ? String(row.year) : undefined,
    href: `/series/${row.trakt_slug}`,
    image: row.poster || undefined,
  };
}

export function mapMangaRow(row: MangaSearchRow): SearchResult {
  return {
    section: 'manga',
    id: String(row.anilist_id),
    title: row.title_english || row.title_romaji,
    href: `/manga/${row.anilist_id}`,
    image: row.cover || undefined,
  };
}

/**
 * Groups flat results by section, in `SEARCH_SECTIONS` order, dropping empty
 * sections so the UI never renders a header with nothing under it.
 */
export function groupResults(results: SearchResult[]): SearchResultGroup[] {
  return SEARCH_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    results: results.filter((r) => r.section === section.key),
  })).filter((group) => group.results.length > 0);
}
