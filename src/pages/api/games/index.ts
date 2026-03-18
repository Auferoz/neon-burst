import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAllGames, createGame } from '../../../services/gamesService';

export const prerender = false;

export const GET: APIRoute = async () => {
  const games = await getAllGames(env.DB);
  return new Response(JSON.stringify(games), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  const game = await createGame(env.DB, data);
  return new Response(JSON.stringify(game), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
