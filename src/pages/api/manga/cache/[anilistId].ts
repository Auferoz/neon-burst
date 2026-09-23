import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { refreshMangaCache } from '../../../../services/mangaService';
import { validateAnilistMediaPayload } from '../../../../services/anilist';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Refresco client-driven del detalle en manga_cache. El navegador consulta
 * AniList directamente (el servidor no puede, ver anilist.ts) y sube acá el
 * resultado para persistirlo — llamado por MangaRefresher.vue.
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const anilistId = Number(params.anilistId);
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return json({ error: 'Id de AniList inválido' }, 400);
  }

  const data = await request.json().catch(() => null) as { media?: unknown } | null;
  const validation = validateAnilistMediaPayload(data?.media, anilistId);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  try {
    await refreshMangaCache(env.DB, validation.media);
    return json({ success: true });
  } catch (e) {
    console.error('[api/manga/cache] PUT failed:', e);
    return json({ error: 'Error al actualizar el caché' }, 500);
  }
};
