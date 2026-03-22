/**
 * Sync Steam library — Fetches game details from Steam Store API + HLTB
 * and caches them in D1.
 *
 * Usage: node db/sync-steam.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.STEAM_ID;
const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
let igdbAccessToken = null;

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

// ── Steam API ──

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
    };
  } catch {
    return null;
  }
}

// ── Poster validation ──

async function getValidPoster(appid) {
  const posterUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  try {
    const res = await fetch(posterUrl, { method: 'HEAD', headers: { 'User-Agent': UA } });
    if (res.ok && res.headers.get('content-type')?.includes('image')) {
      return posterUrl;
    }
  } catch {}
  return '';
}

// ── IGDB poster fallback ──

async function getIgdbToken() {
  try {
    const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const data = await res.json();
    return data.access_token || null;
  } catch { return null; }
}

async function igdbCover(name) {
  if (!igdbAccessToken) {
    igdbAccessToken = await getIgdbToken();
    if (!igdbAccessToken) return '';
  }
  const clean = name.replace(/[™®©]/g, '').replace(/\s*\(\d{4}\)$/, '').trim();
  try {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${igdbAccessToken}` },
      body: `fields name,cover.image_id; search "${clean}"; limit 5;`,
    });
    const games = await res.json();
    const exact = games.find(g => g.name?.toLowerCase() === clean.toLowerCase());
    const best = exact || games.find(g => g.cover?.image_id);
    if (best?.cover?.image_id) {
      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${best.cover.image_id}.webp`;
    }
  } catch {}
  return '';
}

// ── HowLongToBeat ──

let hltbToken = null;

async function getHltbToken() {
  try {
    const res = await fetch('https://howlongtobeat.com/api/finder/init?t=' + Date.now(), {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': UA,
        'Referer': 'https://howlongtobeat.com/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      }
    });
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

async function searchHltb(gameName) {
  if (!hltbToken) return null;

  const cleanName = gameName
    .replace(/[™®©]/g, '')
    .replace(/\s*[-–—]\s*(Digital Edition|Enhanced|Remastered|GOTY|Game of the Year|Definitive|Complete|Standard|Edition).*$/i, '')
    .replace(/\s*\(\d{4}\)$/, '')
    .trim();

  try {
    const res = await fetch('https://howlongtobeat.com/api/finder', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'Referer': 'https://howlongtobeat.com/',
        'Origin': 'https://howlongtobeat.com',
        'x-auth-token': hltbToken,
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({
        searchType: 'games',
        searchTerms: [cleanName],
        searchPage: 1,
        size: 1,
        searchOptions: {
          games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: null, max: null }, gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: '', max: '' }, modifier: '' },
          users: { sortCategory: 'postcount' },
          lists: { sortCategory: 'follows' },
          filter: '', sort: 0, randomizer: 0,
        },
        useCache: true,
      }),
    });

    if (res.status === 403) {
      // Token expired, refresh
      console.log('(token refresh)');
      hltbToken = await getHltbToken();
      return null;
    }

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.data?.length) return null;

    const g = data.data[0];
    return {
      main: g.comp_main ? Math.round(g.comp_main / 3600 * 10) / 10 : null,
      extra: g.comp_plus ? Math.round(g.comp_plus / 3600 * 10) / 10 : null,
      completionist: g.comp_100 ? Math.round(g.comp_100 / 3600 * 10) / 10 : null,
    };
  } catch {
    return null;
  }
}

// ── Helpers ──

// Parse --appids=11390,43160,202090 flag
const appidsFlag = process.argv.find(a => a.startsWith('--appids='));
const targetAppids = appidsFlag
  ? new Set(appidsFlag.replace('--appids=', '').split(',').map(Number))
  : null;

async function syncGame(appid, name, playtime, lastPlayed) {
  // Fetch Steam Store details
  const store = await fetchStoreDetails(appid);
  await sleep(300);

  // Validate poster — Steam first, IGDB fallback
  let poster = await getValidPoster(appid);
  if (!poster) {
    poster = await igdbCover(name);
    await sleep(200);
  }

  // Fetch HLTB
  const hltbData = await searchHltb(name);
  await sleep(250);

  const developer = esc(store?.developer || '');
  const publisher = esc(store?.publisher || '');
  const genres = esc(store?.genres || '');
  const released = esc(store?.released || '');
  const hMain = hltbData?.main ?? 'NULL';
  const hExtra = hltbData?.extra ?? 'NULL';
  const hComp = hltbData?.completionist ?? 'NULL';

  const sql = `INSERT OR REPLACE INTO steam_cache (appid, name, developer, publisher, genres, released, poster, playtime, last_played, hltb_main, hltb_extra, hltb_completionist, updated_at) VALUES (${appid}, '${esc(name)}', '${developer}', '${publisher}', '${genres}', '${released}', '${esc(poster)}', ${playtime}, ${lastPlayed}, ${hMain}, ${hExtra}, ${hComp}, datetime('now'))`;

  d1(sql);

  const parts = [];
  parts.push(store ? 'Store' : 'No Store');
  parts.push(poster ? (poster.includes('igdb') ? 'IGDB Poster' : 'Steam Poster') : 'No Poster');
  parts.push(hltbData ? `HLTB ${hltbData.main}h` : 'No HLTB');
  return parts;
}

// ── Main ──

async function main() {
  const mode = targetAppids
    ? `Re-syncing ${targetAppids.size} specific appids (${TARGET})`
    : `Syncing Steam library (${TARGET})`;
  console.log(`${mode}...\n`);

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

  // Get HLTB token
  console.log('Getting HLTB token...');
  hltbToken = await getHltbToken();
  console.log(hltbToken ? 'HLTB token OK' : 'HLTB token FAILED — continuing without HLTB');

  // Fetch owned games
  console.log('\nFetching Steam library...');
  const allGames = await fetchOwnedGames();
  const games = targetAppids
    ? allGames.filter(g => targetAppids.has(g.appid))
    : allGames;
  console.log(`Found ${games.length} games${targetAppids ? ` (filtered from ${allGames.length})` : ''}.\n`);

  if (targetAppids && games.length < targetAppids.size) {
    const found = new Set(games.map(g => g.appid));
    const missing = [...targetAppids].filter(id => !found.has(id));
    console.log(`⚠ Appids not found in Steam library: ${missing.join(', ')}\n`);
  }

  let synced = 0;
  let errors = 0;

  for (const game of games) {
    process.stdout.write(`[${synced + errors + 1}/${games.length}] ${game.name}... `);

    try {
      const parts = await syncGame(game.appid, game.name, game.playtime_forever || 0, game.rtime_last_played || 0);
      synced++;
      console.log(`OK (${parts.join(', ')})`);
    } catch (e) {
      errors++;
      console.log('ERROR');
    }
  }

  console.log(`\nDone! Synced: ${synced}, Errors: ${errors}`);
}

main().catch(console.error);
