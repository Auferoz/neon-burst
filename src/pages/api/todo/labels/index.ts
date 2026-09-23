import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createLabel } from '../../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { name?: unknown; color?: unknown } | null;
  if (!body || typeof body.name !== 'string' || body.name.trim() === '') {
    return json({ error: 'name es obligatorio' }, 400);
  }
  const color = typeof body.color === 'string' && body.color.trim() !== '' ? body.color : 'green';

  try {
    const label = await createLabel(env.DB, { name: body.name.trim(), color });
    return json(label, 201);
  } catch (e) {
    // UNIQUE(name COLLATE NOCASE) violation
    return json({ error: 'Ya existe una etiqueta con ese nombre' }, 409);
  }
};
