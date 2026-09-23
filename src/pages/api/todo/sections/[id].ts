import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteSection, updateSection } from '../../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const body = await request.json().catch(() => null) as { name?: unknown; sort_order?: unknown; project_id?: unknown } | null;
  if (!body) return json({ error: 'Cuerpo inválido' }, 400);

  const data: Partial<{ name: string; sort_order: number; project_id: number }> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') return json({ error: 'name inválido' }, 400);
    data.name = body.name.trim();
  }
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== 'number') return json({ error: 'sort_order inválido' }, 400);
    data.sort_order = body.sort_order;
  }
  if (body.project_id !== undefined) {
    if (!Number.isInteger(body.project_id)) return json({ error: 'project_id inválido' }, 400);
    data.project_id = body.project_id as number;
  }

  const section = await updateSection(env.DB, id, data);
  if (!section) return json({ error: 'Sección no encontrada' }, 404);
  return json(section);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const deleted = await deleteSection(env.DB, id);
  return json(deleted ? { ok: true } : { error: 'Sección no encontrada' }, deleted ? 200 : 404);
};
