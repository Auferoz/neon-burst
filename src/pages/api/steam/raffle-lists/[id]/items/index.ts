import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addItem, listExists, steamGameExists } from '../../../../../../services/steamRaffleService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return json({ error: 'Id de lista inválido' }, 400);

  const body = await request.json().catch(() => null);
  const appid = Number(body?.appid);
  if (!Number.isInteger(appid) || appid <= 0) return json({ error: 'appid inválido' }, 400);

  if (!(await listExists(env.DB, listId))) return json({ error: 'Lista no encontrada' }, 404);
  if (!(await steamGameExists(env.DB, appid))) return json({ error: 'Ese juego no está en tu biblioteca' }, 404);

  await addItem(env.DB, listId, appid);
  return json({ success: true }, 201);
};
