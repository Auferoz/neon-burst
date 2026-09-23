import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getMovieById, deleteMovieEntry, updateMovieEntry, DuplicateWatchedYearError } from '../../../services/moviesService';
import { validateMovieWatchedUpdate } from '../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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
 * Edita `year_watched` y/o `platform` de una entrada de movies_watched. El id
 * acá es el `watched_id`, no el trakt_id: se edita "vi esta película en este
 * año", no la película.
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const watchedId = Number(params.id);
  if (!Number.isInteger(watchedId)) {
    return json({ error: 'id inválido' }, 400);
  }

  const body = await request.json().catch(() => null);
  const validation = validateMovieWatchedUpdate(body);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  try {
    const updated = await updateMovieEntry(env.DB, watchedId, validation.value);
    if (!updated) {
      return json({ error: 'Entrada no encontrada o nada para actualizar' }, 400);
    }
    return json(updated);
  } catch (e) {
    if (e instanceof DuplicateWatchedYearError) {
      return json({ error: e.message }, 409);
    }
    throw e;
  }
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
