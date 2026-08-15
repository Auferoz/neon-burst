/**
 * TMDB series provider — FALLBACK TEMPORAL mientras la API de Trakt no esté disponible.
 *
 * Trakt sigue siendo la fuente primaria (ver seriesSync.ts / seriesService.ts).
 * Este módulo solo entra en acción cuando Trakt falla, y devuelve los datos
 * con la misma forma que las funciones de Trakt para que el resto del código
 * no cambie. Cuando se recupere Trakt, basta con dejar de llamar a estas
 * funciones (o correr el reset de `detail_source` para re-fetchear desde Trakt).
 */

import { env } from 'cloudflare:workers';
import type { CastMember, Season, SeriesImages, Video } from './seriesService';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

/** Marca guardada en series_cache.detail_source para saber qué datos vinieron de TMDB. */
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
      console.error(`[tmdbSeries] ${path} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as T;
  } catch (e) {
    console.error(`[tmdbSeries] ${path} error:`, e);
    return null;
  }
}

/**
 * Convierte un slug de Trakt en término de búsqueda + año.
 * "my-hero-academia" → { query: "my hero academia" }
 * "the-office-2005"  → { query: "the office", year: 2005 }
 */
function slugToQuery(slug: string): { query: string; year?: number } {
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /^\d{4}$/.test(last)) {
    const year = Number(last);
    if (year >= 1900 && year <= new Date().getFullYear() + 5) {
      return { query: parts.slice(0, -1).join(' '), year };
    }
  }
  return { query: parts.join(' ') };
}

interface TmdbSearchResult {
  results?: Array<{ id: number; name: string; first_air_date?: string; popularity?: number }>;
}

/**
 * Búsqueda en TMDB a partir de un slug de Trakt.
 * Distingue "TMDB respondió pero no hay resultados" (slug inexistente) de
 * "TMDB falló" (key ausente, red caída), para poder responder 404 vs 502.
 */
export type TmdbLookup =
  | { ok: true; id: number }
  | { ok: true; id: null }   // TMDB respondió: no existe
  | { ok: false; id: null }; // TMDB no respondió

export async function lookupTmdbTvId(slug: string): Promise<TmdbLookup> {
  const { query, year } = slugToQuery(slug);
  const queryParam = `&query=${encodeURIComponent(query)}`;

  let data = await tmdbFetch<TmdbSearchResult>(
    '/search/tv', queryParam + (year ? `&first_air_date_year=${year}` : '')
  );
  if (!data) return { ok: false, id: null };

  // Si el año del slug no dio resultados, reintentar sin filtrar por año
  if (!data.results?.length && year) {
    data = await tmdbFetch<TmdbSearchResult>('/search/tv', queryParam);
    if (!data) return { ok: false, id: null };
  }

  const id = data.results?.[0]?.id;
  return id ? { ok: true, id } : { ok: true, id: null };
}

/** Resuelve el id de TMDB a partir de un slug de Trakt (null si no se encuentra). */
export async function resolveTmdbTvId(slug: string): Promise<number | null> {
  return (await lookupTmdbTvId(slug)).id;
}

interface TmdbTvShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  tagline?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  status?: string;
  original_language?: string;
  origin_country?: string[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: Array<{ name: string }>;
  networks?: Array<{ name: string; logo_path?: string | null }>;
  seasons?: Array<{ season_number: number; name: string; episode_count: number; overview: string; poster_path?: string | null }>;
  external_ids?: { imdb_id?: string | null };
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> };
  images?: { posters?: Array<{ file_path: string }>; backdrops?: Array<{ file_path: string }>; logos?: Array<{ file_path: string }> };
}

/** Estado de TMDB → convención de Trakt (minúsculas). */
function normalizeStatus(status?: string): string {
  if (!status) return '';
  const map: Record<string, string> = {
    'Returning Series': 'returning series',
    'Ended': 'ended',
    'Canceled': 'canceled',
    'In Production': 'in production',
    'Planned': 'planned',
    'Pilot': 'pilot',
  };
  return map[status] || status.toLowerCase();
}

/** Datos básicos de la serie, con la forma que necesita series_cache. */
export interface TmdbShowBasic {
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number | null;
  overview: string;
  rating: number;
  genres: string;
  network: string;
  status: string;
  runtime: number;
  poster: string;
  thumb: string;
}

export async function fetchTmdbShowBasic(tmdbId: number): Promise<TmdbShowBasic | null> {
  const show = await tmdbFetch<TmdbTvShow>(`/tv/${tmdbId}`, '&append_to_response=external_ids');
  if (!show) return null;

  return {
    tmdb_id: show.id,
    imdb_id: show.external_ids?.imdb_id || '',
    title: show.name || show.original_name || '',
    year: show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : null,
    overview: show.overview || '',
    rating: Math.round((show.vote_average || 0) * 10) / 10,
    genres: (show.genres || []).map(g => g.name).join(', '),
    network: show.networks?.[0]?.name || '',
    status: normalizeStatus(show.status),
    runtime: show.episode_run_time?.[0] || 0,
    poster: tmdbImage(show.poster_path, 'w500'),
    thumb: tmdbImage(show.backdrop_path, 'w780'),
  };
}

/** Detalle completo con la misma forma que el detalle de Trakt. */
export interface TmdbShowDetail {
  tagline: string;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  fanart: string;
  logo: string;
  first_aired: string;
  aired_episodes: number;
  votes: number;
  cast: CastMember[];
  videos: Video[];
  images: SeriesImages;
  seasons: Season[];
}

export async function fetchTmdbShowDetail(tmdbId: number): Promise<TmdbShowDetail | null> {
  const show = await tmdbFetch<TmdbTvShow>(
    `/tv/${tmdbId}`,
    '&append_to_response=external_ids,content_ratings,images&include_image_language=es,en,null'
  );
  if (!show) return null;

  const cast = await fetchTmdbCast(tmdbId);
  const videos = await fetchTmdbVideos(tmdbId);

  const images: SeriesImages = {
    poster: (show.images?.posters || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w500')),
    fanart: (show.images?.backdrops || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w1280')),
    thumb: (show.images?.backdrops || []).slice(0, 10).map(i => tmdbImage(i.file_path, 'w780')),
    banner: [],
    logo: (show.images?.logos || []).slice(0, 5).map(i => tmdbImage(i.file_path, 'w300')),
    clearart: [],
  };

  const seasons = await fetchTmdbSeasons(tmdbId, show.seasons || []);

  const trailer = videos.find(v => v.type === 'Trailer')?.key || videos[0]?.key || '';
  const certification = (show.content_ratings?.results || [])
    .find(r => r.iso_3166_1 === 'US' || r.iso_3166_1 === 'ES')?.rating || '';

  return {
    tagline: show.tagline || '',
    certification,
    country: (show.origin_country?.[0] || '').toLowerCase(),
    language: show.original_language || '',
    trailer,
    fanart: images.fanart[0] || tmdbImage(show.backdrop_path, 'w1280'),
    logo: images.logo[0] || '',
    first_aired: show.first_air_date || '',
    aired_episodes: show.number_of_episodes || 0,
    votes: show.vote_count || 0,
    cast,
    videos,
    images,
    seasons,
  };
}

interface TmdbAggregateCredits {
  cast?: Array<{
    id: number;
    name: string;
    profile_path?: string | null;
    total_episode_count?: number;
    roles?: Array<{ character: string; episode_count: number }>;
  }>;
}

/**
 * Cast desde /aggregate_credits: en series (sobre todo anime) el `credits`
 * a nivel de show viene casi vacío, mientras aggregate_credits agrupa el
 * reparto de todas las temporadas e incluye el conteo de episodios.
 */
async function fetchTmdbCast(tmdbId: number): Promise<CastMember[]> {
  const data = await tmdbFetch<TmdbAggregateCredits>(`/tv/${tmdbId}/aggregate_credits`);
  return (data?.cast || []).slice(0, 20).map(p => ({
    name: p.name,
    character: p.roles?.[0]?.character || '',
    headshot: tmdbImage(p.profile_path, 'w185'),
    episode_count: p.roles?.[0]?.episode_count || p.total_episode_count || 0,
    tmdb_id: p.id,
  }));
}

/** Trailers/videos de YouTube; si no hay en español, reintenta en inglés. */
async function fetchTmdbVideos(tmdbId: number): Promise<Video[]> {
  type VideoResults = { results?: Array<{ name: string; key: string; type: string; site: string }> };

  const pick = (data: VideoResults | null): Video[] => (data?.results || [])
    .filter(v => v.site === 'YouTube')
    .slice(0, 10)
    .map(v => ({ name: v.name, key: v.key, type: v.type, site: v.site }));

  const es = pick(await tmdbFetch<VideoResults>(`/tv/${tmdbId}/videos`));
  if (es.length) return es;

  return pick(await tmdbFetch<VideoResults>(`/tv/${tmdbId}/videos`, '', 'en-US'));
}

interface TmdbSeasonDetail {
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string | null;
  vote_average?: number;
  episodes?: Array<{
    episode_number: number;
    name: string;
    overview: string;
    vote_average?: number;
    runtime?: number | null;
    air_date?: string;
    episode_type?: string;
    still_path?: string | null;
  }>;
}

/** Trae cada temporada con sus episodios (TMDB requiere una petición por temporada). */
async function fetchTmdbSeasons(
  tmdbId: number,
  summary: Array<{ season_number: number; name: string; episode_count: number; overview: string; poster_path?: string | null }>
): Promise<Season[]> {
  const wanted = summary.filter(s => s.season_number > 0); // excluir especiales
  const seasons: Season[] = [];

  for (const s of wanted) {
    const detail = await tmdbFetch<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${s.season_number}`);

    const episodes = (detail?.episodes || []).map(e => ({
      number: e.episode_number,
      title: e.name || '',
      overview: e.overview || '',
      rating: Math.round((e.vote_average || 0) * 10) / 10,
      runtime: e.runtime || 0,
      first_aired: e.air_date || '',
      screenshot: tmdbImage(e.still_path, 'w300'),
      episode_type: e.episode_type || 'standard',
    }));

    const today = new Date().toISOString().slice(0, 10);
    seasons.push({
      number: s.season_number,
      title: detail?.name || s.name || `Temporada ${s.season_number}`,
      episode_count: s.episode_count || episodes.length,
      aired_episodes: episodes.filter(e => e.first_aired && e.first_aired <= today).length,
      rating: Math.round((detail?.vote_average || 0) * 10) / 10,
      overview: detail?.overview || s.overview || '',
      poster: tmdbImage(detail?.poster_path ?? s.poster_path, 'w500'),
      episodes,
    });
  }

  return seasons;
}

/**
 * Resuelve el id de TMDB y trae los datos básicos en un paso, a partir del slug.
 * `found: false` significa que TMDB respondió y la serie no existe;
 * `available: false` significa que TMDB no se pudo consultar.
 */
export async function fetchTmdbShowBySlug(
  slug: string
): Promise<{ available: boolean; found: boolean; show: TmdbShowBasic | null }> {
  const lookup = await lookupTmdbTvId(slug);
  if (!lookup.ok) return { available: false, found: false, show: null };
  if (!lookup.id) return { available: true, found: false, show: null };

  const show = await fetchTmdbShowBasic(lookup.id);
  if (!show) return { available: false, found: true, show: null };

  return { available: true, found: true, show };
}
