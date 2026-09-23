/**
 * Fetch TMDB + IMDb (OMDb) scores for series and update D1 directly.
 * Usage: npm run fetch-series-scores [-- --missing] [-- --limit N] [-- --remote]
 *        npm run fetch-series-scores:remote -- --missing
 *
 * Requires the wrangler CLI to read/update the database.
 *
 * Mirrors db/fetch-movie-scores.js, keyed by trakt_slug instead of tmdb_id:
 * trakt_slug is series_cache's PRIMARY KEY and always present, unlike
 * tmdb_id/imdb_id which can be null when a show came in from Trakt without
 * them. When tmdb_id is missing this script resolves it the same way
 * src/services/tmdbSeries.ts#lookupTmdbTvId does (title + year search), just
 * duplicated in plain JS since this script can't import TS from src/.
 *
 * It always applies with `wrangler d1 execute ... --command`, batching
 * several UPDATEs per call: `--file` against `--remote` fails with auth
 * error 10000 (see CLAUDE.md).
 *
 * --missing only processes series still missing a score, per field, to save
 * OMDb's daily quota (1000 requests/day, free tier). --limit N caps how many
 * series are processed in one run.
 */

import { sqlQuote, slugToSearchQuery } from './scoreBackfillUtils.js';

const REMOTE = process.argv.includes('--remote');
const ONLY_MISSING = process.argv.includes('--missing');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : null;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** "7.8" → 78; "N/A" or empty → null. Mirrors src/services/omdb.ts. */
function parseImdbRating(raw) {
  if (!raw || raw === 'N/A') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10);
}

async function fetchTmdbTvId(slug) {
  if (!TMDB_API_KEY) return null;
  const { query, year } = slugToSearchQuery(slug);
  const yearParam = year ? `&first_air_date_year=${year}` : '';
  const res = await fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}${yearParam}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.length && year) {
    const retry = await fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    if (!retry.ok) return null;
    const retryData = await retry.json();
    return retryData.results?.[0]?.id || null;
  }
  return data.results?.[0]?.id || null;
}

async function fetchTmdbTvScore(tmdbId) {
  if (!TMDB_API_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
  if (!res.ok) {
    console.error(`  TMDB error for ${tmdbId}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (!data.vote_count) return null; // sin votos todavía: null, no 0
  return Math.round((data.vote_average || 0) * 10);
}

/** Para series sin imdb_id guardado todavía. */
async function fetchTmdbTvImdbId(tmdbId) {
  if (!TMDB_API_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.imdb_id || null;
}

async function fetchImdbRating(imdbId) {
  if (!OMDB_API_KEY || !imdbId) return null;
  const res = await fetch(`${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`);
  if (!res.ok) {
    console.error(`  OMDb error for ${imdbId}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (data.Response === 'False') return null;
  return parseImdbRating(data.imdbRating);
}

async function main() {
  if (!TMDB_API_KEY) {
    console.warn('⚠ TMDB_API_KEY missing — skipping TMDB scores.');
  }
  if (!OMDB_API_KEY) {
    console.warn('⚠ OMDB_API_KEY missing — skipping IMDb scores.');
  }
  if (!TMDB_API_KEY && !OMDB_API_KEY) {
    console.error('No API keys configured. Nothing to fetch.');
    return;
  }

  const { execSync } = await import('node:child_process');
  const flag = REMOTE ? '--remote' : '--local';

  const where = ONLY_MISSING
    ? "WHERE rating_tmdb IS NULL OR (imdb_id IS NOT NULL AND imdb_id != '' AND rating_imdb IS NULL) "
    : '';
  const limitClause = LIMIT ? ` LIMIT ${LIMIT}` : '';

  const output = execSync(
    `npx wrangler d1 execute neon-burst-db ${flag} --command "SELECT trakt_slug, tmdb_id, imdb_id, title FROM series_cache ${where}ORDER BY title ASC${limitClause};" --json`,
    { encoding: 'utf-8', cwd: process.cwd() }
  );

  const parsed = JSON.parse(output);
  const shows = parsed[0].results;

  if (shows.length === 0) {
    console.log('Nothing to fetch — every series already has both scores.');
    return;
  }

  console.log(
    ONLY_MISSING
      ? `Found ${shows.length} series with a missing score. Fetching...\n`
      : `Found ${shows.length} series. Fetching scores...\n`
  );

  const updates = [];

  for (const show of shows) {
    // Rate limit: be nice to both APIs.
    await sleep(200);

    let tmdbId = show.tmdb_id;
    if (!tmdbId) {
      tmdbId = await fetchTmdbTvId(show.trakt_slug);
      await sleep(200);
    }

    const tmdbScore = tmdbId ? await fetchTmdbTvScore(tmdbId) : null;

    let imdbId = show.imdb_id;
    if (!imdbId && tmdbId) {
      imdbId = await fetchTmdbTvImdbId(tmdbId);
      await sleep(200);
    }

    const imdbScore = imdbId ? await fetchImdbRating(imdbId) : null;

    if (tmdbScore == null && imdbScore == null) {
      console.log(`✗ ${show.title} → no score found`);
      continue;
    }

    console.log(`✓ ${show.title} → TMDB: ${tmdbScore ?? '—'} | IMDb: ${imdbScore ?? '—'}`);

    const parts = [];
    if (tmdbScore != null) parts.push(`rating_tmdb = ${tmdbScore}`);
    if (imdbScore != null) parts.push(`rating_imdb = ${imdbScore}`);
    if (tmdbId && !show.tmdb_id) parts.push(`tmdb_id = ${tmdbId}`);
    if (imdbId && !show.imdb_id) parts.push(`imdb_id = '${sqlQuote(imdbId)}'`);
    parts.push("ratings_fetched_at = datetime('now')");

    // Keyed by trakt_slug: series_cache's PRIMARY KEY, stable between local and remote.
    updates.push(`UPDATE series_cache SET ${parts.join(', ')} WHERE trakt_slug = '${sqlQuote(show.trakt_slug)}';`);
  }

  if (updates.length === 0) {
    console.log('\nNo scores to update.');
    return;
  }

  // Applied with --command, batched, never --file: --file against --remote
  // fails with auth error 10000.
  const BATCH_SIZE = 20;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE).join(' ');
    execSync(
      `npx wrangler d1 execute neon-burst-db ${flag} --command "${batch}"`,
      { encoding: 'utf-8', cwd: process.cwd(), stdio: 'inherit' }
    );
  }

  console.log(`\nUpdated ${updates.length} series.`);
}

main().catch(console.error);
