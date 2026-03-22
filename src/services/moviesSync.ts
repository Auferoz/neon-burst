/**
 * Movies sync — fetches movie lists from Trakt API + posters from TMDB
 * and caches them in D1 (movies_cache + movies_lists tables).
 */

import { env } from 'cloudflare:workers';

const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID;
const TMDB_API_KEY = env.TMDB_API_KEY;
const TRAKT_USERNAME = 'Auferoz';
const TRAKT_API_URL = 'https://api.trakt.tv';

const traktHeaders = {
  'Content-Type': 'application/json',
  'trakt-api-key': TRAKT_CLIENT_ID,
  'trakt-api-version': '2',
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
  };
}

interface TraktList {
  name: string;
  ids: { trakt: number; slug: string };
  description: string;
  item_count: number;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

async function fetchTmdbPoster(tmdbId: number): Promise<string> {
  if (!tmdbId || !TMDB_API_KEY) return '';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return '';
    const data = await res.json() as { poster_path?: string };
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  } catch { return ''; }
}

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
      genres TEXT, overview TEXT, rating REAL DEFAULT 0, poster TEXT,
      list_slug TEXT, list_order INTEGER DEFAULT 0, listed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Fetch user lists dynamically (filter movies-*)
  const movieLists = await fetchUserMovieLists();
  if (!movieLists.length) return { synced: 0, errors: 0, lists: 0 };

  // Clear old cache (full refresh)
  await db.prepare('DELETE FROM movies_cache').run();

  let synced = 0, errors = 0;

  for (const list of movieLists) {
    const items = await fetchListItems(list.ids.slug);
    await sleep(300);

    // Upsert list metadata
    await db.prepare(
      `INSERT OR REPLACE INTO movies_lists (slug, description, item_count, updated_at) VALUES (?, ?, ?, datetime('now'))`
    ).bind(list.ids.slug, list.description || '', items.length).run();

    // Batch insert movies in chunks of 50
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50);
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO movies_cache
          (trakt_id, tmdb_id, imdb_id, title, year, released, runtime, genres, overview, rating, poster, list_slug, list_order, listed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      const ops = [];
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const m = item.movie;
        let poster = '';
        if (m.ids.tmdb) {
          poster = await fetchTmdbPoster(m.ids.tmdb);
          await sleep(200);
        }

        ops.push(stmt.bind(
          m.ids.trakt, m.ids.tmdb || null, m.ids.imdb || '',
          m.title, m.year || null, m.released || '',
          m.runtime || 0, m.genres?.join(', ') || '', m.overview || '',
          Math.round((m.rating || 0) * 10) / 10, poster, list.ids.slug, i + j,
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
  }

  return { synced, errors, lists: movieLists.length };
}
