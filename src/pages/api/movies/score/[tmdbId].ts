import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { setPersonalRating } from '../../../../services/moviesService';
import { validateRatingPersonal } from '../../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Alta/edición/borrado del score personal de una película, por tmdb_id.
 * `{ rating_personal: null }` borra la fila de movies_personal: la película
 * vuelve a mostrarse como "sin puntuar".
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const tmdbId = Number(params.tmdbId);
  if (!Number.isInteger(tmdbId)) {
    return json({ error: 'tmdbId inválido' }, 400);
  }

  const data = await request.json() as { rating_personal?: unknown };
  const validation = validateRatingPersonal(data.rating_personal ?? null);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  await setPersonalRating(env.DB, tmdbId, validation.value);
  return json({ ok: true, rating_personal: validation.value });
};
