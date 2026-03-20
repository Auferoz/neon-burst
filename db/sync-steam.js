/**
 * Sync Steam library — Fetches game details from Steam Store API + HLTB
 * and caches them in D1.
 *
 * Usage: node db/sync-steam.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const STEAM_API_KEY = 'B57C4DAE4299172CE3AEF49F31B73E20';
const STEAM_ID = '76561198071323076';
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

async function fetchOwnedGames() {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.response.games || [];
}

async function fetchStoreDetails(appid) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data[appid]?.success) return null;
    const d = data[appid].data;
    return {
      developer: d.developers?.join(', ') || '',
      publisher: d.publishers?.join(', ') || '',
      genres: (d.genres || []).map(g => g.description).join(', '),
      released: d.release_date?.date || '',
      poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    };
  } catch {
    return null;
  }
}

const esc = (str) => str ? str.replace(/'/g, "''") : '';

async function main() {
  console.log(`Syncing Steam library (${TARGET})...\n`);

  // Create table if needed
  d1(`CREATE TABLE IF NOT EXISTS steam_cache (
    appid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    developer TEXT,
    publisher TEXT,
    genres TEXT,
    released TEXT,
    poster TEXT,
    playtime INTEGER DEFAULT 0,
    last_played INTEGER DEFAULT 0,
    hltb_main REAL,
    hltb_extra REAL,
    hltb_completionist REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  d1(`CREATE INDEX IF NOT EXISTS idx_steam_cache_name ON steam_cache(name)`);

  // Fetch owned games
  console.log('Fetching Steam library...');
  const games = await fetchOwnedGames();
  console.log(`Found ${games.length} games.\n`);

  let synced = 0;
  let errors = 0;

  for (const game of games) {
    const appid = game.appid;
    const name = game.name;
    const playtime = game.playtime_forever || 0;
    const lastPlayed = game.rtime_last_played || 0;

    process.stdout.write(`[${synced + 1}/${games.length}] ${name}... `);

    // Fetch Steam Store details
    const store = await fetchStoreDetails(appid);
    await sleep(350); // Rate limit: ~200 req/5min

    const developer = esc(store?.developer || '');
    const publisher = esc(store?.publisher || '');
    const genres = esc(store?.genres || '');
    const released = esc(store?.released || '');
    const poster = esc(store?.poster || '');

    const sql = `INSERT OR REPLACE INTO steam_cache (appid, name, developer, publisher, genres, released, poster, playtime, last_played, updated_at) VALUES (${appid}, '${esc(name)}', '${developer}', '${publisher}', '${genres}', '${released}', '${poster}', ${playtime}, ${lastPlayed}, datetime('now'))`;

    try {
      d1(sql);
      synced++;
      console.log(`OK (${store ? 'Store' : 'No Store'})`);
    } catch (e) {
      errors++;
      console.log(`ERROR`);
    }
  }

  console.log(`\nDone! Synced: ${synced}, Errors: ${errors}`);
}

main().catch(console.error);
