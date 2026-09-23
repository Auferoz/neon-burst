import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isMangaAlreadyAdded } from '../../../services/mangaService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Solo D1: la previsualización de AniList la trae el navegador directamente
 * (AniList bloquea las IPs de Cloudflare Workers, ver anilist.ts). Esto
 * responde lo único que necesita el servidor: si ya está en la lista.
 */
export const GET: APIRoute = async ({ url }) => {
  const idParam = url.searchParams.get('id');
  const anilistId = Number(idParam);

  if (!idParam || !Number.isInteger(anilistId) || anilistId <= 0) {
    return json({ error: 'Id de AniList inválido' }, 400);
  }

  const already_added = await isMangaAlreadyAdded(env.DB, anilistId);
  return json({ already_added });
};
