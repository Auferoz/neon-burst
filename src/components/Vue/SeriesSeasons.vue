<script setup lang="ts">
import { ref } from 'vue';

interface Episode {
  number: number;
  title: string;
  overview: string;
  rating: number;
  runtime: number;
  first_aired: string;
  screenshot: string;
  episode_type: string;
}

interface Season {
  number: number;
  title: string;
  episode_count: number;
  aired_episodes: number;
  rating: number;
  overview: string;
  episodes: Episode[];
}

const props = defineProps<{
  seasons: Season[];
  watchedSeasons: number[];
}>();

const expanded = ref<Set<number>>(new Set());

function toggle(num: number) {
  if (expanded.value.has(num)) {
    expanded.value.delete(num);
  } else {
    expanded.value.add(num);
  }
  expanded.value = new Set(expanded.value);
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ratingColor(r: number): string {
  if (r >= 7) return 'text-neon-green border-neon-green/30 bg-neon-green/10';
  if (r >= 5) return 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10';
  return 'text-neon-pink border-neon-pink/30 bg-neon-pink/10';
}
</script>

<template>
  <div class="border border-border-default rounded-xl p-5 sm:p-6">
    <h2 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Temporadas</h2>
    <div class="h-px bg-linear-to-r from-neon-indigo/30 via-neon-indigo/15 to-transparent mb-4"></div>

    <div class="space-y-2">
      <div v-for="season in seasons" :key="season.number">
        <!-- Season header -->
        <button
          @click="toggle(season.number)"
          class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer"
          :class="expanded.has(season.number)
            ? 'bg-neon-indigo/10 border border-neon-indigo/20'
            : 'hover:bg-surface-2 border border-transparent'"
          :aria-expanded="expanded.has(season.number)"
          :aria-controls="`season-${season.number}`"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Expand arrow -->
            <svg
              xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
              class="shrink-0 transition-transform duration-200 text-text-muted"
              :class="expanded.has(season.number) ? 'rotate-90 text-neon-indigo' : ''"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>

            <span class="text-sm font-medium" :class="expanded.has(season.number) ? 'text-neon-indigo' : 'text-text-primary'">
              {{ season.title }}
            </span>

            <!-- Watched badge -->
            <span
              v-if="watchedSeasons.includes(season.number)"
              class="text-[9px] font-medium px-1.5 py-0.5 rounded border text-neon-green border-neon-green/30 bg-neon-green/10"
            >
              Vista
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] text-text-muted">{{ season.aired_episodes }} eps</span>
            <span
              v-if="season.rating > 0"
              :class="ratingColor(season.rating)"
              class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
            >
              {{ season.rating.toFixed(1) }}
            </span>
          </div>
        </button>

        <!-- Episodes list -->
        <div
          v-if="expanded.has(season.number)"
          :id="`season-${season.number}`"
          class="mt-1 ml-6 border-l border-border-default"
        >
          <div
            v-for="ep in season.episodes"
            :key="ep.number"
            class="flex items-center gap-3 px-3 py-2 hover:bg-surface-1/50 transition-colors border-b border-border-default/50 last:border-0"
          >
            <!-- Episode number -->
            <span class="shrink-0 w-6 text-center text-[11px] text-text-muted font-medium">{{ ep.number }}</span>

            <!-- Screenshot thumbnail -->
            <div v-if="ep.screenshot" class="shrink-0">
              <img
                :src="ep.screenshot"
                :alt="`E${ep.number}`"
                class="w-16 h-9 rounded object-cover bg-surface-3"
                loading="lazy"
              />
            </div>

            <!-- Title + date -->
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-primary leading-snug line-clamp-1">{{ ep.title }}</p>
              <div class="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                <span v-if="ep.first_aired">{{ formatDate(ep.first_aired) }}</span>
                <span v-if="ep.runtime">{{ ep.runtime }}m</span>
              </div>
            </div>

            <!-- Rating -->
            <span
              v-if="ep.rating > 0"
              :class="ratingColor(ep.rating)"
              class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border"
            >
              {{ ep.rating.toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
