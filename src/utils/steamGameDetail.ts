/**
 * Detalle on-demand de un juego de la biblioteca de Steam (modal de
 * `/mySteamGames`): logros del usuario y extras de la tienda.
 *
 * Módulo puro (sin `cloudflare:workers`) para que Vitest lo corra en Node.
 * Las llamadas a Steam viven en `src/pages/api/steam/[appid].ts`.
 */

/** Fila de `steam_cache` tal como la devuelve `GET /api/steam`. */
export interface SteamLibraryGame {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  released: string;
  poster: string;
  playtime: number;
  last_played: number;
  hltb_main: number | null;
  hltb_extra: number | null;
  hltb_completionist: number | null;
  controller_support: string;
  categories: string;
  metacritic: number | null;
}

// ── Formas crudas de la Steam Web API ──

/** `ISteamUserStats/GetPlayerAchievements/v0001` (con `l=spanish`). */
export interface PlayerAchievementsRaw {
  playerstats?: {
    success?: boolean;
    error?: string;
    achievements?: {
      apiname: string;
      achieved: number;
      unlocktime?: number;
      name?: string;
      description?: string;
    }[];
  };
}

/** `ISteamUserStats/GetSchemaForGame/v2` (con `l=spanish`). */
export interface SchemaRaw {
  game?: {
    availableGameStats?: {
      achievements?: {
        name: string;
        displayName?: string;
        hidden?: number;
        description?: string;
        icon?: string;
        icongray?: string;
      }[];
    };
  };
}

/** `ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002`. `percent` llega como string o número. */
export interface GlobalPercentagesRaw {
  achievementpercentages?: {
    achievements?: { name: string; percent: number | string }[];
  };
}

/**
 * `IPlayerService/GetGameAchievements/v1` (con `language=spanish`). No está en
 * la documentación oficial (la usa el cliente de Steam), pero es la única que
 * trae `localized_desc` de los logros ocultos: GetPlayerAchievements y el
 * schema los devuelven sin descripción.
 */
export interface GameAchievementsRaw {
  response?: {
    achievements?: { internal_name: string; localized_desc?: string }[];
  };
}

/** `data` de `store.steampowered.com/api/appdetails`. */
export interface StoreDetailsRaw {
  short_description?: string;
  header_image?: string;
  screenshots?: { id?: number; path_thumbnail?: string; path_full?: string }[];
}

// ── Formas que consume el modal ──

export interface MissingAchievement {
  apiname: string;
  name: string;
  description: string;
  /** Ícono gris (bloqueado) del schema, '' si no hay. */
  icon: string;
  hidden: boolean;
  /** % global de jugadores que lo tienen, redondeado; null si no se conoce. */
  percent: number | null;
}

export interface SteamAchievements {
  total: number;
  achieved: number;
  /** Los que faltan, los más comunes (más fáciles) primero. */
  missing: MissingAchievement[];
}

export interface StoreExtras {
  description: string;
  screenshots: { thumb: string; full: string }[];
  /** `header_image` real de la tienda (ruta con hash en los juegos nuevos), '' si no hay. */
  header: string;
}

export interface SteamGameDetail {
  achievements: SteamAchievements | null;
  store: StoreExtras | null;
}

const MAX_SCREENSHOTS = 8;

/**
 * Cruza los logros del jugador con el schema (íconos, flag de oculto), los %
 * globales y GetGameAchievements (descripción de los ocultos). `null` si el
 * juego no tiene logros (Steam responde "no stats").
 */
export function mapAchievements(
  player: PlayerAchievementsRaw | null,
  schema: SchemaRaw | null,
  global: GlobalPercentagesRaw | null,
  game: GameAchievementsRaw | null = null,
): SteamAchievements | null {
  const list = player?.playerstats?.achievements;
  if (!player?.playerstats?.success || !list?.length) return null;

  const schemaByName = new Map(
    (schema?.game?.availableGameStats?.achievements ?? []).map(a => [a.name, a]),
  );
  const descByName = new Map(
    (game?.response?.achievements ?? []).map(a => [a.internal_name, a.localized_desc ?? '']),
  );
  const percentByName = new Map<string, number>();
  for (const a of global?.achievementpercentages?.achievements ?? []) {
    const value = Number(a.percent);
    if (Number.isFinite(value)) percentByName.set(a.name, Math.round(value));
  }

  const missing: MissingAchievement[] = list
    .filter(a => !a.achieved)
    .map(a => {
      const s = schemaByName.get(a.apiname);
      return {
        apiname: a.apiname,
        name: a.name || s?.displayName || a.apiname,
        description: a.description || s?.description || descByName.get(a.apiname) || '',
        icon: s?.icongray || s?.icon || '',
        hidden: s?.hidden === 1,
        percent: percentByName.get(a.apiname) ?? null,
      };
    });

  // Sin % conocido van al final; a igualdad, se respeta el orden de Steam.
  missing.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));

  return {
    total: list.length,
    achieved: list.length - missing.length,
    missing,
  };
}

/** Porcentaje de logros, redondeado hacia abajo: 249/250 es 99%, no 100%. */
export function achievementPercent(achieved: number, total: number): number {
  return total > 0 ? Math.floor((achieved / total) * 100) : 0;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, m => ENTITIES[m])
    .trim();
}

export function mapStoreExtras(data: StoreDetailsRaw): StoreExtras {
  const screenshots = (data.screenshots ?? [])
    .filter(s => s.path_thumbnail && s.path_full)
    .slice(0, MAX_SCREENSHOTS)
    .map(s => ({ thumb: s.path_thumbnail!, full: s.path_full! }));

  return {
    description: plainText(data.short_description ?? ''),
    screenshots,
    header: data.header_image ?? '',
  };
}

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

/**
 * Imágenes a probar, en orden, como header de un juego. Los juegos nuevos
 * guardan sus assets en rutas con hash, así que el `header.jpg` de ruta fija da
 * 404 (p. ej. 3513350); `library_hero.jpg` suele seguir en la ruta fija, y el
 * póster es el último recurso. Si se conoce el `header_image` de la tienda, va
 * primero porque es la URL exacta.
 */
export function steamHeaderCandidates(appid: number, poster: string, storeHeader = ''): string[] {
  const all = [storeHeader, `${STEAM_CDN}/${appid}/header.jpg`, `${STEAM_CDN}/${appid}/library_hero.jpg`, poster];
  return all.filter((src, i) => src && all.indexOf(src) === i);
}
