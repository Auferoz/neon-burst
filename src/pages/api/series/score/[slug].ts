import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { setPersonalRating } from '../../../../services/seriesService';
import { validateRatingPersonal } from '../../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Alta/edición/borrado del score personal de una serie, por trakt_slug.
 * `{ rating_personal: null }` borra la fila de series_personal: la serie
 * vuelve a mostrarse como "sin puntuar". Una fila por serie, no por temporada.
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug) {
    return json({ error: 'slug inválido' }, 400);
  }

  const data = await request.json() as { rating_personal?: unknown };
  const validation = validateRatingPersonal(data.rating_personal ?? null);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  await setPersonalRating(env.DB, slug, validation.value);
  return json({ ok: true, rating_personal: validation.value });
};
