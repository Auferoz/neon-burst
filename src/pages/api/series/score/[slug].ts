import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { setManualScore, setPersonalRating } from '../../../../services/seriesService';
import { validateScoreUpdateBody } from '../../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Alta/edición/borrado de los scores de una serie, por trakt_slug.
 * Body: `{ rating_personal?, rating_tmdb?, rating_imdb? }`, los tres
 * opcionales e independientes. Una clave ausente no se toca; `null` borra
 * ese score (y, para tmdb/imdb, vuelve a dejarlo en manos del refresco
 * automático); un entero 0-100 lo guarda (y, para tmdb/imdb, lo marca manual
 * para que el refresco de 30 días y los backfills dejen de pisarlo).
 * `rating_personal` es por serie, no por temporada.
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug) {
    return json({ error: 'slug inválido' }, 400);
  }

  const data = await request.json();
  const validation = validateScoreUpdateBody(data);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  const { rating_personal, rating_tmdb, rating_imdb } = validation.value;
  if ('rating_personal' in validation.value) await setPersonalRating(env.DB, slug, rating_personal ?? null);
  if ('rating_tmdb' in validation.value) await setManualScore(env.DB, slug, 'rating_tmdb', rating_tmdb ?? null);
  if ('rating_imdb' in validation.value) await setManualScore(env.DB, slug, 'rating_imdb', rating_imdb ?? null);

  return json({ ok: true, ...validation.value });
};
