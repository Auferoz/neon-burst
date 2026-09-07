import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  getLibraryGameById,
  updateLibraryGame,
  deleteLibraryGame,
} from '../../../services/libraryService';
import { isStore } from '../../../data/stores';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  if (id === null) return json({ error: 'ID inválido' }, 400);

  const game = await getLibraryGameById(env.DB, id);
  if (!game) return json({ error: 'Juego no encontrado' }, 404);
  return json(game);
};

export const PUT: APIRoute = async ({ params, request }) => {
  const id = parseId(params.id);
  if (id === null) return json({ error: 'ID inválido' }, 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body JSON inválido' }, 400);
  }

  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
    return json({ error: 'El campo "title" no puede quedar vacío' }, 400);
  }
  if (body.store !== undefined && !isStore(body.store)) {
    return json({ error: `Tienda desconocida: "${String(body.store)}"` }, 400);
  }

  const existing = await getLibraryGameById(env.DB, id);
  if (!existing) return json({ error: 'Juego no encontrado' }, 404);

  try {
    const updated = await updateLibraryGame(env.DB, id, body as any);
    return json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('UNIQUE')) {
      return json({ error: 'Ya existe ese título para esa tienda' }, 409);
    }
    console.error('[api/library/[id]] PUT error:', e);
    return json({ error: 'No se pudo actualizar', detail: message }, 500);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseId(params.id);
  if (id === null) return json({ error: 'ID inválido' }, 400);

  const deleted = await deleteLibraryGame(env.DB, id);
  if (!deleted) return json({ error: 'Juego no encontrado' }, 404);
  return json({ success: true });
};
