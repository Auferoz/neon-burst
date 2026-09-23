/**
 * Proveedor OMDb — fuente de `rating_imdb`, buscando por `imdb_id` (que ya
 * guarda `movies_cache`). Free tier: 1000 requests/día.
 */

const OMDB_BASE = 'https://www.omdbapi.com/';

interface OmdbResponse {
  imdbRating?: string;
  Response: 'True' | 'False';
}

/**
 * "7.8" → 78; "10.0" → 100; "N/A" o vacío → null.
 * Pura y sin red: así se puede testear el parseo sin llamar a la API.
 */
export function parseImdbRating(raw: string | undefined | null): number | null {
  if (!raw || raw === 'N/A') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10);
}

/**
 * Rating de IMDb (0-100) para un `imdb_id`, o `null` si no hay `imdb_id`, no
 * hay API key, o la API falla. Nunca lanza: quien llama decide qué hacer con
 * un `null` (en general, no bloquear el alta/refresh y dejar el valor previo).
 */
export async function fetchImdbRating(imdbId: string, apiKey: string): Promise<number | null> {
  if (!imdbId || !apiKey) return null;
  try {
    const res = await fetch(`${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${apiKey}`);
    if (!res.ok) {
      console.error(`[omdb] ${imdbId} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json() as OmdbResponse;
    if (data.Response === 'False') return null;
    return parseImdbRating(data.imdbRating);
  } catch (e) {
    console.error(`[omdb] ${imdbId} error:`, e);
    return null;
  }
}
