import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteProject, TodoServiceError, updateProject } from '../../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const body = await request.json().catch(() => null) as
    | { name?: unknown; color?: unknown; sort_order?: unknown; archived?: unknown }
    | null;
  if (!body) return json({ error: 'Cuerpo inválido' }, 400);

  const data: Partial<{ name: string; color: string; sort_order: number; archived: 0 | 1 }> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') return json({ error: 'name inválido' }, 400);
    data.name = body.name.trim();
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string') return json({ error: 'color inválido' }, 400);
    data.color = body.color;
  }
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== 'number') return json({ error: 'sort_order inválido' }, 400);
    data.sort_order = body.sort_order;
  }
  if (body.archived !== undefined) {
    if (body.archived !== 0 && body.archived !== 1) return json({ error: 'archived inválido' }, 400);
    data.archived = body.archived;
  }

  try {
    const project = await updateProject(env.DB, id, data);
    if (!project) return json({ error: 'Proyecto no encontrado' }, 404);
    return json(project);
  } catch (e) {
    if (e instanceof TodoServiceError) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  try {
    const deleted = await deleteProject(env.DB, id);
    return json(deleted ? { ok: true } : { error: 'Proyecto no encontrado' }, deleted ? 200 : 404);
  } catch (e) {
    if (e instanceof TodoServiceError) return json({ error: e.message }, e.status);
    throw e;
  }
};
