/**
 * Steam library sync — fetches owned games from Steam API
 * and enriches with Steam Store details, then upserts into D1.
 */

const STEAM_API_KEY = 'B57C4DAE4299172CE3AEF49F31B73E20';
const STEAM_ID = '76561198071323076';

interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  rtime_last_played: number;
  img_icon_url: string;
}

interface StoreDetails {
  developer: string;
  publisher: string;
  genres: string;
  released: string;
  poster: string;
}

async function fetchOwnedGames(): Promise<SteamOwnedGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  const data = await res.json() as { response: { games: SteamOwnedGame[] } };
  return data.response.games || [];
}

async function fetchStoreDetails(appid: number): Promise<StoreDetails | null> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish`;
    const res = await fetch(url);
    const data = await res.json() as Record<string, { success: boolean; data: any }>;
    if (!data[appid]?.success) return null;
    const d = data[appid].data;
    return {
      developer: d.developers?.join(', ') || '',
      publisher: d.publishers?.join(', ') || '',
      genres: (d.genres || []).map((g: { description: string }) => g.description).join(', '),
      released: d.release_date?.date || '',
      poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function syncSteamLibrary(db: D1Database): Promise<{ synced: number; errors: number }> {
  // Ensure table exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steam_cache (
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
    )
  `).run();

  const games = await fetchOwnedGames();
  let synced = 0;
  let errors = 0;

  for (const game of games) {
    try {
      const store = await fetchStoreDetails(game.appid);
      await sleep(350);

      await db.prepare(`
        INSERT OR REPLACE INTO steam_cache
        (appid, name, developer, publisher, genres, released, poster, playtime, last_played, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        game.appid,
        game.name,
        store?.developer || '',
        store?.publisher || '',
        store?.genres || '',
        store?.released || '',
        store?.poster || '',
        game.playtime_forever || 0,
        game.rtime_last_played || 0,
      ).run();

      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
