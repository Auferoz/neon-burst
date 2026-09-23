<script setup lang="ts">
import { computed } from 'vue';
import { igdbImage } from '../../utils/igdbImage';
import { textClass, personalBand } from '../../utils/ratingBands';
interface Game {
  id: number;
  title: string;
  released: string;
  companie: string;
  poster: string;
  artworks: string;
  genre: string;
  estado: string;
  horas_total: number;
  logros_obt: number;
  logros_total: number;
  console_pc: string;
  first_year_played: number | null;
  years_played: number[];
  description: string;
  is_demo: number;
  is_early_access: number;
  is_testing: number;
  rating_personal: number | null;
}

const props = defineProps<{
  game: Game;
}>();

// Color del score personal: bandas compartidas con el score personal de
// películas, vía utils/ratingBands.ts (misma escala 0-100, mismas clases).
function personalColor(score: number): string {
  return textClass[personalBand(score)];
}

const estadoColor: Record<string, string> = {
  Terminado: 'text-neon-green border-neon-green/30 bg-neon-green/10',
  Completado: 'text-neon-gold border-neon-gold/30 bg-neon-gold/10',
  Abandonado: 'text-neon-pink border-neon-pink/30 bg-neon-pink/10',
  Jugando: 'text-neon-blue border-neon-blue/30 bg-neon-blue/10',
  Recurrente: 'text-neon-purple border-neon-purple/30 bg-neon-purple/10',
  Pausado: 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10',
};

/**
 * En el listado, si el juego tiene alguna marca (Demo, Early Access, Review),
 * esa marca reemplaza al estado en vez de sumarse: son los casos donde "en qué
 * punto lo dejé" importa menos que "esto no es el juego final". Dentro de la
 * ficha sí se muestran todas juntas, que es donde hay lugar para el detalle.
 */
const hasFlag = computed(() =>
  !!(props.game.is_demo || props.game.is_early_access || props.game.is_testing)
);

const logrosPercent = props.game.logros_total > 0
  ? Math.round((props.game.logros_obt / props.game.logros_total) * 100)
  : 0;

const posterUrl = igdbImage(props.game.poster, 'cover_big');
const artworkUrl = igdbImage(props.game.artworks, 'screenshot_big');
</script>

<template>
  <a :href="`/playedGames/${game.id}`" class="block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue rounded-xl" :aria-label="`${game.title}, ${game.estado}, ${game.horas_total}h jugadas`">
  <article class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-border-hover h-full flex flex-col cursor-pointer">
    <!-- Artwork background (decorative) -->
    <div
      v-if="artworkUrl"
      class="absolute inset-0 z-0"
      aria-hidden="true"
    >
      <img
        :src="artworkUrl"
        alt=""
        class="w-full h-full object-cover object-top scale-105 group-hover:opacity-30 group-hover:blur-sm transition-all duration-300"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>
    <div
      v-else-if="posterUrl"
      class="absolute inset-0 z-0"
      aria-hidden="true"
    >
      <img
        :src="posterUrl"
        alt=""
        class="w-full h-full object-cover scale-150 blur-md opacity-40"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>
    <div
      v-else
      class="absolute inset-0 z-0 bg-surface-1 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-text-secondary/10"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
    </div>

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Poster -->
      <div class="shrink-0">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          :alt="`Poster de ${game.title}`"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-3/4 bg-surface-3"
          :style="{ viewTransitionName: `poster-${game.id}` }"
          loading="lazy"
          width="80"
          height="107"
        />
        <div
          v-else
          class="w-16 sm:w-24 rounded-lg aspect-3/4 bg-surface-3 flex items-center justify-center text-text-secondary/50 text-xs"
          aria-hidden="true"
        >
          ?
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- Title + Estado -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
            {{ game.title }}
          </h3>
          <div class="flex items-center gap-1 shrink-0">
            <span
              v-if="game.is_demo"
              class="text-[10px] font-medium px-2 py-0.5 rounded-md border text-neon-indigo border-neon-indigo/30 bg-neon-indigo/10"
            >
              Demo
            </span>
            <span
              v-if="game.is_early_access"
              class="text-[10px] font-medium px-2 py-0.5 rounded-md border text-neon-emerald border-neon-emerald/30 bg-neon-emerald/10"
            >
              Early Access
            </span>
            <span
              v-if="game.is_testing"
              class="text-[10px] font-medium px-2 py-0.5 rounded-md border text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10"
            >
              Review
            </span>
            <span
              v-if="!hasFlag"
              :class="estadoColor[game.estado] || 'text-text-secondary border-border-default bg-surface-2'"
              class="text-[10px] font-medium px-2 py-0.5 rounded-md border"
            >
              {{ game.estado }}
            </span>
          </div>
        </div>

        <!-- Meta -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span>{{ game.companie }}</span>
          <span class="text-surface-4" aria-hidden="true">&middot;</span>
          <span>{{ game.console_pc }}</span>
          <span class="text-surface-4" aria-hidden="true">&middot;</span>
          <span>{{ game.horas_total }}h</span>
          <!-- Mi score: si no lo cargué, no aparece ni deja el separador suelto -->
          <template v-if="game.rating_personal">
            <span class="text-surface-4" aria-hidden="true">&middot;</span>
            <span
              :class="personalColor(game.rating_personal)"
              class="inline-flex items-center gap-0.5 font-bold"
              :aria-label="`Mi score: ${game.rating_personal} de 100`"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <path d="M12 2l2.9 6.26 6.6.79-4.9 4.62 1.3 6.83L12 17.2l-5.9 3.3 1.3-6.83L2.5 9.05l6.6-.79L12 2z" />
              </svg>
              {{ game.rating_personal }}
            </span>
          </template>
        </div>

        <!-- Genre tags -->
        <div class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span
            v-for="g in game.genre.replace(/Hack and slash\/Beat 'em up/gi, 'Hack & Slash').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)"
            :key="g"
            role="listitem"
            class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded"
          >
            {{ g }}
          </span>
        </div>

        <!-- Spacer to push logros to bottom -->
        <div class="flex-1" />

        <!-- Logros bar -->
        <div v-if="game.logros_total > 0" :aria-label="`Logros: ${game.logros_obt} de ${game.logros_total}, ${logrosPercent}%`">
          <div class="flex justify-between text-[10px] text-text-secondary mb-1">
            <span>Logros</span>
            <span>{{ game.logros_obt }}/{{ game.logros_total }} ({{ logrosPercent }}%)</span>
          </div>
          <div class="h-1 bg-surface-3 rounded-full overflow-hidden" role="progressbar" :aria-valuenow="logrosPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${logrosPercent}% de logros completados`">
            <div
              class="h-full bg-neon-blue rounded-full transition-all duration-500"
              :style="{ width: `${logrosPercent}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </article>
  </a>
</template>
