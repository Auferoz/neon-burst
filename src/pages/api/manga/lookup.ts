import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupManga, AnilistRequestError } from '../../../services/mangaService';
import { parseAnilistQuery } from '../../../services/anilist';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Resuelve una URL o id de AniList a una previsualización, sin guardar nada.
 * Mismo flujo que /api/movies/lookup: buscar → previsualizar → confirmar.
 */
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') || '';

  const anilistId = parseAnilistQuery(q);
  if (!anilistId) {
    return json({ error: 'Pegá la URL o el id de AniList' }, 400);
  }

  try {
    const preview = await lookupManga(env.DB, anilistId);
    return json(preview);
  } catch (e) {
    if (e instanceof AnilistRequestError) {
      return json({ error: e.message }, e.status === 404 ? 404 : 502);
    }
    console.error('[api/manga/lookup] failed:', e);
    return json({ error: 'Error al consultar AniList' }, 500);
  }
};
