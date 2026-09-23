import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAllManga, createMangaEntry } from '../../../services/mangaService';
import { validateAnilistMediaPayload } from '../../../services/anilist';

export const prerender = false;

const json = (body: unknown, status = 200, cache?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(cache ? { 'Cache-Control': cache } : {}),
    },
  });

export const GET: APIRoute = async () => {
  const manga = await getAllManga(env.DB);
  return json(manga, 200, 'public, max-age=300');
};

/**
 * El navegador ya resolvió `query` a un id y ya trajo el `media` completo
 * desde AniList (el servidor no puede: AniList bloquea las IPs de Cloudflare
 * Workers, ver anilist.ts). Acá solo se valida y persiste.
 */
export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null) as {
    anilist_id?: number;
    media?: unknown;
    estado?: string;
    capitulo_actual?: number;
    platform?: string;
    fecha_inicio?: string;
    fecha_final?: string;
    rating_personal?: number | null;
  } | null;

  const anilistId = Number(data?.anilist_id);
  if (!data || !Number.isInteger(anilistId) || anilistId <= 0) {
    return json({ error: 'Id de AniList inválido' }, 400);
  }

  const validation = validateAnilistMediaPayload(data.media, anilistId);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  try {
    const entry = await createMangaEntry(env.DB, {
      anilist_id: anilistId,
      media: validation.media,
      estado: data.estado || 'Leyendo',
      capitulo_actual: Number(data.capitulo_actual) || 0,
      platform: data.platform || '',
      fecha_inicio: data.fecha_inicio || '',
      fecha_final: data.fecha_final || '',
      rating_personal: data.rating_personal ?? null,
    });
    return json(entry, 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) {
      return json({ error: 'Ya agregaste este manga' }, 409);
    }
    console.error('[api/manga] POST failed:', e);
    return json({ error: 'Error al crear la entrada' }, 500);
  }
};
