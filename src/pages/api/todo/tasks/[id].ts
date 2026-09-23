import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteTask, TodoServiceError, updateTask } from '../../../../services/todoService';
import { validateTaskPatch } from '../../../../utils/todo/validators';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const body = await request.json().catch(() => null);
  const validation = validateTaskPatch(body);
  if (!validation.ok) return json({ error: validation.error }, 400);

  try {
    const task = await updateTask(env.DB, id, validation.value);
    if (!task) return json({ error: 'Tarea no encontrada' }, 404);
    return json(task);
  } catch (e) {
    if (e instanceof TodoServiceError) return json({ error: e.message }, e.status);
    console.error('[api/todo/tasks/[id]] PATCH failed:', e);
    return json({ error: 'Error al actualizar la tarea' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const deleted = await deleteTask(env.DB, id);
  return json(deleted ? { ok: true } : { error: 'Tarea no encontrada' }, deleted ? 200 : 404);
};
