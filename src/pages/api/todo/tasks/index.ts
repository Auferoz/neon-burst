import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createTask, TodoServiceError } from '../../../../services/todoService';
import { validateTaskCreate } from '../../../../utils/todo/validators';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const validation = validateTaskCreate(body);
  if (!validation.ok) return json({ error: validation.error }, 400);

  try {
    const task = await createTask(env.DB, validation.value);
    return json(task, 201);
  } catch (e) {
    if (e instanceof TodoServiceError) return json({ error: e.message }, e.status);
    console.error('[api/todo/tasks] POST failed:', e);
    return json({ error: 'Error al crear la tarea' }, 500);
  }
};
