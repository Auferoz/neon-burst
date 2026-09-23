/**
 * Bandas de color compartidas para scores 0-100 (TMDB, IMDb, personal).
 *
 * `personal` es el score que carga el usuario a mano (juegos y películas
 * comparten exactamente las mismas cinco bandas); `tmdb` e `imdb` son los dos
 * proveedores externos de películas, con las mismas bandas entre sí porque
 * ambos publican en 0-100 sin percentiles ni cortes propios como Metacritic
 * u OpenCritic.
 *
 * Sin dependencias de Cloudflare ni del DOM: se puede importar tanto desde
 * componentes Vue/Astro como desde Vitest.
 */

/** 0-44 rosa · 45-54 naranja · 55-69 amarillo · 70-89 verde · 90-100 azul */
export function personalBand(score: number): string {
  if (score >= 90) return 'neon-blue';
  if (score >= 70) return 'neon-green';
  if (score >= 55) return 'neon-yellow';
  if (score >= 45) return 'neon-orange';
  return 'neon-pink';
}

/** 0-49 rosa · 50-69 amarillo · 70-100 verde (el corte 7/5 sobre 10 de Trakt, movido a 0-100) */
export function tmdbImdbBand(score: number): string {
  if (score >= 70) return 'neon-green';
  if (score >= 50) return 'neon-yellow';
  return 'neon-pink';
}

export const ratingBands = {
  personal: personalBand,
  tmdb: tmdbImdbBand,
  imdb: tmdbImdbBand,
};

/**
 * Tailwind escanea el código como texto: estas clases tienen que existir
 * literales en algún lado o las purga. Estos mapas son ese lugar, compartidos
 * por `playedGames/[id].astro`, `PlayedGamesCard.vue`, `MoviesCard.vue` y
 * `movies/[id].astro`.
 */
export const badgeClass: Record<string, string> = {
  'neon-blue': 'text-neon-blue border-neon-blue/30 bg-neon-blue/10',
  'neon-green': 'text-neon-green border-neon-green/30 bg-neon-green/10',
  'neon-emerald': 'text-neon-emerald border-neon-emerald/30 bg-neon-emerald/10',
  'neon-yellow': 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10',
  'neon-orange': 'text-neon-orange border-neon-orange/30 bg-neon-orange/10',
  'neon-pink': 'text-neon-pink border-neon-pink/30 bg-neon-pink/10',
};

export const textClass: Record<string, string> = {
  'neon-blue': 'text-neon-blue',
  'neon-green': 'text-neon-green',
  'neon-emerald': 'text-neon-emerald',
  'neon-yellow': 'text-neon-yellow',
  'neon-orange': 'text-neon-orange',
  'neon-pink': 'text-neon-pink',
};

/**
 * Promedio redondeado de los scores 0-100 que existan (TMDB, IMDb, personal).
 * Ignora null/undefined; si no hay ninguno, devuelve null en vez de 0 para no
 * confundir "sin datos" con "la peor película posible". Usado por
 * `MoviesCard.vue` para mostrar un único badge de promedio en vez de tres.
 */
export function averageScore(scores: (number | null | undefined)[]): number | null {
  const present = scores.filter((s): s is number => s != null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, s) => sum + s, 0) / present.length);
}
