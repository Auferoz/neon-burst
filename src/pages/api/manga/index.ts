import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAllManga, createMangaEntry, AnilistRequestError } from '../../../services/mangaService';
import { parseAnilistQuery } from '../../../services/anilist';

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

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json() as {
    query?: string;
    estado?: string;
    capitulo_actual?: number;
    platform?: string;
    fecha_inicio?: string;
    fecha_final?: string;
    rating_personal?: number | null;
  };

  const anilistId = parseAnilistQuery(data.query || '');
  if (!anilistId) {
    return json({ error: 'Pegá la URL o el id de AniList' }, 400);
  }

  try {
    const entry = await createMangaEntry(env.DB, {
      anilist_id: anilistId,
      estado: data.estado || 'Leyendo',
      capitulo_actual: Number(data.capitulo_actual) || 0,
      platform: data.platform || '',
      fecha_inicio: data.fecha_inicio || '',
      fecha_final: data.fecha_final || '',
      rating_personal: data.rating_personal ?? null,
    });
    return json(entry, 201);
  } catch (e) {
    if (e instanceof AnilistRequestError) {
      return json({ error: e.message }, e.status === 404 ? 404 : 502);
    }
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) {
      return json({ error: 'Ya agregaste este manga' }, 409);
    }
    console.error('[api/manga] POST failed:', e);
    return json({ error: 'Error al crear la entrada' }, 500);
  }
};
