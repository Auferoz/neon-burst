import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { lookupSteamApp } from '../../../services/wishlistService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** GET ?q=<título | URL de la tienda | appid> → un juego de Steam con precio y `already_added`, sin guardar. */
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 200) return json({ error: 'Búsqueda vacía o demasiado larga' }, 400);

  try {
    const app = await lookupSteamApp(env.DB, q);
    if (!app) return json({ error: 'Sin resultados en Steam' }, 404);
    return json(app);
  } catch (e) {
    console.error('[api/wishlist/lookup] error:', e);
    return json({ error: 'No se pudo consultar la tienda de Steam' }, 502);
  }
};
