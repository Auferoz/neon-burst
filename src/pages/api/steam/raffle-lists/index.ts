import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  getRaffleLists,
  createList,
  addItems,
  getListById,
  validateListName,
  isDuplicateListNameError,
  DUPLICATE_LIST_NAME_MESSAGE,
  RAFFLE_LIST_NAME_MAX,
} from '../../../../services/steamRaffleService';
import { sanitizeAppidList } from '../../../../utils/steamRaffle';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const GET: APIRoute = async () => {
  return json(await getRaffleLists(env.DB));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const name = validateListName(body?.name);
  if (!name) {
    return json({ error: `El nombre debe tener entre 1 y ${RAFFLE_LIST_NAME_MAX} caracteres` }, 400);
  }

  // Optional: create the list already filled (e.g. "save the current pool").
  let appids: number[] | null = null;
  if (body?.appids !== undefined) {
    appids = sanitizeAppidList(body.appids);
    if (!appids) return json({ error: 'Lista de juegos inválida' }, 400);
  }

  try {
    const created = await createList(env.DB, name);
    if (!appids) return json(created, 201);
    await addItems(env.DB, created.id, appids);
    return json((await getListById(env.DB, created.id)) ?? created, 201);
  } catch (e) {
    if (!isDuplicateListNameError(e)) throw e;
    return json({ error: DUPLICATE_LIST_NAME_MESSAGE }, 409);
  }
};
