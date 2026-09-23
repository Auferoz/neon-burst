import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  getAllMovies,
  createMovieEntry,
  CreateMovieFailure,
  type CreateMovieError,
} from '../../../services/moviesService';
import { validateRatingPersonal } from '../../../services/movieScores';

export const prerender = false;

const json = (body: unknown, status = 200, cache?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(cache ? { 'Cache-Control': cache } : {}),
    },
  });

export const GET: APIRoute = async () => {
  const movies = await getAllMovies(env.DB);
  return json(movies, 200, 'public, max-age=300');
};

const STATUS_BY_REASON: Record<CreateMovieError, number> = {
  invalid_query: 400,
  not_found: 404,
  duplicate: 409,
  provider_down: 502,
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json() as {
    query?: string;
    year_watched?: number;
    platform?: string;
    rating_personal?: number | null;
  };

  if (!data.query || !data.year_watched) {
    return json({ error: 'query y year_watched son obligatorios' }, 400);
  }

  let ratingPersonal: number | null = null;
  if (data.rating_personal !== undefined && data.rating_personal !== null) {
    const validation = validateRatingPersonal(data.rating_personal);
    if (!validation.ok) return json({ error: validation.error }, 400);
    ratingPersonal = validation.value;
  }

  try {
    const entry = await createMovieEntry(env.DB, {
      query: data.query,
      year_watched: Number(data.year_watched),
      platform: data.platform,
      rating_personal: ratingPersonal,
    });
    return json(entry, 201);
  } catch (e) {
    if (e instanceof CreateMovieFailure) {
      return json({ error: e.message }, STATUS_BY_REASON[e.reason]);
    }
    console.error('[api/movies] POST failed:', e);
    return json({ error: 'Error al crear la película' }, 500);
  }
};
