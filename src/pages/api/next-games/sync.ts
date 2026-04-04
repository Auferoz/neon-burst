import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { syncNextGames } from '../../../services/nextGamesSync';

export const prerender = false;

const CRON_SECRET = env.CRON_SECRET;

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('x-cron-secret');
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (authHeader !== CRON_SECRET && secret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await syncNextGames(env.DB);
    return new Response(JSON.stringify({
      message: 'Next games cache synced',
      ...result,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[api/next-games/sync] error:', e);
    return new Response(JSON.stringify({
      error: 'Sync failed',
      detail: e instanceof Error ? e.message : String(e),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
