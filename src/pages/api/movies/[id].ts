import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getMovieById, deleteMovieEntry } from '../../../services/moviesService';

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

/**
 * Borra una entrada de movies_watched. El id acá es el `watched_id`, no el
 * trakt_id: lo que se borra es "vi esta película en este año", no la película.
 */
export const DELETE: APIRoute = async ({ params }) => {
  const watchedId = Number(params.id);

  if (!Number.isInteger(watchedId)) {
    return new Response(JSON.stringify({ error: 'id inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = await deleteMovieEntry(env.DB, watchedId);

  return new Response(JSON.stringify(deleted ? { ok: true } : { error: 'Entrada no encontrada' }), {
    status: deleted ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  });
};
