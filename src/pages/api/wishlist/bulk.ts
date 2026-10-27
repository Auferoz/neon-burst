import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addManyToWishlist, WISHLIST_BULK_MAX } from '../../../services/wishlistService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

interface BulkGame {
  steam_appid: number;
  name: string;
  image: string;
  release_label: string;
}

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value.trim() : null;
}

/** Valida una fila que viene del navegador; null si no sirve. */
function validate(raw: unknown): BulkGame | null {
  const g = raw as Record<string, unknown> | null;
  const appid = Number(g?.steam_appid);
  const name = str(g?.name, 200);
  const image = str(g?.image ?? '', 500);
  const release = str(g?.release_label ?? '', 60);
  if (!Number.isInteger(appid) || appid <= 0 || !name || image === null || release === null) return null;
  if (image && !image.startsWith('https://')) return null;
  return { steam_appid: appid, name, image, release_label: release };
}

/** POST { games: [{ steam_appid, name, image?, release_label? }] } — ya resueltos con /api/wishlist/lookup. */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { games?: unknown } | null;
  if (!Array.isArray(body?.games) || body.games.length === 0) return json({ error: 'No hay juegos para agregar' }, 400);
  if (body.games.length > WISHLIST_BULK_MAX) return json({ error: `Máximo ${WISHLIST_BULK_MAX} juegos por vez` }, 400);

  const games = body.games.map(validate);
  if (games.some(g => g === null)) return json({ error: 'Hay juegos con datos inválidos' }, 400);

  const { added, skipped } = await addManyToWishlist(env.DB, games as BulkGame[]);
  const message = skipped > 0
    ? `${added} agregados, ${skipped} ya estaban en la lista`
    : `${added} agregados a la lista`;
  return json({ added, skipped, message });
};
