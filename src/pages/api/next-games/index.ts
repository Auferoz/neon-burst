import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

interface NextGameRow {
  igdb_id: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  cover: string;
  bg_image: string;
  release_date: number;
  platforms: string;
  steam_url: string;
  hypes: number;
  follows: number;
}

export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM next_games_cache ORDER BY release_date ASC'
  ).all<NextGameRow>();

  const games = (results || []).map((r) => ({
    id: r.igdb_id,
    name: r.name,
    developer: r.developer || '',
    publisher: r.publisher || '',
    genres: r.genres || '',
    cover: r.cover || '',
    bgImage: r.bg_image || '',
    releaseDate: r.release_date,
    platforms: r.platforms ? r.platforms.split(', ').filter(Boolean) : [],
    steamUrl: r.steam_url || '',
    hypes: r.hypes || 0,
    follows: r.follows || 0,
  }));

  return new Response(JSON.stringify(games), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
