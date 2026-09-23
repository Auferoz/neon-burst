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
 * Valida el body de `PUT /api/movies/score/[tmdbId]`.
 * `null` es válido (borra el score); cualquier otra cosa tiene que ser un
 * entero entre 0 y 100.
 */
export function validateRatingPersonal(value: unknown): RatingPersonalValidation {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: 'rating_personal debe ser un entero entre 0 y 100, o null' };
  }
  if (value < 0 || value > 100) {
    return { ok: false, error: 'rating_personal debe estar entre 0 y 100' };
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
