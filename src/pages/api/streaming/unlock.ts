import type { APIRoute } from 'astro';
import {
  SESSION_COOKIE,
  checkThrottle,
  clearFailures,
  createSessionToken,
  isValidPinFormat,
  registerFailure,
  sessionCookieOptions,
  verifyPin,
} from '../../../services/streamingAuth';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  let pin: unknown;
  try {
    ({ pin } = await request.json() as { pin?: unknown });
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  // El bloqueo se comprueba antes que el PIN: si la IP está frenada no se
  // llega a comparar nada, que es justo lo que hace inútil la fuerza bruta.
  const throttle = await checkThrottle(request);
  if (throttle.locked) {
    return json({ error: 'Demasiados intentos', retryAfter: throttle.retryAfter }, 429);
  }

  if (!isValidPinFormat(pin)) {
    return json({ error: 'PIN inválido' }, 400);
  }

  let ok: boolean;
  try {
    ok = verifyPin(pin);
  } catch (e) {
    console.error('[api/streaming/unlock] configuración:', e);
    return json({ error: 'Streaming no está configurado en el servidor' }, 500);
  }

  if (!ok) {
    const state = await registerFailure(request);
    // 403 y no 401 a propósito: 401 exige una cabecera WWW-Authenticate que
    // aquí no aplica, y además el dev server de Astro con el adaptador de
    // Cloudflare convierte cualquier 401 en POST en un 500 al reenviarlo.
    return json(
      state.locked
        ? { error: 'Demasiados intentos', retryAfter: state.retryAfter }
        : { error: 'PIN incorrecto', remaining: state.remaining },
      state.locked ? 429 : 403,
    );
  }

  await clearFailures(request);
  cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions(url));

  return json({ ok: true });
};
