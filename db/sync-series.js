/**
 * Sync series_cache from Trakt API — refreshes show metadata + TMDB posters
 * for all shows in series_watched.
 *
 * Usage: node --env-file=.env db/sync-series.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
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

async function fetchShowInfo(slug) {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'trakt-api-version': '2',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchTmdbPoster(tmdbId) {
  if (!tmdbId || !TMDB_API_KEY) return '';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  } catch { return ''; }
}

async function main() {
  console.log(`Syncing series cache from Trakt (${TARGET})...\n`);

  // Get unique slugs from series_watched
  const output = d1('SELECT DISTINCT trakt_slug FROM series_watched');
  const slugMatch = output.match(/"trakt_slug":\s*"([^"]+)"/g);
  if (!slugMatch) {
    console.log('No series found in series_watched.');
    return;
  }

  const slugs = slugMatch.map(m => m.match(/"trakt_slug":\s*"([^"]+)"/)[1]);
  console.log(`Found ${slugs.length} unique shows to sync.\n`);

  let synced = 0, errors = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug}... `);

    const show = await fetchShowInfo(slug);
    await sleep(300);

    if (!show) {
      errors++;
      console.log('NOT FOUND');
      continue;
    }

    let poster = '';
    if (show.ids?.tmdb) {
      poster = await fetchTmdbPoster(show.ids.tmdb);
      await sleep(200);
    }

    const rating = Math.round((show.rating || 0) * 10) / 10;
    const genres = show.genres?.join(', ') || '';

    const sql = `INSERT OR REPLACE INTO series_cache (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, updated_at) VALUES ('${esc(show.ids?.slug || slug)}', ${show.ids?.trakt || 'NULL'}, ${show.ids?.tmdb || 'NULL'}, '${esc(show.ids?.imdb || '')}', '${esc(show.title)}', ${show.year || 'NULL'}, '${esc(show.overview || '')}', ${rating}, '${esc(genres)}', '${esc(show.network || '')}', '${esc(show.status || '')}', ${show.runtime || 0}, '${esc(poster)}', datetime('now'))`;

    d1(sql);
    synced++;

    const parts = [];
    parts.push(poster ? 'Poster' : 'No Poster');
    parts.push(`Rating ${rating}`);
    parts.push(show.network || 'No Network');
    console.log(`OK (${parts.join(', ')})`);
  }

  console.log(`\nDone! Synced: ${synced}, Errors: ${errors}`);
}

main().catch(console.error);
