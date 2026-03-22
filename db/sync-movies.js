/**
 * Sync movies from Trakt API — Fetches movie lists + TMDB posters
 * and caches them in D1.
 *
 * Usage: node db/sync-movies.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TRAKT_USERNAME = 'Auferoz';
const TRAKT_API_URL = 'https://api.trakt.tv';
const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

function d1(sql, dbTarget = TARGET) {
  const cmd = `npx wrangler d1 execute neon-burst-db ${dbTarget} --command="${sql.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (str) => str ? str.replace(/'/g, "''") : '';

// ── Trakt API ──

async function fetchUserMovieLists() {
  const res = await fetch(`${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists`, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-key': TRAKT_CLIENT_ID,
      'trakt-api-version': '2',
    },
  });
  if (!res.ok) throw new Error(`Trakt lists API error: ${res.status}`);
  const lists = await res.json();
  return lists.filter(l => l.ids.slug.startsWith('movies-'));
}

async function fetchListItems(slug) {
  const res = await fetch(
    `${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists/${slug}/items/movies?extended=full`,
    {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'trakt-api-version': '2',
      },
    }
  );
  if (!res.ok) return [];
  return await res.json();
}

// ── TMDB Poster ──

async function fetchTmdbPoster(tmdbId) {
  if (!tmdbId || !TMDB_API_KEY) return '';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  } catch {
    return '';
  }
}

// ── Main ──

async function main() {
  console.log(`Syncing movies from Trakt (${TARGET})...\n`);

  // Create tables
  d1(`CREATE TABLE IF NOT EXISTS movies_lists (
    slug TEXT PRIMARY KEY, description TEXT, item_count INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  d1(`CREATE TABLE IF NOT EXISTS movies_cache (
    trakt_id INTEGER PRIMARY KEY, tmdb_id INTEGER, imdb_id TEXT,
    title TEXT NOT NULL, year INTEGER, released TEXT, runtime INTEGER DEFAULT 0,
    genres TEXT, overview TEXT, rating REAL DEFAULT 0, poster TEXT,
    list_slug TEXT, list_order INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
  )`);
  d1(`CREATE INDEX IF NOT EXISTS idx_movies_cache_year ON movies_cache(year)`);
  d1(`CREATE INDEX IF NOT EXISTS idx_movies_cache_list ON movies_cache(list_slug)`);
  d1(`CREATE INDEX IF NOT EXISTS idx_movies_cache_title ON movies_cache(title)`);

  // Fetch lists dynamically
  console.log('Fetching Trakt lists...');
  const movieLists = await fetchUserMovieLists();
  console.log(`Found ${movieLists.length} movie lists: ${movieLists.map(l => l.ids.slug).join(', ')}\n`);

  // Clear old cache
  d1('DELETE FROM movies_cache');

  let totalSynced = 0;
  let totalErrors = 0;

  for (const list of movieLists) {
    const slug = list.ids.slug;
    console.log(`\n── ${slug} ──`);

    const items = await fetchListItems(slug);
    console.log(`  ${items.length} movies found`);
    await sleep(300);

    // Upsert list metadata
    d1(`INSERT OR REPLACE INTO movies_lists (slug, description, item_count, updated_at) VALUES ('${esc(slug)}', '${esc(list.description || '')}', ${items.length}, datetime('now'))`);

    for (let i = 0; i < items.length; i++) {
      const m = items[i].movie;
      const title = m.title;

      process.stdout.write(`  [${i + 1}/${items.length}] ${title}... `);

      try {
        // Fetch poster
        let poster = '';
        if (m.ids.tmdb) {
          poster = await fetchTmdbPoster(m.ids.tmdb);
          await sleep(200);
        }

        const genres = m.genres?.join(', ') || '';
        const rating = Math.round((m.rating || 0) * 10) / 10;

        const listedAt = items[i].listed_at || '';
        const sql = `INSERT OR REPLACE INTO movies_cache (trakt_id, tmdb_id, imdb_id, title, year, released, runtime, genres, overview, rating, poster, list_slug, list_order, listed_at, updated_at) VALUES (${m.ids.trakt}, ${m.ids.tmdb || 'NULL'}, '${esc(m.ids.imdb || '')}', '${esc(title)}', ${m.year || 'NULL'}, '${esc(m.released || '')}', ${m.runtime || 0}, '${esc(genres)}', '${esc(m.overview || '')}', ${rating}, '${esc(poster)}', '${esc(slug)}', ${i}, '${esc(listedAt)}', datetime('now'))`;

        d1(sql);
        totalSynced++;

        const parts = [];
        parts.push(poster ? 'Poster' : 'No Poster');
        parts.push(`Rating ${rating}`);
        parts.push(m.runtime ? `${m.runtime}m` : 'No Runtime');
        console.log(`OK (${parts.join(', ')})`);
      } catch {
        totalErrors++;
        console.log('ERROR');
      }
    }
  }

  console.log(`\nDone! Synced: ${totalSynced}, Errors: ${totalErrors}, Lists: ${movieLists.length}`);
}

main().catch(console.error);
