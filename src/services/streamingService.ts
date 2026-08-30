/**
 * Streaming service — lectura de streaming_accounts en D1.
 *
 * Las contraseñas sólo se piden desde rutas que ya validaron la sesión;
 * para la pantalla bloqueada existe getStreamingAccountsPublic().
 */

import { env } from 'cloudflare:workers';

export interface StreamingAccount {
  id: number;
  name: string;
  url: string;
  logo: string;
  email: string;
  password: string;
  plan: string;
  sort_order: number;
}

/** Lo que es seguro renderizar sin sesión: todo menos email y contraseña. */
export type StreamingAccountPublic = Omit<StreamingAccount, 'password' | 'email'>;

const ORDER_BY = 'ORDER BY sort_order ASC, name ASC';

export async function getStreamingAccounts(): Promise<StreamingAccount[]> {
  const { results } = await env.DB
    .prepare(`SELECT id, name, url, logo, email, password, plan, sort_order FROM streaming_accounts ${ORDER_BY}`)
    .all<StreamingAccount>();

  return results ?? [];
}

export async function getStreamingAccountsPublic(): Promise<StreamingAccountPublic[]> {
  const { results } = await env.DB
    .prepare(`SELECT id, name, url, logo, plan, sort_order FROM streaming_accounts ${ORDER_BY}`)
    .all<StreamingAccountPublic>();

  return results ?? [];
}

export async function countStreamingAccounts(): Promise<number> {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS total FROM streaming_accounts')
    .first<{ total: number }>();

  return row?.total ?? 0;
}
