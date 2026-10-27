import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addManualToWishlist, listWishlist, WishlistDuplicateError } from '../../../services/wishlistService';
import { parseSteamAppQuery } from '../../../utils/wishlist';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** GET: la lista con el precio en vivo de Steam (sin caché: cambia al destacar). */
export const GET: APIRoute = async () => json(await listWishlist(env.DB));

/** POST: alta manual — body: { q: "<url de la tienda | appid>" } */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { q?: unknown } | null;
  const appid = typeof body?.q === 'string' ? parseSteamAppQuery(body.q) : null;
  if (!appid) return json({ error: 'Pega una URL de la tienda de Steam o un appid' }, 400);

  try {
    const item = await addManualToWishlist(env.DB, appid);
    if (!item) return json({ error: 'Steam no tiene ningún juego con ese appid' }, 404);
    return json(item, 201);
  } catch (e) {
    if (e instanceof WishlistDuplicateError) return json({ error: e.message }, 409);
    console.error('[api/wishlist] POST error:', e);
    return json({ error: 'No se pudo consultar la tienda de Steam' }, 502);
  }
};
