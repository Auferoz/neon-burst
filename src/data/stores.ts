/**
 * Canonical list of game stores tracked in `library_games`.
 *
 * Steam is deliberately absent: it has its own page and cache table, fed by the
 * Steam Web API. Every store listed here is manual-entry, because none of them
 * exposes a usable public library API.
 *
 * `store` is stored as free TEXT in D1 (no CHECK constraint), so adding 'Steam'
 * here later would need no migration.
 */
export const STORES = [
  'Epic Games',
  'GOG',
  'EA app',
  'Ubisoft Connect',
  'Battle.net',
  'Xbox / Game Pass',
  'Amazon Games',
  'Humble Bundle',
  'itch.io',
  'PlayStation Network',
] as const;

export type Store = (typeof STORES)[number];

export function isStore(value: unknown): value is Store {
  return typeof value === 'string' && (STORES as readonly string[]).includes(value);
}

/** How the game was acquired. Free text in D1; these are just the suggestions. */
export const OWNED_VIA = ['Compra', 'Gratis', 'Suscripción', 'Bundle'] as const;

export type OwnedVia = (typeof OWNED_VIA)[number];

/**
 * Badge classes per store. Written out in full so Tailwind's scanner keeps them
 * in the bundle — never build these strings by interpolation.
 */
export const STORE_BADGE: Record<Store, string> = {
  'Epic Games': 'text-text-primary bg-surface-4 border-border-hover',
  'GOG': 'text-neon-purple bg-neon-purple/15 border-neon-purple/30',
  'EA app': 'text-neon-pink bg-neon-pink/10 border-neon-pink/30',
  'Ubisoft Connect': 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30',
  'Battle.net': 'text-neon-blue bg-neon-blue/10 border-neon-blue/30',
  'Xbox / Game Pass': 'text-neon-green bg-neon-green/10 border-neon-green/30',
  'Amazon Games': 'text-neon-yellow bg-neon-yellow/10 border-neon-yellow/30',
  'Humble Bundle': 'text-neon-pink bg-neon-pink/10 border-neon-pink/30',
  'itch.io': 'text-neon-pink bg-neon-pink/15 border-neon-pink/40',
  'PlayStation Network': 'text-neon-indigo bg-neon-indigo/10 border-neon-indigo/30',
};

export const FALLBACK_BADGE = 'text-text-secondary bg-surface-3 border-border-default';

export function storeBadge(store: string): string {
  return STORE_BADGE[store as Store] ?? FALLBACK_BADGE;
}
