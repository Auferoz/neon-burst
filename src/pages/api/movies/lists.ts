import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM movies_lists ORDER BY slug DESC'
  ).all();

  return new Response(JSON.stringify(results || []), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
