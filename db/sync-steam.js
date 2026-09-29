/**
 * Sync Steam library — Fetches game details from Steam Store API + HLTB
 * and caches them in D1.
 *
 * Usage: node db/sync-steam.js [--local | --remote] [--appids=1,2,3]
 * Default: --local
 *
 * Runs from a PC on purpose: HowLongToBeat binds its search token to the caller's
 * fingerprint, and a Cloudflare Worker changes egress IP between requests, so the
 * search answers 403 "invalid fingerprint" from the Worker (tested 2026-09-29).
 *
 * Writes are upserts that never replace stored data with an empty value (see
 * steamSyncUtils.js), so a rate-limited store call or an HLTB miss is harmless.
 * The steam_cache schema lives in db/migrations/ — run `npm run db:migrate` first.
 */
import { execSync } from 'node:child_process';
import { cleanHltbName, mapStoreDetails, mapHltbGame, buildSteamCacheUpsert } from './steamSyncUtils.js';

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.STEAM_ID;
const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
let igdbAccessToken = null;

/** Runs one statement; throws on failure so a failed write is never reported as OK. */
function d1(sql, dbTarget = TARGET) {
  const cmd = `npx wrangler d1 execute neon-burst-db ${dbTarget} --command="${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Steam API ──

async function fetchOwnedGames() {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.response.games || [];
}

/**
 * The store allows roughly 200 appdetails calls per 5 minutes and answers 429
 * past that: wait and retry instead of storing nothing.
 */
async function fetchStoreDetails(appid, attempt = 1) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish`);
    if (res.status === 429 || res.status === 403) {
      if (attempt > 3) return null;
      process.stdout.write(`(store rate limit, waiting 60s) `);
      await sleep(60_000);
      return fetchStoreDetails(appid, attempt + 1);
    }
    const data = await res.json();
    if (!data?.[appid]?.success) return null;
    return mapStoreDetails(data[appid].data);
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
// HLTB renames these routes now and then to discourage scraping (it was
// /api/finder until 2026). If the token call stops returning JSON, open
// howlongtobeat.com, search once, and copy the new routes from the Network tab.

const HLTB_BASE = 'https://howlongtobeat.com';
const HLTB_INIT_PATH = '/api/search/site/init';
const HLTB_SEARCH_PATH = '/api/search/site';
const HLTB_HEADERS = { 'User-Agent': UA, 'Referer': `${HLTB_BASE}/`, 'Origin': HLTB_BASE, 'Accept': 'application/json' };

let hltbToken = null;

async function getHltbToken() {
  try {
    const res = await fetch(`${HLTB_BASE}${HLTB_INIT_PATH}?t=${Date.now()}`, { headers: HLTB_HEADERS });
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

async function searchHltb(gameName, attempt = 1) {
  if (!hltbToken) return null;

  const body = {
    searchType: 'games',
    searchTerms: cleanHltbName(gameName).split(' '),
    searchPage: 1,
    size: 1,
    searchOptions: {
      games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: 0, max: 0 }, gameplay: { perspective: '', flow: '', genre: '' }, year: '', modifier: '' },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '', sort: 0, randomizer: 0,
    },
    useCache: true,
  };

  try {
    const res = await fetch(`${HLTB_BASE}${HLTB_SEARCH_PATH}`, {
      method: 'POST',
      headers: { ...HLTB_HEADERS, 'Content-Type': 'application/json', 'x-auth-token': hltbToken },
      body: JSON.stringify(body),
    });

    if (res.status === 403 && attempt === 1) {
      // Token expired: refresh once and retry this same game.
      hltbToken = await getHltbToken();
      return searchHltb(gameName, attempt + 1);
    }
    if (res.status === 429 && attempt <= 3) {
      process.stdout.write('(HLTB rate limit, waiting 60s) ');
      await sleep(60_000);
      return searchHltb(gameName, attempt + 1);
    }
    if (!res.ok) return null;

    const data = await res.json();
    return data.data?.length ? mapHltbGame(data.data[0]) : null;
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
  const store = await fetchStoreDetails(appid);
  await sleep(1500); // ~200 store calls per 5 minutes

  // Poster — Steam first, IGDB fallback
  let poster = await getValidPoster(appid);
  if (!poster) {
    poster = await igdbCover(name);
    await sleep(200);
  }

  const hltb = await searchHltb(name);
  await sleep(500);

  d1(buildSteamCacheUpsert({ appid, name, playtime, lastPlayed, store, poster, hltb }));

  return {
    store: Boolean(store),
    poster: poster ? (poster.includes('igdb') ? 'IGDB' : 'Steam') : null,
    hltb,
  };
}

// ── Main ──

async function main() {
  const mode = targetAppids
    ? `Re-syncing ${targetAppids.size} specific appids (${TARGET})`
    : `Syncing Steam library (${TARGET})`;
  console.log(`${mode}...\n`);

  console.log('Getting HLTB token...');
  hltbToken = await getHltbToken();
  if (!hltbToken) {
    console.log(`⚠ HLTB token FAILED at ${HLTB_BASE}${HLTB_INIT_PATH} — the route probably changed.`);
    console.log('  Continuing without HLTB (stored times are kept). See the note above HLTB_BASE.\n');
  } else {
    console.log('HLTB token OK\n');
  }

  console.log('Fetching Steam library...');
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

  const stats = { synced: 0, errors: 0, store: 0, hltb: 0 };

  for (const game of games) {
    process.stdout.write(`[${stats.synced + stats.errors + 1}/${games.length}] ${game.name}... `);

    try {
      const r = await syncGame(game.appid, game.name, game.playtime_forever || 0, game.rtime_last_played || 0);
      stats.synced++;
      if (r.store) stats.store++;
      if (r.hltb) stats.hltb++;
      const parts = [
        r.store ? 'Store' : 'No Store',
        r.poster ? `${r.poster} Poster` : 'No Poster',
        r.hltb ? `HLTB ${r.hltb.main ?? '-'}h` : 'No HLTB',
      ];
      console.log(`OK (${parts.join(', ')})`);
    } catch (e) {
      stats.errors++;
      console.log(`ERROR: ${(e.stderr || e.message || '').toString().trim().split('\n').pop()}`);
    }
  }

  console.log(`\nDone! Synced: ${stats.synced}, Errors: ${stats.errors}, Store details: ${stats.store}, HLTB found: ${stats.hltb}`);
}

main().catch(console.error);
