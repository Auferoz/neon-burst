/**
 * Steam library sync — runs in Cloudflare Worker (cron trigger).
 * Fetches owned games + Steam Store details + HLTB times.
 */

import { env } from 'cloudflare:workers';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Access env lazily to ensure availability in Workers runtime
function getSteamApiKey() { return env.STEAM_API_KEY; }
function getSteamId() { return env.STEAM_ID; }
function getTwitchClientId() { return env.TWITCH_CLIENT_ID; }
function getTwitchClientSecret() { return env.TWITCH_CLIENT_SECRET; }
let igdbAccessToken: string | null = null;
let igdbTokenPromise: Promise<string | null> | null = null;

interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  rtime_last_played: number;
}

async function fetchOwnedGames(): Promise<SteamOwnedGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${getSteamApiKey()}&steamid=${getSteamId()}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  const data = await res.json() as { response: { games: SteamOwnedGame[] } };
  return data.response.games || [];
}

async function fetchStoreDetails(appid: number) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish`);
    const data = await res.json() as Record<string, { success: boolean; data: any }>;
    if (!data[appid]?.success) return null;
    const d = data[appid].data;
    return {
      developer: d.developers?.join(', ') || '',
      publisher: d.publishers?.join(', ') || '',
      genres: (d.genres || []).map((g: { description: string }) => g.description).join(', '),
      released: d.release_date?.date || '',
    };
  } catch { return null; }
}

async function getValidPoster(appid: number): Promise<string> {
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    if (res.ok && res.headers.get('content-type')?.includes('image')) return url;
  } catch {}
  return '';
}

async function getIgdbToken(): Promise<string | null> {
  try {
    const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${getTwitchClientId()}&client_secret=${getTwitchClientSecret()}&grant_type=client_credentials`, { method: 'POST' });
    const data = await res.json() as { access_token?: string };
    return data.access_token || null;
  } catch { return null; }
}

async function igdbCover(name: string): Promise<string> {
  if (!igdbAccessToken) {
    if (!igdbTokenPromise) {
      igdbTokenPromise = getIgdbToken();
    }
    igdbAccessToken = await igdbTokenPromise;
    if (!igdbAccessToken) return '';
  }
  const clean = name.replace(/[™®©]/g, '').replace(/\s*\(\d{4}\)$/, '').trim();
  try {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': getTwitchClientId(), 'Authorization': `Bearer ${igdbAccessToken}` },
      body: `fields name,cover.image_id; search "${clean}"; limit 5;`,
    });
    const games = await res.json() as { name?: string; cover?: { image_id: string } }[];
    const exact = games.find(g => g.name?.toLowerCase() === clean.toLowerCase());
    const best = exact || games.find(g => g.cover?.image_id);
    if (best?.cover?.image_id) {
      return `https://images.igdb.com/igdb/image/upload/t_cover_big/${best.cover.image_id}.webp`;
    }
  } catch {}
  return '';
}

async function getHltbToken(): Promise<string | null> {
  try {
    const res = await fetch('https://howlongtobeat.com/api/finder/init?t=' + Date.now(), {
      headers: { 'Accept': 'application/json', 'User-Agent': UA, 'Referer': 'https://howlongtobeat.com/', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' },
    });
    const data = await res.json() as { token?: string };
    return data.token || null;
  } catch { return null; }
}

async function searchHltb(name: string, token: string) {
  const clean = name.replace(/[™®©]/g, '').replace(/\s*[-–—]\s*(Digital Edition|Enhanced|Remastered|GOTY|Definitive|Complete|Standard|Edition).*$/i, '').replace(/\s*\(\d{4}\)$/, '').trim();
  try {
    const res = await fetch('https://howlongtobeat.com/api/finder', {
      method: 'POST',
      headers: {
        'Accept': 'application/json', 'Content-Type': 'application/json',
        'User-Agent': UA, 'Referer': 'https://howlongtobeat.com/', 'Origin': 'https://howlongtobeat.com',
        'x-auth-token': token, 'sec-ch-ua': '"Google Chrome";v="131"', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({
        searchType: 'games', searchTerms: [clean], searchPage: 1, size: 1,
        searchOptions: { games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: null, max: null }, gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: '', max: '' }, modifier: '' }, users: { sortCategory: 'postcount' }, lists: { sortCategory: 'follows' }, filter: '', sort: 0, randomizer: 0 },
        useCache: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { comp_main: number; comp_plus: number; comp_100: number }[] };
    if (!data.data?.length) return null;
    const g = data.data[0];
    return {
      main: g.comp_main ? Math.round(g.comp_main / 3600 * 10) / 10 : null,
      extra: g.comp_plus ? Math.round(g.comp_plus / 3600 * 10) / 10 : null,
      completionist: g.comp_100 ? Math.round(g.comp_100 / 3600 * 10) / 10 : null,
    };
  } catch { return null; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function syncSteamLibrary(db: D1Database): Promise<{ synced: number; errors: number; newGames: number }> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steam_cache (
      appid INTEGER PRIMARY KEY, name TEXT NOT NULL, developer TEXT, publisher TEXT,
      genres TEXT, released TEXT, poster TEXT, playtime INTEGER DEFAULT 0,
      last_played INTEGER DEFAULT 0, hltb_main REAL, hltb_extra REAL,
      hltb_completionist REAL, updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const games = await fetchOwnedGames();

  // Get existing appids to avoid overwriting rich data (store details, poster, HLTB)
  const { results: existingRows } = await db.prepare('SELECT appid FROM steam_cache').all<{ appid: number }>();
  const existingIds = new Set(existingRows.map(r => r.appid));

  let synced = 0, errors = 0, newGames = 0;

  for (const game of games) {
    try {
      if (existingIds.has(game.appid)) {
        // Existing game: only update playtime + last_played (safe from Worker)
        await db.prepare(
          'UPDATE steam_cache SET name = ?, playtime = ?, last_played = ?, updated_at = datetime(\'now\') WHERE appid = ?'
        ).bind(game.name, game.playtime_forever || 0, game.rtime_last_played || 0, game.appid).run();
      } else {
        // New game: insert with basic data, details will be filled by local sync
        await db.prepare(`
          INSERT INTO steam_cache (appid, name, developer, publisher, genres, released, poster, playtime, last_played, updated_at)
          VALUES (?, ?, '', '', '', '', '', ?, ?, datetime('now'))
        `).bind(game.appid, game.name, game.playtime_forever || 0, game.rtime_last_played || 0).run();
        newGames++;
      }
      synced++;
    } catch { errors++; }
  }

  return { synced, errors, newGames };
}
