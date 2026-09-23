/**
 * Fetch TMDB + IMDb (OMDb) scores for movies and update D1 directly.
 * Usage: npm run fetch-movie-scores [-- --missing] [-- --limit N] [-- --remote]
 *        npm run fetch-movie-scores:remote -- --missing
 *
 * Requires the wrangler CLI to read/update the database.
 *
 * tmdb_id is stable between the local and remote databases (unlike the ids in
 * `games`), so this script generates `UPDATE movies_cache SET ... WHERE
 * tmdb_id = X` and can run the exact same SQL against both without any
 * title-matching trick.
 *
 * It always applies with `wrangler d1 execute ... --command`, batching
 * several UPDATEs per call: `--file` against `--remote` fails with auth
 * error 10000 (see CLAUDE.md).
 *
 * --missing only processes movies still missing a score, per field, to save
 * OMDb's daily quota (1000 requests/day, free tier). --limit N caps how many
 * movies are processed in one run.
 */

const REMOTE = process.argv.includes('--remote');
const ONLY_MISSING = process.argv.includes('--missing');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : null;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Escape a value for a single-quoted SQL literal. */
const sqlQuote = s => String(s).replace(/'/g, "''");

/** "7.8" → 78; "N/A" or empty → null. Mirrors src/services/omdb.ts. */
function parseImdbRating(raw) {
  if (!raw || raw === 'N/A') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10);
}

async function fetchTmdbScore(tmdbId) {
  if (!TMDB_API_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
  if (!res.ok) {
    console.error(`  TMDB error for ${tmdbId}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (!data.vote_count) return null; // sin votos todavía: null, no 0
  return Math.round((data.vote_average || 0) * 10);
}

/** Para películas sin imdb_id guardado todavía. */
async function fetchTmdbImdbId(tmdbId) {
  if (!TMDB_API_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
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
    `npx wrangler d1 execute neon-burst-db ${flag} --command "SELECT tmdb_id, imdb_id, title FROM movies_cache ${where}ORDER BY title ASC${limitClause};" --json`,
    { encoding: 'utf-8', cwd: process.cwd() }
  );

  const parsed = JSON.parse(output);
  const movies = parsed[0].results;

  if (movies.length === 0) {
    console.log('Nothing to fetch — every movie already has both scores.');
    return;
  }

  console.log(
    ONLY_MISSING
      ? `Found ${movies.length} movies with a missing score. Fetching...\n`
      : `Found ${movies.length} movies. Fetching scores...\n`
  );

  const updates = [];

  for (const movie of movies) {
    // Rate limit: be nice to both APIs.
    await sleep(200);

    const tmdbScore = await fetchTmdbScore(movie.tmdb_id);

    let imdbId = movie.imdb_id;
    if (!imdbId) {
      imdbId = await fetchTmdbImdbId(movie.tmdb_id);
      await sleep(200);
    }

    const imdbScore = imdbId ? await fetchImdbRating(imdbId) : null;

    if (tmdbScore == null && imdbScore == null) {
      console.log(`✗ ${movie.title} → no score found`);
      continue;
    }

    console.log(`✓ ${movie.title} → TMDB: ${tmdbScore ?? '—'} | IMDb: ${imdbScore ?? '—'}`);

    const parts = [];
    if (tmdbScore != null) parts.push(`rating_tmdb = ${tmdbScore}`);
    if (imdbScore != null) parts.push(`rating_imdb = ${imdbScore}`);
    if (imdbId && !movie.imdb_id) parts.push(`imdb_id = '${sqlQuote(imdbId)}'`);
    parts.push("ratings_fetched_at = datetime('now')");

    // Keyed by tmdb_id: unlike `games`, it IS stable between local and remote.
    updates.push(`UPDATE movies_cache SET ${parts.join(', ')} WHERE tmdb_id = ${movie.tmdb_id};`);
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

  console.log(`\nUpdated ${updates.length} movies.`);
}

main().catch(console.error);
