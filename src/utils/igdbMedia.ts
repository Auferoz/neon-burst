/**
 * Galería de un juego de IGDB (artworks, screenshots y videos).
 *
 * Módulo puro (sin `cloudflare:workers`) para que Vitest lo corra en Node.
 * Se guarda como JSON en `games.media_json`.
 */

export interface GameMedia {
  artworks: string[];
  screenshots: string[];
  videos: { id: string; name: string }[];
}

/** Forma cruda que devuelve IGDB para estos campos. */
export interface IgdbMediaRaw {
  artworks?: { image_id?: string }[];
  screenshots?: { image_id?: string }[];
  videos?: { video_id?: string; name?: string }[];
}

/** Quita la extensión que IGDB a veces incluye: `ar11k3.webp` → `ar11k3`. */
function cleanImageId(id: string | undefined): string {
  return id ? id.replace(/\.\w+$/, '') : '';
}

function mapImages(items: { image_id?: string }[] | undefined): string[] {
  const out: string[] = [];
  for (const item of items ?? []) {
    const id = cleanImageId(item?.image_id);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function mapIgdbMedia(raw: IgdbMediaRaw): GameMedia {
  const videos: GameMedia['videos'] = [];
  for (const v of raw.videos ?? []) {
    const id = v?.video_id ?? '';
    if (id && !videos.some((x) => x.id === id)) videos.push({ id, name: v.name ?? '' });
  }

  // Mismo criterio que pickTrailer: el que se llama "Trailer" va primero.
  // El resto conserva el orden de IGDB.
  const trailerIdx = videos.findIndex((v) => /trailer/i.test(v.name));
  if (trailerIdx > 0) videos.unshift(...videos.splice(trailerIdx, 1));

  return {
    artworks: mapImages(raw.artworks),
    screenshots: mapImages(raw.screenshots),
    videos,
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** Lee `media_json` sin tirar: JSON inválido o forma incorrecta → null. */
export function parseGameMedia(json: string | null | undefined): GameMedia | null {
  if (!json) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const { artworks, screenshots, videos } = data as Record<string, unknown>;
  if (!isStringArray(artworks) || !isStringArray(screenshots) || !Array.isArray(videos)) return null;

  const parsedVideos: GameMedia['videos'] = [];
  for (const v of videos) {
    if (!v || typeof v !== 'object') return null;
    const { id, name } = v as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    parsedVideos.push({ id, name });
  }

  return { artworks, screenshots, videos: parsedVideos };
}
