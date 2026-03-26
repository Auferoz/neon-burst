/**
 * Sync series_cache from Trakt API — refreshes show metadata
 * for all shows in series_watched.
 *
 * Usage: node --env-file=.env db/sync-series.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_API_URL = 'https://api.trakt.tv';
const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

function d1(sql, dbTarget = TARGET) {
  const cmd = `npx wrangler d1 execute neon-burst-db ${dbTarget} --command="${sql.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`D1 error: ${e.stderr || e.message}`);
    return '';
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (str) => str ? str.replace(/'/g, "''") : '';

function traktImage(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

async function fetchShowInfo(slug) {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'trakt-api-version': '2',
        'User-Agent': 'neon-burst/1.0',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
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

    const poster = traktImage(show.images?.poster?.[0]);
    const thumb = traktImage(show.images?.fanart?.[0] || show.images?.thumb?.[0]);
    const rating = Math.round((show.rating || 0) * 10) / 10;
    const genres = show.genres?.join(', ') || '';

    const sql = `INSERT INTO series_cache (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, thumb, updated_at) VALUES ('${esc(slug)}', ${show.ids?.trakt || 'NULL'}, ${show.ids?.tmdb || 'NULL'}, '${esc(show.ids?.imdb || '')}', '${esc(show.title)}', ${show.year || 'NULL'}, '${esc(show.overview || '')}', ${rating}, '${esc(genres)}', '${esc(show.network || '')}', '${esc(show.status || '')}', ${show.runtime || 0}, '${esc(poster)}', '${esc(thumb)}', datetime('now')) ON CONFLICT(trakt_slug) DO UPDATE SET trakt_id=excluded.trakt_id, tmdb_id=excluded.tmdb_id, imdb_id=excluded.imdb_id, title=excluded.title, year=excluded.year, overview=excluded.overview, rating=excluded.rating, genres=excluded.genres, network=excluded.network, status=excluded.status, runtime=excluded.runtime, poster=excluded.poster, thumb=excluded.thumb, updated_at=excluded.updated_at`;

    d1(sql);
    synced++;

    const parts = [];
    parts.push(poster ? 'Poster' : 'No Poster');
    parts.push(thumb ? 'Thumb' : 'No Thumb');
    parts.push(`Rating ${rating}`);
    parts.push(show.network || 'No Network');
    console.log(`OK (${parts.join(', ')})`);
  }

  console.log(`\nDone! Synced: ${synced}, Errors: ${errors}`);
}

main().catch(console.error);
