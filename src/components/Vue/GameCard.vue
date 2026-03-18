<script setup lang="ts">
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
}

const props = defineProps<{
  game: Game;
}>();

const estadoColor: Record<string, string> = {
  Completado: 'text-neon-green border-neon-green/30 bg-neon-green/10',
  Abandonado: 'text-neon-pink border-neon-pink/30 bg-neon-pink/10',
  Jugando: 'text-neon-blue border-neon-blue/30 bg-neon-blue/10',
};

const logrosPercent = props.game.logros_total > 0
  ? Math.round((props.game.logros_obt / props.game.logros_total) * 100)
  : 0;

function igdbImage(id: string, size: string) {
  if (!id) return '';
  const clean = id.replace(/\.\w+$/, '');
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${clean}.webp`;
}

const posterUrl = igdbImage(props.game.poster, 'cover_big');
const artworkUrl = igdbImage(props.game.artworks, 'screenshot_big');
</script>

<template>
  <a :href="`/playedGames/${game.id}`" class="block h-full">
  <article class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-border-hover h-full flex flex-col cursor-pointer">
    <!-- Artwork background with blur -->
    <div
      v-if="artworkUrl"
      class="absolute inset-0 z-0"
    >
      <img
        :src="artworkUrl"
        :alt="''"
        class="w-full h-full object-cover object-top scale-105 opacity-70 group-hover:opacity-30 group-hover:blur-sm transition-all duration-300"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/90 to-surface-0/70" />
    </div>

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Poster -->
      <div class="shrink-0">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          :alt="game.title"
          class="w-16 sm:w-24 rounded-lg object-cover aspect-3/4 bg-surface-3"
          :style="{ viewTransitionName: `poster-${game.id}` }"
          loading="lazy"
          width="80"
          height="107"
        />
        <div
          v-else
          class="w-16 sm:w-24 rounded-lg aspect-3/4 bg-surface-3 flex items-center justify-center text-text-muted text-xs"
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
          <span
            :class="estadoColor[game.estado] || 'text-text-muted border-border-default bg-surface-2'"
            class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border"
          >
            {{ game.estado }}
          </span>
        </div>

        <!-- Meta -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted mb-2">
          <span>{{ game.companie }}</span>
          <span class="text-border-default">&middot;</span>
          <span>{{ game.console_pc }}</span>
          <span class="text-border-default">&middot;</span>
          <span>{{ game.horas_total }}h</span>
        </div>

        <!-- Genre tags -->
        <div class="flex flex-wrap gap-1 mb-2">
          <span
            v-for="g in game.genre.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)"
            :key="g"
            class="text-[10px] text-text-muted bg-surface-3/60 px-1.5 py-0.5 rounded"
          >
            {{ g }}
          </span>
        </div>

        <!-- Spacer to push logros to bottom -->
        <div class="flex-1" />

        <!-- Logros bar -->
        <div v-if="game.logros_total > 0">
          <div class="flex justify-between text-[10px] text-text-muted mb-1">
            <span>Logros</span>
            <span>{{ game.logros_obt }}/{{ game.logros_total }} ({{ logrosPercent }}%)</span>
          </div>
          <div class="h-1 bg-surface-3 rounded-full overflow-hidden">
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
