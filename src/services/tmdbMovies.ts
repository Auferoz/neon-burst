/**
 * TMDB movies provider — FALLBACK TEMPORAL mientras la API de Trakt no esté disponible.
 *
 * Espejo de `tmdbSeries.ts` para películas. Trakt sigue siendo la fuente primaria
 * (ver moviesService.ts); esto solo entra cuando Trakt falla, y devuelve los datos
 * con la misma forma que los fetchers de Trakt para que el resto del código no cambie.
 */

import { env } from 'cloudflare:workers';
import type { CastMember, MovieImages, Video } from './moviesService';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

/** Marca guardada en movies_cache.data_source para saber qué datos vinieron de TMDB. */
export const TMDB_SOURCE = 'tmdb';

function tmdbImage(path: string | null | undefined, size: string): string {
  if (!path) return '';
  return `${TMDB_IMG}/${size}${path}`;
}

async function tmdbFetch<T>(path: string, params = '', language = 'es-ES'): Promise<T | null> {
  if (!env.TMDB_API_KEY) return null;
  try {
    const res = await fetch(`${TMDB_API_URL}${path}?api_key=${env.TMDB_API_KEY}&language=${language}${params}`);
    if (!res.ok) {
      console.error(`[tmdbMovies] ${path} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as T;
  } catch (e) {
    console.error(`[tmdbMovies] ${path} error:`, e);
    return null;
  }
}

interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  tagline?: string;
  release_date?: string;
  runtime?: number;
  homepage?: string;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: Array<{ name: string }>;
  production_countries?: Array<{ iso_3166_1: string }>;
  external_ids?: { imdb_id?: string | null };
  credits?: { cast?: Array<{ id: number; name: string; character?: string; profile_path?: string | null }> };
  videos?: { results?: Array<{ name: string; key: string; type: string; site: string }> };
  images?: {
    posters?: Array<{ file_path: string }>;
    backdrops?: Array<{ file_path: string }>;
    logos?: Array<{ file_path: string }>;
  };
  release_dates?: {
    results?: Array<{ iso_3166_1: string; release_dates?: Array<{ certification?: string }> }>;
  };
}

/** Detalle completo con la misma forma que el detalle de Trakt. */
export interface TmdbMovieDetail {
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number | null;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  thumb: string;
  tagline: string;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  homepage: string;
  fanart: string;
  logo: string;
  votes: number;
  cast: CastMember[];
  videos: Video[];
  images: MovieImages;
}

/** Certificación de edad: se prefiere España y, si no hay, Estados Unidos. */
function pickCertification(movie: TmdbMovie): string {
  const results = movie.release_dates?.results || [];
  for (const iso of ['ES', 'US']) {
    const entry = results.find(r => r.iso_3166_1 === iso);
    const cert = entry?.release_dates?.find(d => d.certification)?.certification;
    if (cert) return cert;
  }
  return '';
}

/**
 * Vídeos de YouTube. TMDB devuelve pocos (o ninguno) en español, así que si la
 * consulta localizada viene vacía se reintenta en inglés.
 */
async function fetchTmdbVideos(tmdbId: number, embedded: TmdbMovie['videos']): Promise<Video[]> {
  const toVideos = (results: Array<{ name: string; key: string; type: string; site: string }> = []) =>
    results
      .filter(v => v.site === 'YouTube')
      .slice(0, 10)
      .map(v => ({ name: v.name, key: v.key, type: v.type, site: v.site }));

  const localized = toVideos(embedded?.results);
  if (localized.length) return localized;

  const fallback = await tmdbFetch<{ results?: Array<{ name: string; key: string; type: string; site: string }> }>(
    `/movie/${tmdbId}/videos`, '', 'en-US'
  );
  return toVideos(fallback?.results);
}

/**
 * Detalle de una película desde TMDB, listo para escribir en movies_cache.
 * Devuelve null si TMDB no responde o no existe el id.
 */
export async function fetchTmdbMovieDetail(tmdbId: number): Promise<TmdbMovieDetail | null> {
  const movie = await tmdbFetch<TmdbMovie>(
    `/movie/${tmdbId}`,
    '&append_to_response=credits,images,release_dates,videos,external_ids&include_image_language=es,en,null'
  );
  if (!movie) return null;

  const images: MovieImages = {
    poster: (movie.images?.posters || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w500')),
    fanart: (movie.images?.backdrops || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w1280')),
    thumb: (movie.images?.backdrops || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w780')),
    banner: [],
    logo: (movie.images?.logos || []).slice(0, 5).map(i => tmdbImage(i.file_path, 'w300')),
    clearart: [],
  };

  const cast: CastMember[] = (movie.credits?.cast || []).slice(0, 20).map(p => ({
    name: p.name,
    character: p.character || '',
    headshot: tmdbImage(p.profile_path, 'w185'),
    tmdb_id: p.id,
  }));

  const videos = await fetchTmdbVideos(tmdbId, movie.videos);
  const trailer = videos.find(v => v.type === 'Trailer')?.key || videos[0]?.key || '';

  // TMDB suele no tener tagline/overview traducidos: se completan desde en-US
  let { tagline = '', overview = '' } = movie;
  if (!tagline || !overview) {
    const en = await tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, '', 'en-US');
    tagline = tagline || en?.tagline || '';
    overview = overview || en?.overview || '';
  }

  return {
    tmdb_id: movie.id,
    imdb_id: movie.external_ids?.imdb_id || '',
    title: movie.title || movie.original_title || '',
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    released: movie.release_date || '',
    runtime: movie.runtime || 0,
    genres: (movie.genres || []).map(g => g.name).join(', '),
    overview,
    rating: Math.round((movie.vote_average || 0) * 10) / 10,
    poster: tmdbImage(movie.poster_path, 'w500'),
    thumb: tmdbImage(movie.backdrop_path, 'w780'),
    tagline,
    certification: pickCertification(movie),
    country: (movie.production_countries?.[0]?.iso_3166_1 || '').toLowerCase(),
    language: movie.original_language || '',
    trailer,
    homepage: movie.homepage || '',
    fanart: images.fanart[0] || tmdbImage(movie.backdrop_path, 'w1280'),
    logo: images.logo[0] || '',
    votes: movie.vote_count || 0,
    cast,
    videos,
    images,
  };
}

interface TmdbFindResult {
  movie_results?: Array<{ id: number }>;
}

/** Resuelve el id de TMDB a partir del IMDb id, para filas sin tmdb_id. */
export async function resolveTmdbMovieIdByImdb(imdbId: string): Promise<number | null> {
  if (!imdbId) return null;
  const data = await tmdbFetch<TmdbFindResult>(`/find/${imdbId}`, '&external_source=imdb_id');
  return data?.movie_results?.[0]?.id || null;
}
