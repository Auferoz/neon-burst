import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAllGames, createGame, isDuplicateTitleError, DUPLICATE_TITLE_MESSAGE } from '../../../services/gamesService';

export const prerender = false;

export const GET: APIRoute = async () => {
  const games = await getAllGames(env.DB);
  return new Response(JSON.stringify(games), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  try {
    const game = await createGame(env.DB, data);
    return new Response(JSON.stringify(game), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (!isDuplicateTitleError(e)) throw e;
    return new Response(JSON.stringify({ error: DUPLICATE_TITLE_MESSAGE }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
