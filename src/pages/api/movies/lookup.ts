import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupTmdbMovieId, fetchTmdbMoviePreview } from '../../../services/tmdbMovies';
import { parseMediaQuery } from '../../../utils/mediaQuery';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Resuelve un slug de Trakt o un id de TMDB a los datos de la película, sin
 * guardar nada. Sirve para que el modal muestre qué encontró antes de crear la
 * entrada: la búsqueda por título acierta ~99%, y esa confirmación visual es lo
 * que evita que el 1% restante entre mal y sin que nadie se entere.
 *
 * Devuelve además en qué años ya está registrada, para no cargarla dos veces.
 */
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') || '';

  const parsed = parseMediaQuery(q);
  if (!parsed) {
    return json({ error: 'Escribe el slug o la URL de Trakt, o el id de TMDB' }, 400);
  }

  const lookup = await lookupTmdbMovieId(parsed);
  if (!lookup.ok) return json({ error: 'TMDB no respondió' }, 502);
  if (lookup.id === null) {
    return json({ error: `No se encontró "${q}" en TMDB` }, 404);
  }

  const preview = await fetchTmdbMoviePreview(lookup.id);
  if (!preview) return json({ error: 'TMDB no devolvió los datos de la película' }, 502);

  const { results } = await env.DB.prepare(
    'SELECT year_watched FROM movies_watched WHERE tmdb_id = ? ORDER BY year_watched'
  ).bind(lookup.id).all<{ year_watched: number }>();

  return json({
    ...preview,
    watched_years: (results || []).map(r => r.year_watched),
  });
};
