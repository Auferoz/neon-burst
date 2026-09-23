/**
 * Movies service — D1 CRUD + on-demand detail fetch from Trakt/TMDB
 */

import { env } from 'cloudflare:workers';
import { fetchTmdbEnglishTitle, fetchTmdbMovieDetail, fetchTmdbScore, lookupTmdbMovieId, resolveTmdbMovieIdByImdb, TMDB_SOURCE } from './tmdbMovies';
import { parseMediaQuery } from '../utils/mediaQuery';
import { fetchImdbRating } from './omdb';
import { validateRatingPersonal } from './movieScores';

const TRAKT_API_URL = 'https://api.trakt.tv';

function getTraktHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'trakt-api-key': env.TRAKT_CLIENT_ID,
    'trakt-api-version': '2',
    'User-Agent': 'neon-burst/1.0',
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

// ── Interfaces ──

export interface CastMember {
  name: string;
  character: string;
  headshot: string;
  tmdb_id: number | null;
}

export interface Video {
  name: string;
  key: string;
  type: string;
  site: string;
}

export interface MovieImages {
  poster: string[];
  fanart: string[];
  thumb: string[];
  banner: string[];
  logo: string[];
  clearart: string[];
}

export interface MovieDetail {
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
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
  cast: CastMember[];
  videos: Video[];
  images: MovieImages;
  after_credits: boolean;
  during_credits: boolean;
  votes: number;
  rating_tmdb: number | null;
  rating_imdb: number | null;
  rating_personal: number | null;
}

/** Una película vista: la fila de movies_watched + su metadata de movies_cache. */
export interface MovieListItem {
  watched_id: number;
  year_watched: number;
  platform: string;
  source: string;
  listed_at: string;
  trakt_id: number | null;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  thumb: string;
  rating_tmdb: number | null;
  rating_imdb: number | null;
  rating_personal: number | null;
}

/**
 * Lista completa de películas vistas.
 *
 * El año sale de movies_watched.year_watched. El JOIN con movies_cache es por
 * tmdb_id porque es el único identificador disponible tanto en lo que trae
 * Trakt como en lo que se carga a mano; movies_personal se suma con LEFT JOIN
 * porque la mayoría de las películas todavía no tienen score propio.
 */
export async function getAllMovies(db: D1Database): Promise<MovieListItem[]> {
  const { results } = await db.prepare(
    `SELECT
       w.id AS watched_id, w.year_watched, w.platform, w.source, w.listed_at,
       COALESCE(w.trakt_id, c.trakt_id) AS trakt_id,
       c.tmdb_id, c.imdb_id, c.title, c.year, c.released, c.runtime,
       c.genres, c.overview, c.rating, c.poster, c.thumb,
       c.rating_tmdb, c.rating_imdb, p.rating_personal
     FROM movies_watched w
     JOIN movies_cache c ON c.tmdb_id = w.tmdb_id
     LEFT JOIN movies_personal p ON p.tmdb_id = w.tmdb_id
     ORDER BY w.year_watched DESC, w.listed_at DESC`
  ).all<MovieListItem>();

  return results || [];
}

/**
 * Alta/edición/borrado del score personal de una película.
 * Una fila por tmdb_id: un rewatch en otro año muestra el mismo score.
 * `ratingPersonal: null` borra la fila (vuelve a "sin puntuar").
 */
export async function setPersonalRating(db: D1Database, tmdbId: number, ratingPersonal: number | null): Promise<void> {
  if (ratingPersonal === null) {
    await db.prepare('DELETE FROM movies_personal WHERE tmdb_id = ?').bind(tmdbId).run();
    return;
  }
  await db.prepare(
    `INSERT INTO movies_personal (tmdb_id, rating_personal, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(tmdb_id) DO UPDATE SET rating_personal = excluded.rating_personal, updated_at = datetime('now')`
  ).bind(tmdbId, ratingPersonal).run();
}

/** Motivos por los que un alta manual puede fallar, mapeados a HTTP en la API. */
export type CreateMovieError =
  | 'invalid_query'   // 400 — no parece slug de Trakt ni id de TMDB
  | 'not_found'       // 404 — TMDB respondió y no existe
  | 'provider_down'   // 502 — TMDB no respondió
  | 'duplicate';      // 409 — ya está esa película en ese año

export class CreateMovieFailure extends Error {
  constructor(public reason: CreateMovieError, message: string) {
    super(message);
    this.name = 'CreateMovieFailure';
  }
}

/**
 * trakt_id provisional para una película cargada a mano.
 *
 * movies_cache.trakt_id es INTEGER PRIMARY KEY, o sea alias del rowid: insertar
 * NULL haría que SQLite asigne max+1, un id positivo que puede chocar con el
 * trakt_id real de otra película cuando vuelva el sync. Los ids de Trakt son
 * siempre positivos, así que el negativo del tmdb_id no colisiona nunca y deja
 * a la vista que la fila todavía no fue confirmada por Trakt.
 *
 * La fase 4 del plan lo reemplaza por el id real al reconciliar.
 */
function provisionalTraktId(tmdbId: number): number {
  return -tmdbId;
}

/** ¿Es un trakt_id provisional (puesto por un alta manual) y no uno real? */
export function isProvisionalTraktId(traktId: number | null): boolean {
  return traktId !== null && traktId < 0;
}

/**
 * Da de alta una película vista a mano.
 *
 * Resuelve lo que escribió el usuario (slug de Trakt o id de TMDB), trae la
 * metadata de TMDB si la película todavía no está cacheada, y crea la fila en
 * movies_watched. No toca nada de lo que sincroniza Trakt.
 */
export async function createMovieEntry(
  db: D1Database,
  data: { query: string; year_watched: number; platform?: string; rating_personal?: number | null }
): Promise<MovieListItem> {
  const parsed = parseMediaQuery(data.query);
  if (!parsed) {
    throw new CreateMovieFailure(
      'invalid_query',
      'Escribe el slug o la URL de Trakt (ej. dune-part-two-2024) o el id de TMDB'
    );
  }

  const lookup = await lookupTmdbMovieId(parsed);
  if (!lookup.ok) {
    throw new CreateMovieFailure('provider_down', 'TMDB no respondió. Intenta de nuevo en un momento.');
  }
  if (lookup.id === null) {
    throw new CreateMovieFailure('not_found', `No se encontró "${data.query}" en TMDB. Prueba pegando el id de TMDB.`);
  }

  const tmdbId = lookup.id;

  // Cachear la metadata solo si esta película todavía no está
  const cached = await db.prepare('SELECT trakt_id FROM movies_cache WHERE tmdb_id = ?')
    .bind(tmdbId).first<{ trakt_id: number }>();

  if (!cached) {
    const detail = await fetchTmdbMovieDetail(tmdbId);
    if (!detail) {
      throw new CreateMovieFailure('provider_down', 'TMDB no devolvió los datos de la película.');
    }

    // El título va en inglés para no mezclar idiomas con lo que vino de Trakt
    const title = (await fetchTmdbEnglishTitle(tmdbId)) || detail.title;

    // OMDb es best-effort: si falla o no hay imdb_id, se guarda null y no
    // bloquea el alta. El backfill / la revisita a la ficha lo completan después.
    const ratingImdb = detail.imdb_id && env.OMDB_API_KEY
      ? await fetchImdbRating(detail.imdb_id, env.OMDB_API_KEY)
      : null;

    await db.prepare(
      `INSERT INTO movies_cache
         (trakt_id, tmdb_id, imdb_id, title, year, released, runtime, genres, overview,
          rating, poster, thumb, tagline, certification, country, language, trailer,
          homepage, fanart, logo, votes, cast_json, videos_json, images_json,
          rating_tmdb, rating_imdb, ratings_fetched_at,
          data_source, detail_fetched_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, datetime('now'),
               ?, datetime('now'), datetime('now'))`
    ).bind(
      provisionalTraktId(tmdbId), tmdbId, detail.imdb_id, title, detail.year,
      detail.released, detail.runtime, detail.genres, detail.overview, detail.rating,
      detail.poster, detail.thumb, detail.tagline, detail.certification, detail.country,
      detail.language, detail.trailer, detail.homepage, detail.fanart, detail.logo,
      detail.votes, JSON.stringify(detail.cast), JSON.stringify(detail.videos),
      JSON.stringify(detail.images), detail.rating_tmdb, ratingImdb, TMDB_SOURCE,
    ).run();
  }

  const slug = parsed.kind === 'slug' ? parsed.slug : null;

  try {
    await db.prepare(
      `INSERT INTO movies_watched (tmdb_id, trakt_slug, year_watched, platform, source, listed_at)
       VALUES (?, ?, ?, ?, 'manual', datetime('now'))`
    ).bind(tmdbId, slug, data.year_watched, data.platform || null).run();
  } catch (e) {
    if ((e as Error).message.includes('UNIQUE')) {
      throw new CreateMovieFailure('duplicate', `Esa película ya está registrada en ${data.year_watched}`);
    }
    throw e;
  }

  if (data.rating_personal !== undefined && data.rating_personal !== null) {
    const validation = validateRatingPersonal(data.rating_personal);
    if (validation.ok) {
      await setPersonalRating(db, tmdbId, validation.value);
    }
  }

  const created = await getMovieEntry(db, tmdbId, data.year_watched);
  if (!created) throw new Error('La película se creó pero no se pudo leer de vuelta');
  return created;
}

/** Una entrada concreta de movies_watched, con su metadata. */
export async function getMovieEntry(
  db: D1Database,
  tmdbId: number,
  yearWatched: number
): Promise<MovieListItem | null> {
  return db.prepare(
    `SELECT
       w.id AS watched_id, w.year_watched, w.platform, w.source, w.listed_at,
       COALESCE(w.trakt_id, c.trakt_id) AS trakt_id,
       c.tmdb_id, c.imdb_id, c.title, c.year, c.released, c.runtime,
       c.genres, c.overview, c.rating, c.poster, c.thumb,
       c.rating_tmdb, c.rating_imdb, p.rating_personal
     FROM movies_watched w
     JOIN movies_cache c ON c.tmdb_id = w.tmdb_id
     LEFT JOIN movies_personal p ON p.tmdb_id = w.tmdb_id
     WHERE w.tmdb_id = ? AND w.year_watched = ?`
  ).bind(tmdbId, yearWatched).first<MovieListItem>();
}

/**
 * Borra una entrada de movies_watched por su id.
 * La metadata en movies_cache se conserva: es caché, no dato del usuario.
 */
export async function deleteMovieEntry(db: D1Database, watchedId: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM movies_watched WHERE id = ?').bind(watchedId).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Una fila de movies_watched, tal como la edita el modal de la ficha. */
export interface MovieWatchedRow {
  watched_id: number;
  year_watched: number;
  platform: string;
}

/**
 * Todas las veces que se vio una película (una fila por `year_watched`),
 * para el modal de edición de `movies/[id].astro`.
 */
export async function getMovieWatchedEntries(db: D1Database, tmdbId: number): Promise<MovieWatchedRow[]> {
  const { results } = await db.prepare(
    'SELECT id AS watched_id, year_watched, platform FROM movies_watched WHERE tmdb_id = ? ORDER BY year_watched DESC'
  ).bind(tmdbId).all<MovieWatchedRow>();
  return results || [];
}

/** Se lanza cuando el UNIQUE(tmdb_id, year_watched) choca en una edición. */
export class DuplicateWatchedYearError extends Error {
  constructor() {
    super('Ya existe un registro de esta película en ese año');
    this.name = 'DuplicateWatchedYearError';
  }
}

/**
 * Edita `year_watched` y/o `platform` de una entrada de movies_watched.
 * `data` ya viene validado (allowlist) por `validateMovieWatchedUpdate`.
 */
export async function updateMovieEntry(
  db: D1Database,
  watchedId: number,
  data: { year_watched?: number; platform?: string }
): Promise<MovieWatchedRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.year_watched !== undefined) {
    fields.push('year_watched = ?');
    values.push(data.year_watched);
  }
  if (data.platform !== undefined) {
    fields.push('platform = ?');
    values.push(data.platform);
  }

  if (fields.length === 0) return null;

  values.push(watchedId);

  try {
    await db.prepare(`UPDATE movies_watched SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  } catch (e) {
    if ((e as Error).message.includes('UNIQUE')) {
      throw new DuplicateWatchedYearError();
    }
    throw e;
  }

  return db.prepare('SELECT id AS watched_id, year_watched, platform FROM movies_watched WHERE id = ?')
    .bind(watchedId).first<MovieWatchedRow>();
}

// ── Trakt API fetchers ──

interface TraktMovieFull {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  tagline: string;
  overview: string;
  released: string;
  runtime: number;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  homepage: string;
  rating: number;
  votes: number;
  genres: string[];
  after_credits: boolean;
  during_credits: boolean;
  images?: {
    poster?: string[];
    fanart?: string[];
    thumb?: string[];
    banner?: string[];
    logo?: string[];
    clearart?: string[];
  };
}

interface TraktPerson {
  character: string;
  characters: string[];
  person: {
    name: string;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    images?: { headshot?: string[] };
  };
}

async function fetchTraktMovie(slugOrId: string | number): Promise<TraktMovieFull | null> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/movies/${slugOrId}?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[movies] fetchTraktMovie ${slugOrId} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as TraktMovieFull;
  } catch (e) {
    console.error(`[movies] fetchTraktMovie ${slugOrId} error:`, e);
    return null;
  }
}

async function fetchTraktMoviePeople(slugOrId: string | number): Promise<CastMember[]> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/movies/${slugOrId}/people?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[movies] fetchTraktMoviePeople ${slugOrId} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { cast?: TraktPerson[] };
    return (data.cast || []).slice(0, 20).map(p => ({
      name: p.person.name,
      character: p.characters?.[0] || p.character || '',
      headshot: traktImage(p.person.images?.headshot?.[0]),
      tmdb_id: p.person.ids?.tmdb || null,
    }));
  } catch (e) {
    console.error(`[movies] fetchTraktMoviePeople ${slugOrId} error:`, e);
    return [];
  }
}

async function fetchTmdbVideos(tmdbId: number): Promise<Video[]> {
  if (!tmdbId || !env.TMDB_API_KEY) return [];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${env.TMDB_API_KEY}`);
    if (!res.ok) {
      console.error(`[movies] fetchTmdbVideos ${tmdbId} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { results: Array<{ name: string; key: string; type: string; site: string }> };
    return (data.results || [])
      .filter(v => v.site === 'YouTube')
      .slice(0, 10)
      .map(v => ({ name: v.name, key: v.key, type: v.type, site: v.site }));
  } catch (e) {
    console.error(`[movies] fetchTmdbVideos ${tmdbId} error:`, e);
    return [];
  }
}

// ── Main service functions ──

/**
 * Detalle de una película por id de la URL.
 *
 * El id es el `tmdb_id`, que no cambia nunca. Se acepta también el `trakt_id`
 * como respaldo para no romper links viejos: las rutas de antes usaban ese, y
 * además el trakt_id de una película cargada a mano es provisional y lo
 * reemplaza la reconciliación con Trakt.
 */
export async function getMovieById(db: D1Database, id: number): Promise<MovieDetail | null> {
  const byId = (column: 'tmdb_id' | 'trakt_id') =>
    db.prepare(`SELECT * FROM movies_cache WHERE ${column} = ?`).bind(id).first<Record<string, unknown>>();

  let row = (await byId('tmdb_id')) || (await byId('trakt_id'));
  if (!row) return null;

  const traktId = row.trakt_id as number;

  // On-demand detail fetch (or re-fetch if stale/empty)
  const needsFetch = !row.detail_fetched_at || (
    row.cast_json === '[]' && row.detail_fetched_at
  );
  if (needsFetch) {
    await fetchMovieDetail(db, traktId, row.tmdb_id as number, (row.imdb_id as string) || '');
    const updated = await db.prepare('SELECT * FROM movies_cache WHERE trakt_id = ?').bind(traktId).first<Record<string, unknown>>();
    if (updated) row = updated;
  }

  const scores = await refreshMovieScoresIfStale(
    db,
    row.tmdb_id as number,
    (row.imdb_id as string) || '',
    (row.rating_tmdb as number | null) ?? null,
    (row.rating_imdb as number | null) ?? null,
    (row.ratings_fetched_at as string | null) ?? null,
  );
  row.rating_tmdb = scores.rating_tmdb;
  row.rating_imdb = scores.rating_imdb;

  const personal = await db.prepare('SELECT rating_personal FROM movies_personal WHERE tmdb_id = ?')
    .bind(row.tmdb_id as number).first<{ rating_personal: number }>();

  return rowToMovieDetail(row, personal?.rating_personal ?? null);
}

const SCORES_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function isScoresStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true;
  const fetchedMs = Date.parse(fetchedAt.replace(' ', 'T') + 'Z');
  if (Number.isNaN(fetchedMs)) return true;
  return Date.now() - fetchedMs > SCORES_STALE_MS;
}

/**
 * Refresca rating_tmdb / rating_imdb en la visita a la ficha si nunca se
 * pidieron o si pasaron más de 30 días — a diferencia del resto del detalle,
 * las notas de TMDB e IMDb siguen cambiando después del estreno.
 *
 * Un fetch que falla no borra el valor anterior (se queda con el que ya había
 * en la fila), y sin OMDB_API_KEY simplemente no toca rating_imdb.
 */
async function refreshMovieScoresIfStale(
  db: D1Database,
  tmdbId: number,
  imdbId: string,
  currentTmdb: number | null,
  currentImdb: number | null,
  ratingsFetchedAt: string | null,
): Promise<{ rating_tmdb: number | null; rating_imdb: number | null }> {
  if (!isScoresStale(ratingsFetchedAt)) {
    return { rating_tmdb: currentTmdb, rating_imdb: currentImdb };
  }

  const [tmdbScore, imdbScore] = await Promise.all([
    fetchTmdbScore(tmdbId),
    imdbId && env.OMDB_API_KEY ? fetchImdbRating(imdbId, env.OMDB_API_KEY) : Promise.resolve(null),
  ]);

  const nextTmdb = tmdbScore ?? currentTmdb;
  const nextImdb = imdbScore ?? currentImdb;

  try {
    await db.prepare(
      `UPDATE movies_cache SET rating_tmdb = ?, rating_imdb = ?, ratings_fetched_at = datetime('now') WHERE tmdb_id = ?`
    ).bind(nextTmdb, nextImdb, tmdbId).run();
  } catch (e) {
    console.error(`[movies] refreshMovieScoresIfStale ${tmdbId} failed:`, e);
  }

  return { rating_tmdb: nextTmdb, rating_imdb: nextImdb };
}

function rowToMovieDetail(row: Record<string, unknown>, ratingPersonal: number | null): MovieDetail {
  let cast: CastMember[] = [];
  let videos: Video[] = [];
  let images: MovieImages = { poster: [], fanart: [], thumb: [], banner: [], logo: [], clearart: [] };

  try { cast = JSON.parse((row.cast_json as string) || '[]'); } catch { /* */ }
  try { videos = JSON.parse((row.videos_json as string) || '[]'); } catch { /* */ }
  try { images = JSON.parse((row.images_json as string) || '{}'); } catch { /* */ }

  return {
    trakt_id: row.trakt_id as number,
    tmdb_id: row.tmdb_id as number,
    imdb_id: (row.imdb_id as string) || '',
    title: (row.title as string) || '',
    year: row.year as number,
    released: (row.released as string) || '',
    runtime: (row.runtime as number) || 0,
    genres: (row.genres as string) || '',
    overview: (row.overview as string) || '',
    rating: (row.rating as number) || 0,
    poster: (row.poster as string) || '',
    thumb: (row.thumb as string) || '',
    tagline: (row.tagline as string) || '',
    certification: (row.certification as string) || '',
    country: (row.country as string) || '',
    language: (row.language as string) || '',
    trailer: (row.trailer as string) || '',
    homepage: (row.homepage as string) || '',
    fanart: (row.fanart as string) || '',
    logo: (row.logo as string) || '',
    cast,
    videos,
    images,
    after_credits: !!(row.after_credits as number),
    during_credits: !!(row.during_credits as number),
    votes: (row.votes as number) || 0,
    rating_tmdb: (row.rating_tmdb as number | null) ?? null,
    rating_imdb: (row.rating_imdb as number | null) ?? null,
    rating_personal: ratingPersonal,
  };
}

/**
 * Fallback temporal: arma el detalle desde TMDB cuando Trakt no está disponible.
 * Escribe en las mismas columnas y marca data_source='tmdb' para poder
 * re-fetchear desde Trakt cuando la API vuelva a estar accesible.
 *
 * Los campos básicos (poster, thumb, overview, géneros, runtime, rating, released)
 * solo se rellenan si están vacíos: los que ya vinieron de Trakt se respetan.
 */
async function fetchMovieDetailFromTmdb(db: D1Database, traktId: number, tmdbId: number, imdbId: string): Promise<void> {
  const resolvedId = tmdbId || await resolveTmdbMovieIdByImdb(imdbId);
  if (!resolvedId) {
    console.error(`[movies] fallback TMDB: no se pudo resolver el id para trakt_id=${traktId}`);
    return;
  }

  const detail = await fetchTmdbMovieDetail(resolvedId);
  if (!detail) return;

  try {
    await db.prepare(`
      UPDATE movies_cache SET
        tmdb_id = ?, imdb_id = CASE WHEN imdb_id IS NULL OR imdb_id = '' THEN ? ELSE imdb_id END,
        tagline = ?, certification = ?, country = ?, language = ?,
        trailer = ?, homepage = ?, fanart = ?, logo = ?,
        cast_json = ?, videos_json = ?, images_json = ?, votes = ?,
        overview = CASE WHEN overview IS NULL OR overview = '' THEN ? ELSE overview END,
        genres  = CASE WHEN genres  IS NULL OR genres  = '' THEN ? ELSE genres  END,
        poster  = CASE WHEN poster  IS NULL OR poster  = '' THEN ? ELSE poster  END,
        thumb   = CASE WHEN thumb   IS NULL OR thumb   = '' THEN ? ELSE thumb   END,
        released = CASE WHEN released IS NULL OR released = '' THEN ? ELSE released END,
        runtime = CASE WHEN runtime IS NULL OR runtime = 0 THEN ? ELSE runtime END,
        rating  = CASE WHEN rating  IS NULL OR rating  = 0 THEN ? ELSE rating  END,
        data_source = ?, detail_fetched_at = datetime('now')
      WHERE trakt_id = ?
    `).bind(
      resolvedId, detail.imdb_id,
      detail.tagline, detail.certification, detail.country, detail.language,
      detail.trailer, detail.homepage, detail.fanart, detail.logo,
      JSON.stringify(detail.cast), JSON.stringify(detail.videos),
      JSON.stringify(detail.images), detail.votes,
      detail.overview, detail.genres, detail.poster, detail.thumb,
      detail.released, detail.runtime, detail.rating,
      TMDB_SOURCE, traktId,
    ).run();
  } catch (e) {
    console.error(`[movies] fallback TMDB: DB update for ${traktId} failed:`, e);
  }
}

async function fetchMovieDetail(db: D1Database, traktId: number, tmdbId: number, imdbId = ''): Promise<void> {
  // 1. Fetch full Trakt movie data
  const movie = await fetchTraktMovie(traktId);
  // Trakt caído (API de pago / 403) → fallback temporal a TMDB
  if (!movie) {
    await fetchMovieDetailFromTmdb(db, traktId, tmdbId, imdbId);
    return;
  }
  await sleep(300);

  // 2. Fetch cast
  const cast = await fetchTraktMoviePeople(movie.ids.slug);
  await sleep(300);

  // 3. Fetch TMDB videos
  const videos = await fetchTmdbVideos(tmdbId);

  // Extract images
  const images: MovieImages = {
    poster: (movie.images?.poster || []).map(traktImage),
    fanart: (movie.images?.fanart || []).map(traktImage),
    thumb: (movie.images?.thumb || []).map(traktImage),
    banner: (movie.images?.banner || []).map(traktImage),
    logo: (movie.images?.logo || []).map(traktImage),
    clearart: (movie.images?.clearart || []).map(traktImage),
  };

  const fanart = images.fanart[0] || '';
  const logo = images.logo[0] || '';

  // Extract trailer YouTube ID from URL
  let trailer = '';
  if (movie.trailer) {
    const match = movie.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    trailer = match?.[1] || '';
  }

  try {
    await db.prepare(`
      UPDATE movies_cache SET
        tagline = ?, certification = ?, country = ?, language = ?,
        trailer = ?, homepage = ?, fanart = ?, logo = ?,
        cast_json = ?, videos_json = ?, images_json = ?,
        after_credits = ?, during_credits = ?, votes = ?,
        data_source = 'trakt', detail_fetched_at = datetime('now')
      WHERE trakt_id = ?
    `).bind(
      movie.tagline || '', movie.certification || '', movie.country || '', movie.language || '',
      trailer, movie.homepage || '', fanart, logo,
      JSON.stringify(cast), JSON.stringify(videos), JSON.stringify(images),
      movie.after_credits ? 1 : 0, movie.during_credits ? 1 : 0, movie.votes || 0,
      traktId,
    ).run();
  } catch (e) {
    console.error(`[movies] fetchMovieDetail DB update for ${traktId} failed:`, e);
  }
}
