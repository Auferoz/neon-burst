import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { syncSteamLibrary } from '../../../services/steamSync';

export const prerender = false;

const CRON_SECRET = 'neon-burst-cron-2026';

export const GET: APIRoute = async ({ request }) => {
  // Allow internal cron calls or manual calls with secret
  const authHeader = request.headers.get('x-cron-secret');
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (authHeader !== CRON_SECRET && secret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await syncSteamLibrary(env.DB);

  return new Response(JSON.stringify({
    message: 'Steam library synced',
    ...result,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
