import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  renameList,
  deleteList,
  validateListName,
  isDuplicateListNameError,
  DUPLICATE_LIST_NAME_MESSAGE,
  RAFFLE_LIST_NAME_MAX,
} from '../../../../../services/steamRaffleService';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseId(params.id);
  if (id === null) return json({ error: 'Id de lista inválido' }, 400);

  const body = await request.json().catch(() => null);
  const name = validateListName(body?.name);
  if (!name) {
    return json({ error: `El nombre debe tener entre 1 y ${RAFFLE_LIST_NAME_MAX} caracteres` }, 400);
  }

  try {
    const list = await renameList(env.DB, id, name);
    if (!list) return json({ error: 'Lista no encontrada' }, 404);
    return json(list);
  } catch (e) {
    if (!isDuplicateListNameError(e)) throw e;
    return json({ error: DUPLICATE_LIST_NAME_MESSAGE }, 409);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  if (id === null) return json({ error: 'Id de lista inválido' }, 400);

  const deleted = await deleteList(env.DB, id);
  if (!deleted) return json({ error: 'Lista no encontrada' }, 404);
  return json({ success: true });
};
