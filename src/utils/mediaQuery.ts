/**
 * Parseo de lo que el usuario escribe para identificar una película o serie.
 *
 * Mientras la API de Trakt no esté disponible, un slug de Trakt se resuelve
 * buscando en TMDB por título + año. Eso acierta en ~99% de los casos, pero no
 * puede desambiguar dos títulos idénticos del mismo año, así que también se
 * acepta el id de TMDB directo como salida de emergencia.
 */

/** Qué escribió el usuario, ya normalizado. */
export type MediaQuery =
  | { kind: 'tmdb'; id: number }
  | { kind: 'slug'; slug: string };

/**
 * Convierte un slug de Trakt en término de búsqueda + año.
 * "my-hero-academia" → { query: "my hero academia" }
 * "the-office-2005"  → { query: "the office", year: 2005 }
 */
export function slugToQuery(slug: string): { query: string; year?: number } {
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

/**
 * Acepta, en este orden:
 *   - URL de TMDB          https://www.themoviedb.org/movie/693134-dune-part-two
 *   - id numérico de TMDB   693134
 *   - URL de Trakt          https://app.trakt.tv/movies/dune-part-two-2024
 *   - slug pelado           dune-part-two-2024
 *
 * Devuelve null si la entrada está vacía o no tiene forma de ninguna de las cuatro.
 */
export function parseMediaQuery(input: string): MediaQuery | null {
  const raw = input.trim();
  if (!raw) return null;

  // URL de TMDB: /movie/693134-slug o /tv/1399
  const tmdbUrl = raw.match(/themoviedb\.org\/(?:movie|tv)\/(\d+)/i);
  if (tmdbUrl) return { kind: 'tmdb', id: Number(tmdbUrl[1]) };

  // id de TMDB pelado
  if (/^\d+$/.test(raw)) return { kind: 'tmdb', id: Number(raw) };

  // URL de Trakt: /movies/<slug> o /shows/<slug>
  const traktUrl = raw.match(/trakt\.tv\/(?:movies|shows)\/([a-z0-9-]+)/i);
  if (traktUrl) return { kind: 'slug', slug: traktUrl[1].toLowerCase() };

  // Slug pelado: minúsculas, números y guiones
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(raw)) {
    return { kind: 'slug', slug: raw.toLowerCase() };
  }

  return null;
}
