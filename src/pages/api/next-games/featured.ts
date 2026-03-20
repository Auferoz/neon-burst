import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

/** GET: returns array of featured IGDB IDs */
export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare(
    'SELECT igdb_id FROM next_games_featured'
  ).all<{ igdb_id: number }>();

  const ids = (results || []).map((r) => r.igdb_id);

  return new Response(JSON.stringify(ids), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** POST: toggle featured — body: { igdb_id: number } */
export const POST: APIRoute = async ({ request }) => {
  const { igdb_id } = await request.json() as { igdb_id: number };

  if (!igdb_id || typeof igdb_id !== 'number') {
    return new Response(JSON.stringify({ error: 'igdb_id requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if already featured
  const existing = await env.DB.prepare(
    'SELECT igdb_id FROM next_games_featured WHERE igdb_id = ?'
  ).bind(igdb_id).first<{ igdb_id: number }>();

  if (existing) {
    await env.DB.prepare('DELETE FROM next_games_featured WHERE igdb_id = ?')
      .bind(igdb_id).run();
    return new Response(JSON.stringify({ featured: false, igdb_id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare('INSERT INTO next_games_featured (igdb_id) VALUES (?)')
    .bind(igdb_id).run();

  return new Response(JSON.stringify({ featured: true, igdb_id }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
