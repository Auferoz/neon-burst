/**
 * IGDB single-game lookup — usado por el modal de "Agregar juego" para
 * autocompletar los campos a partir de una URL de IGDB, un slug o un ID.
 *
 * Devuelve los valores ya en el formato que guarda la tabla `games`:
 * - `poster` / `artworks` → image_id de IGDB (ej. `co26z5`), no URL
 * - `trailer` → ID de video de YouTube (ej. `s73I1DaHnqM`)
 * - `released` → DD/MM/YYYY
 */

import { env } from 'cloudflare:workers';

const IGDB_API_URL = 'https://api.igdb.com/v4';

export class IgdbRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'IgdbRequestError';
  }
}

export interface IgdbGameLookup {
  igdb_id: number;
  title: string;
  released: string;
  companie: string;
  console_pc: string;
  genre: string;
  poster: string;
  artworks: string;
  trailer: string;
  description: string;
}

interface IgdbGameRaw {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  genres?: { name: string }[];
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[];
  first_release_date?: number;
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  platforms?: { abbreviation?: string; name: string }[];
  videos?: { video_id: string; name?: string }[];
}

/** Token de aplicación de Twitch (client_credentials) para consultar IGDB. */
export async function getIgdbToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/**
 * Interpreta lo que pegó el usuario: URL de IGDB, slug suelto o ID numérico.
 * - https://www.igdb.com/games/bright-memory  → { slug: 'bright-memory' }
 * - bright-memory                             → { slug: 'bright-memory' }
 * - 103298                                    → { id: 103298 }
 */
export function parseIgdbQuery(input: string): { id?: number; slug?: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) return { id: Number(raw) };

  // URL de IGDB: nos quedamos con el segmento siguiente a /games/
  const urlMatch = raw.match(/igdb\.com\/games\/([^/?#\s]+)/i);
  if (urlMatch) return { slug: decodeURIComponent(urlMatch[1]!).toLowerCase() };

  // Cualquier otra URL no nos sirve
  if (/^https?:\/\//i.test(raw)) return null;

  // Slug suelto (o título que el usuario escribió con espacios)
  return { slug: raw.toLowerCase().replace(/\s+/g, '-') };
}

const IGDB_FIELDS = `
  fields name, slug, summary, storyline, genres.name,
    involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
    first_release_date, cover.image_id, artworks.image_id, screenshots.image_id,
    platforms.abbreviation, platforms.name,
    videos.video_id, videos.name;
`;

async function igdbQuery(token: string, body: string): Promise<IgdbGameRaw[]> {
  const res = await fetch(`${IGDB_API_URL}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[igdbGame] query failed: ${res.status} ${res.statusText} ${detail}`);
    throw new IgdbRequestError(res.status, `IGDB respondió ${res.status}`);
  }

  return await res.json() as IgdbGameRaw[];
}

/** Quita la extensión que IGDB a veces incluye: `co26z5.webp` → `co26z5`. */
function imageId(id: string | undefined): string {
  return id ? id.replace(/\.\w+$/, '') : '';
}

/** Unix seconds (UTC) → DD/MM/YYYY, el formato que usa la app. */
function formatReleased(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Prefiere un video llamado "Trailer"; si no hay, el primero disponible. */
function pickTrailer(videos: IgdbGameRaw['videos']): string {
  if (!videos?.length) return '';
  const trailer = videos.find((v) => /trailer/i.test(v.name || ''));
  return (trailer || videos[0])!.video_id || '';
}

function mapGame(g: IgdbGameRaw): IgdbGameLookup {
  const developer = g.involved_companies?.find((c) => c.developer)?.company?.name;
  const publisher = g.involved_companies?.find((c) => c.publisher)?.company?.name;

  return {
    igdb_id: g.id,
    title: g.name,
    released: formatReleased(g.first_release_date),
    companie: developer || publisher || '',
    console_pc: g.platforms?.map((p) => p.abbreviation || p.name).filter(Boolean).join(', ') || '',
    genre: g.genres?.map((gen) => gen.name).join(', ') || '',
    poster: imageId(g.cover?.image_id),
    artworks: imageId(g.artworks?.[0]?.image_id || g.screenshots?.[0]?.image_id),
    trailer: pickTrailer(g.videos),
    description: g.summary || g.storyline || '',
  };
}

/**
 * Busca un juego en IGDB por ID o slug y lo devuelve mapeado a los campos
 * de la tabla `games`. Devuelve null si IGDB responde pero no encuentra nada.
 * Lanza IgdbRequestError si no se pudo consultar la API.
 */
export async function lookupIgdbGame(query: { id?: number; slug?: string }): Promise<IgdbGameLookup | null> {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new IgdbRequestError(500, 'Faltan TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET');
  }

  const token = await getIgdbToken().catch(() => null);
  if (!token) throw new IgdbRequestError(502, 'No se pudo obtener el token de Twitch/IGDB');

  if (query.id) {
    const [game] = await igdbQuery(token, `${IGDB_FIELDS} where id = ${query.id}; limit 1;`);
    return game ? mapGame(game) : null;
  }

  const slug = query.slug!.replace(/"/g, '');

  // 1. Coincidencia exacta por slug
  const [exact] = await igdbQuery(token, `${IGDB_FIELDS} where slug = "${slug}"; limit 1;`);
  if (exact) return mapGame(exact);

  // 2. Fallback: búsqueda por nombre (el usuario pudo pegar un título)
  const results = await igdbQuery(token, `search "${slug.replace(/-/g, ' ')}"; ${IGDB_FIELDS} limit 1;`);
  return results[0] ? mapGame(results[0]) : null;
}
