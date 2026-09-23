import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { updateMangaEntry, deleteMangaEntry } from '../../../services/mangaService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const data = await request.json();
  const entry = await updateMangaEntry(env.DB, id, data);

  if (!entry) {
    return json({ error: 'Entry not found' }, 404);
  }

  return json(entry);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const deleted = await deleteMangaEntry(env.DB, id);

  if (!deleted) {
    return json({ error: 'Entry not found' }, 404);
  }

  return json({ success: true });
};
