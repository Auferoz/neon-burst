/**
 * Series sync — fetches show metadata from Trakt API
 * and caches them in D1 (series_cache table).
 *
 * Unlike movies, the watched list is managed manually by the user.
 * This service only syncs show metadata for slugs present in series_watched.
 */

import { env } from 'cloudflare:workers';
import { fetchTmdbShowBySlug, TMDB_SOURCE } from './tmdbSeries';

const TRAKT_API_URL = 'https://api.trakt.tv';

function getTraktHeaders() {
  return {
    'Content-Type': 'application/json',
    'trakt-api-key': env.TRAKT_CLIENT_ID,
    'trakt-api-version': '2',
    'User-Agent': 'neon-burst/1.0',
  };
}

interface TraktShow {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  overview: string;
  runtime: number;
  rating: number;
  genres: string[];
  network: string;
  status: string;
  images?: { poster?: string[]; fanart?: string[]; thumb?: string[] };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

async function fetchShowInfo(slug: string): Promise<TraktShow | null> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[series] fetchShowInfo ${slug} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as TraktShow;
  } catch (e) {
    console.error(`[series] fetchShowInfo ${slug} error:`, e);
    return null;
  }
}

export class TraktRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'TraktRequestError';
  }
}

/** Upsert de los datos básicos en series_cache (misma forma venga de Trakt o de TMDB). */
async function upsertShowBasic(db: D1Database, slug: string, row: {
  trakt_id: number | null; tmdb_id: number | null; imdb_id: string;
  title: string; year: number | null; overview: string; rating: number;
  genres: string; network: string; status: string; runtime: number;
  poster: string; thumb: string; data_source: string;
}): Promise<void> {
  await db.prepare(
    `INSERT INTO series_cache
      (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, thumb, data_source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(trakt_slug) DO UPDATE SET
      trakt_id=excluded.trakt_id, tmdb_id=excluded.tmdb_id, imdb_id=excluded.imdb_id,
      title=excluded.title, year=excluded.year, overview=excluded.overview,
      rating=excluded.rating, genres=excluded.genres, network=excluded.network,
      status=excluded.status, runtime=excluded.runtime, poster=excluded.poster,
      thumb=excluded.thumb, data_source=excluded.data_source, updated_at=excluded.updated_at`
  ).bind(
    slug, row.trakt_id, row.tmdb_id, row.imdb_id,
    row.title, row.year, row.overview, row.rating,
    row.genres, row.network, row.status, row.runtime,
    row.poster, row.thumb, row.data_source,
  ).run();
}

/**
 * Fetch and cache a single show by slug.
 * Called when user adds a new series entry and it's not cached yet.
 *
 * Trakt es la fuente primaria. Si Trakt falla (403 por API de pago, 429, red),
 * cae a TMDB como fallback temporal y marca la fila con data_source='tmdb'.
 * Solo lanza TraktRequestError si además TMDB falla, para poder reportar la causa real.
 */
export async function syncSingleShow(db: D1Database, slug: string): Promise<boolean> {
  const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
    headers: getTraktHeaders(),
  }).catch(() => null);

  // Trakt OK → fuente primaria
  if (res?.ok) {
    const show = await res.json() as TraktShow;
    await upsertShowBasic(db, slug, {
      trakt_id: show.ids.trakt,
      tmdb_id: show.ids.tmdb || null,
      imdb_id: show.ids.imdb || '',
      title: show.title,
      year: show.year || null,
      overview: show.overview || '',
      rating: Math.round((show.rating || 0) * 10) / 10,
      genres: show.genres?.join(', ') || '',
      network: show.network || '',
      status: show.status || '',
      runtime: show.runtime || 0,
      poster: traktImage(show.images?.poster?.[0]),
      thumb: traktImage(show.images?.fanart?.[0] || show.images?.thumb?.[0]),
      data_source: 'trakt',
    });
    return true;
  }

  // Trakt no disponible (o serie inexistente) → fallback a TMDB
  const status = res?.status ?? 0;
  console.warn(`[series] Trakt no disponible para ${slug} (${status || 'sin respuesta'}), usando fallback TMDB`);

  const tmdb = await fetchTmdbShowBySlug(slug);

  if (tmdb.show) {
    await upsertShowBasic(db, slug, {
      trakt_id: null,
      tmdb_id: tmdb.show.tmdb_id,
      imdb_id: tmdb.show.imdb_id,
      title: tmdb.show.title,
      year: tmdb.show.year,
      overview: tmdb.show.overview,
      rating: tmdb.show.rating,
      genres: tmdb.show.genres,
      network: tmdb.show.network,
      status: tmdb.show.status,
      runtime: tmdb.show.runtime,
      poster: tmdb.show.poster,
      thumb: tmdb.show.thumb,
      data_source: TMDB_SOURCE,
    });
    return true;
  }

  // TMDB respondió y no existe la serie → slug inválido (404 para el cliente)
  if (tmdb.available && !tmdb.found) return false;
  if (status === 404) return false;

  // Ninguna de las dos APIs se pudo consultar
  const detail = status === 403
    ? 'Trakt no está disponible (403) y tampoco se pudo consultar TMDB. Revisa TMDB_API_KEY.'
    : status === 429
      ? 'Trakt está limitando las peticiones (429) y tampoco se pudo consultar TMDB.'
      : status
        ? `Error de la API de Trakt (${status}) y tampoco se pudo consultar TMDB.`
        : 'No se pudo conectar con Trakt ni con TMDB';
  throw new TraktRequestError(status, detail);
}

/**
 * Cron sync — syncs metadata for shows watched in current year or with ongoing status.
 */
export async function syncSeries(db: D1Database): Promise<{ synced: number; errors: number }> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS series_cache (
      trakt_slug TEXT PRIMARY KEY, trakt_id INTEGER, tmdb_id INTEGER, imdb_id TEXT,
      title TEXT NOT NULL, year INTEGER, overview TEXT, rating REAL DEFAULT 0,
      genres TEXT, network TEXT, status TEXT, runtime INTEGER DEFAULT 0,
      poster TEXT, thumb TEXT, updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS series_watched (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trakt_slug TEXT NOT NULL,
      season_number INTEGER NOT NULL, year_watched INTEGER NOT NULL,
      platform TEXT, status_viewed TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(trakt_slug, season_number)
    )
  `).run();

  const currentYear = new Date().getFullYear();

  // Get unique slugs for current year or ongoing series
  const { results: rows } = await db.prepare(
    `SELECT DISTINCT trakt_slug FROM series_watched
     WHERE year_watched = ? OR status_viewed = 'ongoing'`
  ).bind(currentYear).all<{ trakt_slug: string }>();

  if (!rows.length) return { synced: 0, errors: 0 };

  let synced = 0, errors = 0;

  for (const row of rows) {
    const show = await fetchShowInfo(row.trakt_slug);
    await sleep(300);

    if (!show) { errors++; continue; }

    const poster = traktImage(show.images?.poster?.[0]);
    const thumb = traktImage(show.images?.fanart?.[0] || show.images?.thumb?.[0]);

    try {
      await db.prepare(
        `INSERT INTO series_cache
          (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, thumb, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(trakt_slug) DO UPDATE SET
          trakt_id=excluded.trakt_id, tmdb_id=excluded.tmdb_id, imdb_id=excluded.imdb_id,
          title=excluded.title, year=excluded.year, overview=excluded.overview,
          rating=excluded.rating, genres=excluded.genres, network=excluded.network,
          status=excluded.status, runtime=excluded.runtime, poster=excluded.poster,
          thumb=excluded.thumb, updated_at=excluded.updated_at`
      ).bind(
        row.trakt_slug, show.ids.trakt, show.ids.tmdb || null, show.ids.imdb || '',
        show.title, show.year || null, show.overview || '',
        Math.round((show.rating || 0) * 10) / 10,
        show.genres?.join(', ') || '', show.network || '', show.status || '',
        show.runtime || 0, poster, thumb,
      ).run();
      synced++;
    } catch { errors++; }
  }

  return { synced, errors };
}
