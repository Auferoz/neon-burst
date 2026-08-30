/**
 * Streaming auth — PIN server-side + cookie de sesión firmada (HMAC-SHA256).
 *
 * El PIN nunca llega al cliente: se compara aquí contra el secret STREAMING_PIN.
 * La cookie sólo lleva una fecha de expiración y su firma, así que el navegador
 * no puede fabricarla ni alargarla sin conocer STREAMING_SESSION_SECRET.
 *
 * Web Crypto en vez de node:crypto — es lo que corre en Cloudflare Workers.
 */

import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'nb_streaming';
export const PIN_LENGTH = 6;
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

/** Fallos consecutivos por IP antes de bloquear. */
const MAX_FAILS = 8;
/** Duración del bloqueo una vez agotados los intentos. */
const LOCK_SECONDS = 15 * 60;

/**
 * Los secrets nuevos no están en los tipos generados por `wrangler types`
 * hasta que se regeneran, así que se leen por índice.
 */
const secrets = env as unknown as Record<string, string | undefined>;

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Comparación en tiempo constante: recorre siempre la cadena entera para no
 * filtrar por cuánto tarda cuántos caracteres iniciales acertó quien prueba.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = textBytes(a);
  const bBytes = textBytes(b);
  // La longitud sí se filtra, y no importa: el PIN tiene longitud fija conocida.
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i]! ^ bBytes[i]!;
  return diff === 0;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = secrets.STREAMING_SESSION_SECRET;
  if (!secret) throw new Error('Falta el secret STREAMING_SESSION_SECRET');

  return crypto.subtle.importKey(
    'raw',
    textBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, textBytes(payload));
  return toBase64Url(signature);
}

/** Token con la forma `<expiraEnSegundos>.<firma>`. */
export async function createSessionToken(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload)}`;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt)) return false;

  // Se comprueba la firma aunque haya caducado: así una cookie vencida y una
  // falsificada tardan lo mismo en rechazarse.
  let expected: string;
  try {
    expected = await sign(payload);
  } catch {
    return false;
  }

  const signatureOk = timingSafeEqual(signature, expected);
  const notExpired = expiresAt > Math.floor(Date.now() / 1000);
  return signatureOk && notExpired;
}

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function verifyPin(pin: string): boolean {
  const expected = secrets.STREAMING_PIN;
  if (!expected) throw new Error('Falta el secret STREAMING_PIN');
  return timingSafeEqual(pin, expected);
}

// ── Rate limiting ──────────────────────────────────────────────────────────

export interface ThrottleState {
  locked: boolean;
  /** Segundos que faltan para poder reintentar. */
  retryAfter: number;
  /** Intentos que quedan antes del bloqueo. */
  remaining: number;
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown';
}

export async function checkThrottle(request: Request): Promise<ThrottleState> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB
    .prepare('SELECT fails, locked_until FROM streaming_attempts WHERE ip = ?')
    .bind(clientIp(request))
    .first<{ fails: number; locked_until: number }>();

  if (!row) return { locked: false, retryAfter: 0, remaining: MAX_FAILS };

  if (row.locked_until > now) {
    return { locked: true, retryAfter: row.locked_until - now, remaining: 0 };
  }
  return { locked: false, retryAfter: 0, remaining: Math.max(0, MAX_FAILS - row.fails) };
}

export async function registerFailure(request: Request): Promise<ThrottleState> {
  const ip = clientIp(request);
  const now = Math.floor(Date.now() / 1000);

  const row = await env.DB
    .prepare('SELECT fails FROM streaming_attempts WHERE ip = ?')
    .bind(ip)
    .first<{ fails: number }>();

  const fails = (row?.fails ?? 0) + 1;
  const shouldLock = fails >= MAX_FAILS;
  const lockedUntil = shouldLock ? now + LOCK_SECONDS : 0;

  await env.DB
    .prepare(`
      INSERT INTO streaming_attempts (ip, fails, locked_until, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(ip) DO UPDATE SET
        fails = excluded.fails,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    `)
    // Al bloquear se reinicia el contador: el bloqueo ya es el castigo.
    .bind(ip, shouldLock ? 0 : fails, lockedUntil)
    .run();

  return shouldLock
    ? { locked: true, retryAfter: LOCK_SECONDS, remaining: 0 }
    : { locked: false, retryAfter: 0, remaining: MAX_FAILS - fails };
}

export async function clearFailures(request: Request): Promise<void> {
  await env.DB
    .prepare('DELETE FROM streaming_attempts WHERE ip = ?')
    .bind(clientIp(request))
    .run();
}

// ── Cookie ─────────────────────────────────────────────────────────────────

/** `Secure` rompe la cookie en el dev server (http), así que depende del esquema. */
export function sessionCookieOptions(url: URL) {
  return {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
