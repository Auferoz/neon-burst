/**
 * Helpers puros para los scores de películas (TMDB, IMDb, personal), todos en
 * escala 0-100. Sin `import ... from 'cloudflare:workers'` a propósito: así
 * Vitest los puede importar en Node plano, sin el toolchain de Astro/Cloudflare.
 */

/**
 * `vote_average` de TMDB (0-10) → 0-100.
 * Una película sin votos todavía (`vote_count` 0) da `null`, no `0`: un `0` se
 * vería como "la peor película posible" en vez de "sin datos".
 */
export function tmdbToScore(voteAverage: number | undefined, voteCount: number | undefined): number | null {
  if (!voteCount) return null;
  return Math.round((voteAverage || 0) * 10);
}

export type RatingPersonalValidation =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Valida un score 0-100 (rating_personal, rating_tmdb o rating_imdb).
 * `null` es válido (borra el score); cualquier otra cosa tiene que ser un
 * entero entre 0 y 100. `fieldName` solo cambia el mensaje de error.
 */
export function validateRatingPersonal(value: unknown, fieldName = 'rating_personal'): RatingPersonalValidation {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: `${fieldName} debe ser un entero entre 0 y 100, o null` };
  }
  if (value < 0 || value > 100) {
    return { ok: false, error: `${fieldName} debe estar entre 0 y 100` };
  }
  return { ok: true, value };
}

export interface CurrentScores {
  rating_tmdb: number | null;
  rating_imdb: number | null;
  rating_tmdb_manual: boolean;
  rating_imdb_manual: boolean;
}

export interface FetchedScores {
  rating_tmdb: number | null;
  rating_imdb: number | null;
}

export interface MergedScores {
  rating_tmdb: number | null;
  rating_imdb: number | null;
}

/**
 * Decide qué valores persistir tras un fetch automático (30 días o backfill).
 * Un campo marcado `*_manual` nunca se pisa con lo que trae el fetch, sin
 * importar si el fetch trajo algo o no; un campo no manual se actualiza con
 * lo que trajo el fetch, o conserva el valor actual si el fetch no trajo nada
 * (`null`) — un proveedor caído no debe borrar un score que ya existía.
 */
export function mergeFetchedScores(current: CurrentScores, fetched: FetchedScores): MergedScores {
  return {
    rating_tmdb: current.rating_tmdb_manual ? current.rating_tmdb : (fetched.rating_tmdb ?? current.rating_tmdb),
    rating_imdb: current.rating_imdb_manual ? current.rating_imdb : (fetched.rating_imdb ?? current.rating_imdb),
  };
}

export interface ScoreUpdateBody {
  rating_personal?: number | null;
  rating_tmdb?: number | null;
  rating_imdb?: number | null;
}

export type ScoreUpdateValidation =
  | { ok: true; value: ScoreUpdateBody }
  | { ok: false; error: string };

const SCORE_FIELDS = ['rating_personal', 'rating_tmdb', 'rating_imdb'] as const;

/**
 * Valida el body de `PUT /api/movies/score/[tmdbId]` y `PUT /api/series/score/[slug]`.
 * Los tres campos son opcionales e independientes: una clave ausente del body
 * no se toca; `null` borra ese campo (y, para tmdb/imdb, apaga su flag
 * manual); un entero 0-100 lo guarda (y, para tmdb/imdb, prende su flag
 * manual). Así una request que solo manda `rating_personal` sigue
 * funcionando igual que antes de agregar tmdb/imdb.
 */
export function validateScoreUpdateBody(body: unknown): ScoreUpdateValidation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body inválido' };
  }

  const data = body as Record<string, unknown>;
  const value: ScoreUpdateBody = {};

  for (const field of SCORE_FIELDS) {
    if (!(field in data)) continue;
    const result = validateRatingPersonal(data[field], field);
    if (!result.ok) return result;
    value[field] = result.value;
  }

  return { ok: true, value };
}

export type MovieWatchedUpdateValidation =
  | { ok: true; value: { year_watched?: number; platform?: string } }
  | { ok: false; error: string };

/**
 * Valida el body de `PUT /api/movies/[id]` (por `watched_id`).
 * Solo `year_watched` y `platform` son editables; cualquier otro campo del
 * body se ignora en vez de rechazar la request (allowlist, no blocklist).
 * `year_watched` tiene que ser un entero de 4 dígitos; `platform` se recorta.
 */
export function validateMovieWatchedUpdate(body: unknown): MovieWatchedUpdateValidation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body inválido' };
  }

  const data = body as Record<string, unknown>;
  const value: { year_watched?: number; platform?: string } = {};

  if ('year_watched' in data) {
    const year = data.year_watched;
    if (typeof year !== 'number' || !Number.isInteger(year) || year < 1000 || year > 9999) {
      return { ok: false, error: 'year_watched debe ser un año de 4 dígitos' };
    }
    value.year_watched = year;
  }

  if ('platform' in data) {
    const platform = data.platform;
    if (typeof platform !== 'string') {
      return { ok: false, error: 'platform debe ser texto' };
    }
    value.platform = platform.trim();
  }

  return { ok: true, value };
}
