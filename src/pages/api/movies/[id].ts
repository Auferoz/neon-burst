import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getMovieById } from '../../../services/moviesService';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const movie = await getMovieById(env.DB, id);

  if (!movie) {
    return new Response(JSON.stringify({ error: 'Movie not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(movie), {
    headers: { 'Content-Type': 'application/json' },
  });
};
