import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

interface MovieCacheRow {
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  list_slug: string;
}

export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM movies_cache ORDER BY list_slug DESC, listed_at DESC'
  ).all<MovieCacheRow>();

  return new Response(JSON.stringify(results || []), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
