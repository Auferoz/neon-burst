/**
 * Fetch ratings from RAWG and OpenCritic, then update the D1 database.
 * Usage: npm run fetch-ratings
 *        npm run fetch-ratings:missing   (only fills in what is still NULL)
 *
 * Requires wrangler CLI to update the database.
 *
 * RAWG is only used as an internal source for the Metacritic score — its own
 * user rating is not stored anymore. OpenCritic provides topCriticScore (0-100).
 * Whatever neither API returns stays NULL and is filled in by hand from the
 * game form modal.
 *
 * The OpenCritic free tier runs out well before the catalogue does (it costs
 * two requests per game), so --only-missing skips every rating that is already
 * stored, per field. Without it each run burns quota re-fetching what it
 * already resolved and never reaches the end of the list.
 *
 * --only-missing reads what is already stored from the LOCAL database, so the
 * previous run's db/ratings.sql has to be applied locally first — otherwise
 * every rating still looks NULL and nothing gets skipped.
 *
 * The generated db/ratings.sql keys its updates by title. Game ids are NOT
 * stable between the local and remote databases, so an id-keyed file read from
 * local writes the ratings onto the wrong rows when applied with --remote.
 */

const ONLY_MISSING = process.argv.includes('--only-missing');

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = 'https://api.rawg.io/api';

const OPENCRITIC_API_KEY = process.env.OPENCRITIC_API_KEY;
const OPENCRITIC_HOST = 'opencritic-api.p.rapidapi.com';
const OPENCRITIC_BASE = `https://${OPENCRITIC_HOST}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Escape a value for a single-quoted SQL literal (e.g. "A Thief's End"). */
const sqlQuote = s => s.replace(/'/g, "''");

function cleanTitle(title) {
  return title
    .replace(/\s*\|.*$/, '')       // Remove " | C1" suffixes
    .replace(/\s*DEMO$/i, '')      // Remove DEMO
    .replace(/[®™©]/g, '')        // Remove trademark symbols
    .replace(/\s*\(\d{4}\)/, '')   // Remove (2003) year suffixes
    .trim();
}

/**
 * RAWG — used only to read the Metacritic score.
 */
async function fetchRawgMetacritic(title) {
  if (!RAWG_API_KEY) return null;

  const url = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(title)}&page_size=5`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  RAWG error for "${title}": ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;

  const target = normalise(title);
  const match = data.results.find(g => normalise(g.name) === target) || data.results[0];

  if (!match.metacritic) return null;

  return { metacritic: match.metacritic, matched: match.name };
}

/**
 * OpenCritic — two calls: search by name, then read topCriticScore by id.
 * Games with no reviews yet come back with a negative score, which is discarded.
 */
async function fetchOpenCriticScore(title) {
  if (!OPENCRITIC_API_KEY) return null;

  const headers = {
    'X-RapidAPI-Key': OPENCRITIC_API_KEY,
    'X-RapidAPI-Host': OPENCRITIC_HOST,
  };

  const searchRes = await fetch(
    `${OPENCRITIC_BASE}/game/search?criteria=${encodeURIComponent(title)}`,
    { headers }
  );
  if (!searchRes.ok) {
    console.error(`  OpenCritic search error for "${title}": ${searchRes.status}`);
    return null;
  }

  const hits = await searchRes.json();
  if (!Array.isArray(hits) || hits.length === 0) return null;

  // `dist` is a relevance distance: lower is a better match.
  const target = normalise(title);
  const hit = hits.find(h => normalise(h.name) === target)
    || [...hits].sort((a, b) => (a.dist ?? 1) - (b.dist ?? 1))[0];

  if (!hit?.id) return null;

  await sleep(400);

  const gameRes = await fetch(`${OPENCRITIC_BASE}/game/${hit.id}`, { headers });
  if (!gameRes.ok) {
    console.error(`  OpenCritic game error for "${title}": ${gameRes.status}`);
    return null;
  }

  const game = await gameRes.json();
  const score = game.topCriticScore;
  if (typeof score !== 'number' || score <= 0) return null;

  return { score: Math.round(score * 100) / 100, matched: hit.name };
}

async function main() {
  if (!RAWG_API_KEY) {
    console.warn('⚠ RAWG_API_KEY missing — skipping Metacritic scores.');
  }
  if (!OPENCRITIC_API_KEY) {
    console.warn('⚠ OPENCRITIC_API_KEY missing — skipping OpenCritic scores.');
  }
  if (!RAWG_API_KEY && !OPENCRITIC_API_KEY) {
    console.error('No API keys configured. Nothing to fetch.');
    return;
  }

  // Get all games from local D1 via wrangler
  const { execSync } = await import('node:child_process');

  const where = ONLY_MISSING
    ? 'WHERE rating_metacritic IS NULL OR rating_opencritic IS NULL '
    : '';

  const output = execSync(
    `npx wrangler d1 execute neon-burst-db --local --command "SELECT id, title, is_demo, rating_metacritic, rating_opencritic FROM games ${where}ORDER BY title ASC;" --json`,
    { encoding: 'utf-8', cwd: process.cwd() }
  );

  const parsed = JSON.parse(output);
  const games = parsed[0].results;

  if (games.length === 0) {
    console.log('Nothing to fetch — every game already has both ratings.');
    return;
  }

  console.log(
    ONLY_MISSING
      ? `Found ${games.length} games with a missing rating. Fetching...\n`
      : `Found ${games.length} games. Fetching ratings...\n`
  );

  const updates = [];

  for (const game of games) {
    // With --only-missing, a rating that is already stored costs no request.
    const needMetacritic = !ONLY_MISSING || game.rating_metacritic == null;
    const needOpenCritic = !ONLY_MISSING || game.rating_opencritic == null;

    // Rate limit: ~1 req/sec to be nice to the APIs
    await sleep(1000);

    const title = cleanTitle(game.title);

    const rawg = needMetacritic ? await fetchRawgMetacritic(title) : null;
    const opencritic = needOpenCritic ? await fetchOpenCriticScore(title) : null;

    if (!rawg && !opencritic) {
      console.log(`✗ ${game.title} → no rating found`);
      continue;
    }

    const matched = rawg?.matched || opencritic?.matched;
    const mcLabel = needMetacritic ? (rawg?.metacritic ?? '—') : 'skip';
    const ocLabel = needOpenCritic ? (opencritic?.score ?? '—') : 'skip';
    console.log(`✓ ${game.title} → ${matched} | MC: ${mcLabel} | OC: ${ocLabel}`);

    const parts = [];
    if (rawg) {
      parts.push(`rating_metacritic = ${rawg.metacritic}`);
    }
    if (opencritic) {
      parts.push(`rating_opencritic = ${opencritic.score}`);
    }

    updates.push({
      id: game.id,
      title: game.title,
      metacritic: rawg?.metacritic ?? null,
      opencritic: opencritic?.score ?? null,
      // Keyed by title, not id: this file is read from the local database but
      // also applied to the remote one, and the two do not share ids.
      sql: `UPDATE games SET ${parts.join(', ')} WHERE title = '${sqlQuote(game.title)}' AND is_demo = ${game.is_demo ? 1 : 0};`,
    });
  }

  if (updates.length === 0) {
    console.log('\nNo ratings to update.');
    return;
  }

  // Generate SQL file
  const { writeFileSync } = await import('node:fs');
  const sql = updates.map(u => u.sql).join('\n');
  writeFileSync(new URL('./ratings.sql', import.meta.url), sql, 'utf-8');

  console.log(`\nGenerated db/ratings.sql with ${updates.length} updates.`);
  console.log('Apply with:');
  console.log('  npx wrangler d1 execute neon-burst-db --local --file=db/ratings.sql');
  console.log('  npx wrangler d1 execute neon-burst-db --remote --file=db/ratings.sql');
}

main().catch(console.error);
