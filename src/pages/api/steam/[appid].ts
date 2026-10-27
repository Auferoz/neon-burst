import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  mapAchievements,
  mapStoreExtras,
  type GameAchievementsRaw,
  type GlobalPercentagesRaw,
  type PlayerAchievementsRaw,
  type SchemaRaw,
  type SteamGameDetail,
  type StoreDetailsRaw,
} from '../../../utils/steamGameDetail';

export const prerender = false;

const STATS = 'https://api.steampowered.com/ISteamUserStats';

function json(body: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });
}

/**
 * GET sin `res.ok` a propósito: GetPlayerAchievements responde 400 con un body
 * válido ("Requested app has no stats") para los juegos sin logros. Cualquier
 * fallo de red o JSON da null, y el modal muestra lo demás.
 */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchStore(appid: number): Promise<StoreDetailsRaw | null> {
  const data = await fetchJson<Record<string, { success: boolean; data?: StoreDetailsRaw }>>(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish`,
  );
  const entry = data?.[appid];
  return entry?.success && entry.data ? entry.data : null;
}

export const GET: APIRoute = async ({ params }) => {
  const appid = Number(params.appid);
  if (!Number.isInteger(appid) || appid <= 0) return json({ error: 'appid inválido' }, 400);

  // Solo juegos de la biblioteca: el endpoint no es un proxy abierto a Steam.
  const owned = await env.DB.prepare('SELECT 1 FROM steam_cache WHERE appid = ?').bind(appid).first();
  if (!owned) return json({ error: 'El juego no está en la biblioteca' }, 404);

  const key = env.STEAM_API_KEY;
  const steamid = env.STEAM_ID;

  const [player, schema, global, game, store] = await Promise.all([
    fetchJson<PlayerAchievementsRaw>(`${STATS}/GetPlayerAchievements/v0001/?appid=${appid}&key=${key}&steamid=${steamid}&l=spanish`),
    fetchJson<SchemaRaw>(`${STATS}/GetSchemaForGame/v2/?appid=${appid}&key=${key}&l=spanish`),
    fetchJson<GlobalPercentagesRaw>(`${STATS}/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`),
    // Única fuente de la descripción de los logros ocultos (ver GameAchievementsRaw).
    fetchJson<GameAchievementsRaw>(`https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?key=${key}&appid=${appid}&language=spanish`),
    fetchStore(appid),
  ]);

  const detail: SteamGameDetail = {
    achievements: mapAchievements(player, schema, global, game),
    store: store ? mapStoreExtras(store) : null,
  };

  // Caché corto y privado: los logros cambian mientras se juega.
  return json(detail, 200, 'private, max-age=120');
};
