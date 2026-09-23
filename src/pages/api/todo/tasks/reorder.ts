import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { reorderTask } from '../../../../services/todoService';
import { validateReorderBody } from '../../../../utils/todo/validators';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const validation = validateReorderBody(body);
  if (!validation.ok) return json({ error: validation.error }, 400);

  const ok = await reorderTask(env.DB, validation.value);
  return json(ok ? { ok: true } : { error: 'Tarea no encontrada' }, ok ? 200 : 404);
};
