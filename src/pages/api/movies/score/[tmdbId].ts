import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { setManualScore, setPersonalRating } from '../../../../services/moviesService';
import { validateScoreUpdateBody } from '../../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Alta/edición/borrado de los scores de una película, por tmdb_id.
 * Body: `{ rating_personal?, rating_tmdb?, rating_imdb? }`, los tres
 * opcionales e independientes. Una clave ausente no se toca; `null` borra
 * ese score (y, para tmdb/imdb, vuelve a dejarlo en manos del refresco
 * automático); un entero 0-100 lo guarda (y, para tmdb/imdb, lo marca manual
 * para que el refresco de 30 días y los backfills dejen de pisarlo).
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const tmdbId = Number(params.tmdbId);
  if (!Number.isInteger(tmdbId)) {
    return json({ error: 'tmdbId inválido' }, 400);
  }

  const data = await request.json();
  const validation = validateScoreUpdateBody(data);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  const { rating_personal, rating_tmdb, rating_imdb } = validation.value;
  if ('rating_personal' in validation.value) await setPersonalRating(env.DB, tmdbId, rating_personal ?? null);
  if ('rating_tmdb' in validation.value) await setManualScore(env.DB, tmdbId, 'rating_tmdb', rating_tmdb ?? null);
  if ('rating_imdb' in validation.value) await setManualScore(env.DB, tmdbId, 'rating_imdb', rating_imdb ?? null);

  return json({ ok: true, ...validation.value });
};
