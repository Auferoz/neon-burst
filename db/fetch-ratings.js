/**
 * Fetch ratings from RAWG API and update D1 database
 * Usage: node db/fetch-ratings.js
 *
 * Requires wrangler CLI to update the database.
 * Fetches RAWG rating + Metacritic score for each game.
 */

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = 'https://api.rawg.io/api';

async function searchGame(title) {
  const cleanTitle = title
    .replace(/\s*\|.*$/, '')       // Remove " | C1" suffixes
    .replace(/\s*DEMO$/i, '')      // Remove DEMO
    .replace(/[®™©]/g, '')        // Remove trademark symbols
    .replace(/\s*\(\d{4}\)/, '')   // Remove (2003) year suffixes
    .trim();

  const url = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(cleanTitle)}&page_size=5`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  API error for "${cleanTitle}": ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }

  // Try to find best match by comparing names
  const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalise(cleanTitle);

  const match = data.results.find(g => normalise(g.name) === target) || data.results[0];

  return {
    metacritic: match.metacritic || null,
    rawg: match.rating || null,
    matched: match.name,
  };
}

async function main() {
  // Get all games from local D1 via wrangler
  const { execSync } = await import('node:child_process');

  const output = execSync(
    'npx wrangler d1 execute neon-burst-db --local --command "SELECT id, title FROM games ORDER BY title ASC;" --json',
    { encoding: 'utf-8', cwd: process.cwd() }
  );

  const parsed = JSON.parse(output);
  const games = parsed[0].results;

  console.log(`Found ${games.length} games. Fetching ratings...\n`);

  const updates = [];

  for (const game of games) {
    // Rate limit: ~1 req/sec to be nice to the API
    await new Promise(r => setTimeout(r, 1000));

    const result = await searchGame(game.title);

    if (result && (result.metacritic || result.rawg)) {
      console.log(`✓ ${game.title} → ${result.matched} | MC: ${result.metacritic ?? '—'} | RAWG: ${result.rawg ?? '—'}`);

      const parts = [];
      if (result.metacritic) {
        parts.push(`rating_metacritic = ${result.metacritic}`);
      }
      if (result.rawg) {
        parts.push(`rating_rawg = ${result.rawg}`);
      }

      updates.push({
        id: game.id,
        title: game.title,
        metacritic: result.metacritic,
        rawg: result.rawg,
        sql: `UPDATE games SET ${parts.join(', ')} WHERE id = ${game.id};`,
      });
    } else {
      console.log(`✗ ${game.title} → no rating found`);
    }
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
