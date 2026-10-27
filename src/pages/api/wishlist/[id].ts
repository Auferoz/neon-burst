import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteWishlistItem } from '../../../services/wishlistService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** DELETE: quita una entrada; si era un destacado, también lo desmarca. Devuelve `{ igdb_id }` desmarcado o null. */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Id inválido' }, 400);

  const result = await deleteWishlistItem(env.DB, id);
  if (!result) return json({ error: 'No está en la lista' }, 404);
  return json(result);
};
