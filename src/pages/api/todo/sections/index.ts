import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSection } from '../../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { project_id?: unknown; name?: unknown; sort_order?: unknown } | null;
  if (!body || !Number.isInteger(body.project_id)) return json({ error: 'project_id es obligatorio' }, 400);
  if (typeof body.name !== 'string' || body.name.trim() === '') return json({ error: 'name es obligatorio' }, 400);

  const section = await createSection(env.DB, {
    project_id: body.project_id as number,
    name: body.name.trim(),
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
  });
  return json(section, 201);
};
