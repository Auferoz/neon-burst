import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteLabel, updateLabel } from '../../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const body = await request.json().catch(() => null) as { name?: unknown; color?: unknown } | null;
  if (!body) return json({ error: 'Cuerpo inválido' }, 400);

  const data: Partial<{ name: string; color: string }> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') return json({ error: 'name inválido' }, 400);
    data.name = body.name.trim();
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string') return json({ error: 'color inválido' }, 400);
    data.color = body.color;
  }

  try {
    const label = await updateLabel(env.DB, id, data);
    if (!label) return json({ error: 'Etiqueta no encontrada' }, 404);
    return json(label);
  } catch {
    return json({ error: 'Ya existe una etiqueta con ese nombre' }, 409);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const deleted = await deleteLabel(env.DB, id);
  return json(deleted ? { ok: true } : { error: 'Etiqueta no encontrada' }, deleted ? 200 : 404);
};
