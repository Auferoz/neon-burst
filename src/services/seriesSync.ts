/**
 * Series sync — fetches show metadata from Trakt API
 * and caches them in D1 (series_cache table).
 *
 * Unlike movies, the watched list is managed manually by the user.
 * This service only syncs show metadata for slugs present in series_watched.
 */

import { env } from 'cloudflare:workers';

const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID;
const TRAKT_API_URL = 'https://api.trakt.tv';

const traktHeaders = {
  'Content-Type': 'application/json',
  'trakt-api-key': TRAKT_CLIENT_ID,
  'trakt-api-version': '2',
  'User-Agent': 'neon-burst/1.0',
};

interface TraktShow {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  overview: string;
  runtime: number;
  rating: number;
  genres: string[];
  network: string;
  status: string;
  images?: { poster?: string[]; fanart?: string[]; thumb?: string[] };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

async function fetchShowInfo(slug: string): Promise<TraktShow | null> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: traktHeaders,
    });
    if (!res.ok) return null;
    return await res.json() as TraktShow;
  } catch { return null; }
}

/**
 * Fetch and cache a single show by slug.
 * Called when user adds a new series entry and it's not cached yet.
 */
export async function syncSingleShow(db: D1Database, slug: string): Promise<boolean> {
  const show = await fetchShowInfo(slug);
  if (!show) return false;

  const poster = traktImage(show.images?.poster?.[0]);
  const thumb = traktImage(show.images?.fanart?.[0] || show.images?.thumb?.[0]);

  await db.prepare(
    `INSERT OR REPLACE INTO series_cache
      (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, thumb, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    slug, show.ids.trakt, show.ids.tmdb || null, show.ids.imdb || '',
    show.title, show.year || null, show.overview || '',
    Math.round((show.rating || 0) * 10) / 10,
    show.genres?.join(', ') || '', show.network || '', show.status || '',
    show.runtime || 0, poster, thumb,
  ).run();

  return true;
}

/**
 * Cron sync — syncs metadata for shows watched in current year or with ongoing status.
 */
export async function syncSeries(db: D1Database): Promise<{ synced: number; errors: number }> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS series_cache (
      trakt_slug TEXT PRIMARY KEY, trakt_id INTEGER, tmdb_id INTEGER, imdb_id TEXT,
      title TEXT NOT NULL, year INTEGER, overview TEXT, rating REAL DEFAULT 0,
      genres TEXT, network TEXT, status TEXT, runtime INTEGER DEFAULT 0,
      poster TEXT, thumb TEXT, updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS series_watched (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trakt_slug TEXT NOT NULL,
      season_number INTEGER NOT NULL, year_watched INTEGER NOT NULL,
      platform TEXT, status_viewed TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(trakt_slug, season_number)
    )
  `).run();

  const currentYear = new Date().getFullYear();

  // Get unique slugs for current year or ongoing series
  const { results: rows } = await db.prepare(
    `SELECT DISTINCT trakt_slug FROM series_watched
     WHERE year_watched = ? OR status_viewed = 'ongoing'`
  ).bind(currentYear).all<{ trakt_slug: string }>();

  if (!rows.length) return { synced: 0, errors: 0 };

  let synced = 0, errors = 0;

  for (const row of rows) {
    const show = await fetchShowInfo(row.trakt_slug);
    await sleep(300);

    if (!show) { errors++; continue; }

    const poster = traktImage(show.images?.poster?.[0]);
    const thumb = traktImage(show.images?.fanart?.[0] || show.images?.thumb?.[0]);

    try {
      await db.prepare(
        `INSERT OR REPLACE INTO series_cache
          (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, thumb, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        row.trakt_slug, show.ids.trakt, show.ids.tmdb || null, show.ids.imdb || '',
        show.title, show.year || null, show.overview || '',
        Math.round((show.rating || 0) * 10) / 10,
        show.genres?.join(', ') || '', show.network || '', show.status || '',
        show.runtime || 0, poster, thumb,
      ).run();
      synced++;
    } catch { errors++; }
  }

  return { synced, errors };
}
