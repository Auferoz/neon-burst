/**
 * Movies sync — fetches movie lists from Trakt API
 * and caches them in D1 (movies_cache + movies_lists tables).
 */

import { env } from 'cloudflare:workers';

const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID;
const TRAKT_USERNAME = 'Auferoz';
const TRAKT_API_URL = 'https://api.trakt.tv';

const traktHeaders = {
  'Content-Type': 'application/json',
  'trakt-api-key': TRAKT_CLIENT_ID,
  'trakt-api-version': '2',
  'User-Agent': 'neon-burst/1.0',
};

interface TraktListItem {
  listed_at: string;
  movie: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    runtime: number;
    genres: string[];
    overview: string;
    rating: number;
    released: string;
    images?: { poster?: string[]; fanart?: string[]; thumb?: string[] };
  };
}

interface TraktList {
  name: string;
  ids: { trakt: number; slug: string };
  description: string;
  item_count: number;
}

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

async function fetchUserMovieLists(): Promise<TraktList[]> {
  const res = await fetch(`${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists`, {
    headers: traktHeaders,
  });
  if (!res.ok) return [];
  const lists = await res.json() as TraktList[];
  return lists.filter(l => l.ids.slug.startsWith('movies-'));
}

async function fetchListItems(slug: string): Promise<TraktListItem[]> {
  const res = await fetch(
    `${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists/${slug}/items/movies?extended=full`,
    { headers: traktHeaders }
  );
  if (!res.ok) return [];
  return await res.json() as TraktListItem[];
}

/**
 * Cron sync — only syncs the current year list (movies-YYYY).
 * Does NOT delete other years' data. Uses INSERT OR REPLACE so existing
 * data for the current year is updated safely.
 */
export async function syncMovies(db: D1Database): Promise<{ synced: number; errors: number; lists: number }> {
  // Create tables if needed
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movies_lists (
      slug TEXT PRIMARY KEY, description TEXT, item_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movies_cache (
      trakt_id INTEGER PRIMARY KEY, tmdb_id INTEGER, imdb_id TEXT,
      title TEXT NOT NULL, year INTEGER, released TEXT, runtime INTEGER DEFAULT 0,
      genres TEXT, overview TEXT, rating REAL DEFAULT 0, poster TEXT, thumb TEXT,
      list_slug TEXT, list_order INTEGER DEFAULT 0, listed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const currentYear = new Date().getFullYear();
  const currentSlug = `movies-${currentYear}`;

  // Fetch all user lists to find the current year's list
  const movieLists = await fetchUserMovieLists();
  const currentList = movieLists.find(l => l.ids.slug === currentSlug);
  if (!currentList) return { synced: 0, errors: 0, lists: 0 };

  // Fetch items for current year only
  const items = await fetchListItems(currentSlug);
  if (!items.length) return { synced: 0, errors: 0, lists: 1 };

  // Upsert list metadata
  await db.prepare(
    `INSERT OR REPLACE INTO movies_lists (slug, description, item_count, updated_at) VALUES (?, ?, ?, datetime('now'))`
  ).bind(currentSlug, currentList.description || '', items.length).run();

  let synced = 0, errors = 0;

  // Batch upsert in chunks of 50 — preserves detail columns (cast_json, videos_json, etc.)
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const stmt = db.prepare(
      `INSERT INTO movies_cache
        (trakt_id, tmdb_id, imdb_id, title, year, released, runtime, genres, overview, rating, poster, thumb, list_slug, list_order, listed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(trakt_id) DO UPDATE SET
        tmdb_id=excluded.tmdb_id, imdb_id=excluded.imdb_id, title=excluded.title,
        year=excluded.year, released=excluded.released, runtime=excluded.runtime,
        genres=excluded.genres, overview=excluded.overview, rating=excluded.rating,
        poster=excluded.poster, thumb=excluded.thumb, list_slug=excluded.list_slug,
        list_order=excluded.list_order, listed_at=excluded.listed_at, updated_at=excluded.updated_at`
    );

    const ops = [];
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const m = item.movie;
      const poster = traktImage(m.images?.poster?.[0]);
      const thumb = traktImage(m.images?.fanart?.[0] || m.images?.thumb?.[0]);

      ops.push(stmt.bind(
        m.ids.trakt, m.ids.tmdb || null, m.ids.imdb || '',
        m.title, m.year || null, m.released || '',
        m.runtime || 0, m.genres?.join(', ') || '', m.overview || '',
        Math.round((m.rating || 0) * 10) / 10, poster, thumb, currentSlug, i + j,
        item.listed_at || '',
      ));
    }

    try {
      await db.batch(ops);
      synced += batch.length;
    } catch {
      errors += batch.length;
    }
  }

  return { synced, errors, lists: 1 };
}
