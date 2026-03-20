import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

interface SteamCacheRow {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  released: string;
  poster: string;
  playtime: number;
  last_played: number;
  hltb_main: number | null;
  hltb_extra: number | null;
  hltb_completionist: number | null;
}

export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM steam_cache ORDER BY last_played DESC, name ASC'
  ).all<SteamCacheRow>();

  return new Response(JSON.stringify(results || []), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
