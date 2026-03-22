import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { updateSeriesEntry, deleteSeriesEntry } from '../../../services/seriesService';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const data = await request.json();
  const entry = await updateSeriesEntry(env.DB, id, data);

  if (!entry) {
    return new Response(JSON.stringify({ error: 'Entry not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(entry), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const deleted = await deleteSeriesEntry(env.DB, id);

  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Entry not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
