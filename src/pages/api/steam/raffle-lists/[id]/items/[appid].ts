import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { removeItem, listExists } from '../../../../../../services/steamRaffleService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const DELETE: APIRoute = async ({ params }) => {
  const listId = Number(params.id);
  const appid = Number(params.appid);
  if (!Number.isInteger(listId) || listId <= 0) return json({ error: 'Id de lista inválido' }, 400);
  if (!Number.isInteger(appid) || appid <= 0) return json({ error: 'appid inválido' }, 400);

  if (!(await listExists(env.DB, listId))) return json({ error: 'Lista no encontrada' }, 404);

  await removeItem(env.DB, listId, appid);
  return json({ success: true });
};
