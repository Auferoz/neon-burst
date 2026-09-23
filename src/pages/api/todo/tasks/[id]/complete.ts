import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { completeTask } from '../../../../../services/todoService';
import { validateCompleteBody } from '../../../../../utils/todo/validators';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'id inválido' }, 400);

  const body = await request.json().catch(() => null);
  const validation = validateCompleteBody(body);
  if (!validation.ok) return json({ error: validation.error }, 400);

  const result = await completeTask(env.DB, id, validation.value);
  if (!result) return json({ error: 'Tarea no encontrada' }, 404);

  return json(result);
};
