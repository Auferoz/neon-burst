<script setup lang="ts">
/**
 * Result card of the Steam raffle. Presentational: shows the winner and emits
 * the follow-up actions; the container owns the pool and the exclusions.
 */
import { computed } from 'vue';
import { controllerLabel, normalizeGenres, type RaffleGame } from '../../utils/steamRaffle';

const props = defineProps<{ game: RaffleGame }>();

const emit = defineEmits<{
  again: [];
  excludeAndAgain: [];
  backToFilters: [];
}>();

const genres = computed(() => normalizeGenres(props.game.genres));

function formatHours(hours: number | null): string {
  if (!hours) return 'Sin dato';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return 'Sin jugar';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const btnPrimary =
  'inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-neon-cyan border border-neon-cyan/40 bg-neon-cyan/10 rounded-lg hover:bg-neon-cyan/20 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan';
const btnMuted =
  'inline-flex items-center justify-center px-4 py-2 text-xs text-text-secondary border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan';
</script>

<template>
  <div class="flex flex-col items-center gap-5 py-4 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
    <div class="shrink-0 w-48 sm:w-56 aspect-3/4 rounded-xl border-2 border-neon-cyan bg-surface-2 overflow-hidden raffle-winner">
      <img v-if="game.poster" :src="game.poster" :alt="`Poster de ${game.name}`" class="w-full h-full object-cover" />
      <div v-else class="w-full h-full flex items-center justify-center p-3 text-center text-sm font-semibold text-text-primary">
        {{ game.name }}
      </div>
    </div>

    <div class="min-w-0 max-w-md text-center sm:text-left space-y-4">
      <div>
        <p class="text-xs font-bold tracking-widest text-neon-cyan neon-glow-cyan">🏆 ELEGIDO</p>
        <h3 class="text-xl sm:text-2xl font-bold text-text-primary leading-tight mt-1">{{ game.name }}</h3>
      </div>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-left">
        <div>
          <dt class="text-text-muted">Historia principal</dt>
          <dd class="text-neon-cyan font-semibold">{{ formatHours(game.hltb_main) }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Ya jugadas</dt>
          <dd class="text-text-primary font-semibold">{{ formatPlaytime(game.playtime) }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Control</dt>
          <dd class="text-text-primary font-semibold">{{ controllerLabel(game.controller_support) }}</dd>
        </div>
      </dl>

      <ul v-if="genres.length" class="flex flex-wrap justify-center sm:justify-start gap-1" aria-label="Géneros">
        <li v-for="g in genres" :key="g" class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded">
          {{ g }}
        </li>
      </ul>

      <div class="flex flex-wrap justify-center sm:justify-start gap-2">
        <a :href="`steam://run/${game.appid}`" :class="btnPrimary">Jugar en Steam</a>
        <a
          :href="`https://store.steampowered.com/app/${game.appid}`"
          target="_blank"
          rel="noopener noreferrer"
          :class="btnMuted"
        >
          Ver en la tienda
        </a>
      </div>

      <div class="flex flex-wrap justify-center sm:justify-start gap-2">
        <button type="button" :class="btnPrimary" @click="emit('again')">Volver a sortear</button>
        <button type="button" :class="btnMuted" @click="emit('excludeAndAgain')">Sacarlo y volver a sortear</button>
        <button type="button" :class="btnMuted" @click="emit('backToFilters')">Cambiar filtros</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.raffle-winner {
  box-shadow: 0 0 30px 8px rgb(0 229 255 / 0.5), inset 0 0 12px rgb(0 229 255 / 0.2);
}
</style>
