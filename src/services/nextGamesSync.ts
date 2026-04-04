/**
 * Next games sync — fetches upcoming games from IGDB for the current year
 * and caches them in D1 (next_games_cache table).
 */

import { env } from 'cloudflare:workers';

// Access env lazily to ensure availability in Workers runtime
function getTwitchClientId() { return env.TWITCH_CLIENT_ID; }
function getTwitchClientSecret() { return env.TWITCH_CLIENT_SECRET; }

interface IgdbGame {
  id: number;
  name: string;
  genres?: { name: string }[];
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[];
  first_release_date?: number;
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  platforms?: { abbreviation?: string; name: string }[];
  websites?: { url: string; category: number }[];
  hypes?: number;
  follows?: number;
}

async function getIgdbToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${getTwitchClientId()}&client_secret=${getTwitchClientSecret()}&grant_type=client_credentials`,
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function syncNextGames(db: D1Database): Promise<{ synced: number; errors: number }> {
  const token = await getIgdbToken();

  const year = new Date().getFullYear();
  const startOfYear = Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const endOfYear = Math.floor(new Date(year, 11, 31, 23, 59, 59).getTime() / 1000);

  const baseQuery = (offset: number) => `
    fields name, genres.name,
      involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
      first_release_date, cover.image_id, artworks.image_id, screenshots.image_id,
      platforms.abbreviation, platforms.name,
      websites.url, websites.category,
      hypes, follows;
    where first_release_date >= ${startOfYear}
      & first_release_date <= ${endOfYear}
      & cover != null
      & (hypes >= 5 | follows >= 5);
    sort first_release_date asc;
    limit 500;
    offset ${offset};
  `;

  // Fetch all pages from IGDB
  const raw: IgdbGame[] = [];
  let offset = 0;
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': getTwitchClientId(),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: baseQuery(offset),
    });

    if (!res.ok) break;

    const batch: IgdbGame[] = await res.json();
    raw.push(...batch);

    if (batch.length < 500) break;
    offset += 500;
  }

  // Filter: only keep games with meaningful community interest (hypes + follows >= 20)
  const MIN_INTEREST = 5;
  const filtered = raw.filter((g) => (g.hypes || 0) + (g.follows || 0) >= MIN_INTEREST);

  // Clear old cache and insert fresh data
  await db.prepare('DELETE FROM next_games_cache').run();

  let synced = 0;
  let errors = 0;

  // Batch insert in chunks of 50
  for (let i = 0; i < filtered.length; i += 50) {
    const batch = filtered.slice(i, i + 50);
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO next_games_cache
        (igdb_id, name, developer, publisher, genres, cover, bg_image, release_date, platforms, steam_url, hypes, follows)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const ops = batch.map((g) => {
      const developer = g.involved_companies?.find((c) => c.developer)?.company?.name || '';
      const publisher = g.involved_companies?.find((c) => c.publisher)?.company?.name || '';
      const genres = g.genres?.map((gen) => gen.name).join(', ') || '';
      const cover = g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.webp`
        : '';
      const bgImage = g.artworks?.[0]?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.artworks[0].image_id}.webp`
        : g.screenshots?.[0]?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${g.screenshots[0].image_id}.webp`
          : '';
      const platforms = g.platforms?.map((p) => p.abbreviation || p.name).filter(Boolean).join(', ') || '';
      const steamUrl = g.websites?.find((w) => w.category === 13)?.url || '';

      return stmt.bind(
        g.id, g.name, developer, publisher, genres, cover, bgImage,
        g.first_release_date || 0, platforms, steamUrl,
        g.hypes || 0, g.follows || 0,
      );
    });

    try {
      await db.batch(ops);
      synced += batch.length;
    } catch {
      errors += batch.length;
    }
  }

  return { synced, errors };
}
