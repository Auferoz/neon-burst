<script setup lang="ts">
/**
 * Ficha rápida de un juego de la biblioteca de Steam. Los datos de la card
 * (steam_cache) se muestran al instante; logros, descripción y screenshots se
 * piden on-demand a `/api/steam/[appid]` y se cachean por appid mientras dure
 * la página.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import IconSteam from '../Icons/IconSteam.vue';
import IconTrophy from '../Icons/IconTrophy.vue';
import IconClock from '../Icons/IconClock.vue';
import SteamHeaderImage from './SteamHeaderImage.vue';
import {
  achievementPercent,
  steamHeaderCandidates,
  type SteamGameDetail,
  type SteamLibraryGame,
} from '../../utils/steamGameDetail';

const props = defineProps<{ game: SteamLibraryGame | null }>();
const emit = defineEmits<{ close: [] }>();

const detail = ref<SteamGameDetail | null>(null);
const loading = ref(false);
const error = ref('');

const panelEl = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

const cache = new Map<number, SteamGameDetail>();
let requestId = 0;

// Once the detail arrives, the store's exact header_image jumps to the front.
const headerSources = computed(() =>
  props.game ? steamHeaderCandidates(props.game.appid, props.game.poster, detail.value?.store?.header) : [],
);

const achievements = computed(() => detail.value?.achievements ?? null);
const progress = computed(() =>
  achievements.value ? achievementPercent(achievements.value.achieved, achievements.value.total) : 0,
);
const allDone = computed(() => !!achievements.value && achievements.value.missing.length === 0);

const genres = computed(() =>
  (props.game?.genres ?? '')
    .replace(/Hack and slash\/Beat 'em up/gi, 'Hack & Slash')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);

const hasHltb = computed(() => {
  const g = props.game;
  return !!g && !!(g.hltb_main || g.hltb_extra || g.hltb_completionist);
});

const controllerLabel: Record<string, string> = {
  full: 'Soporte completo de mando',
  partial: 'Soporte parcial de mando',
};

// Mismos cortes que Metacritic en la ficha de juegos jugados.
function metacriticClass(score: number): string {
  if (score >= 75) return 'text-neon-green border-neon-green/40 bg-neon-green/10';
  if (score >= 50) return 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/10';
  return 'text-neon-pink border-neon-pink/40 bg-neon-pink/10';
}

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return 'Sin jugar';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHltb(hours: number | null): string {
  if (!hours) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Nunca';
  return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function hideOnError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

async function loadDetail(appid: number) {
  const cached = cache.get(appid);
  if (cached) {
    detail.value = cached;
    return;
  }
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  detail.value = null;
  try {
    const res = await fetch(`/api/steam/${appid}`);
    if (!res.ok) throw new Error('No se pudieron cargar los detalles');
    const data = (await res.json()) as SteamGameDetail;
    cache.set(appid, data);
    if (id === requestId) detail.value = data;
  } catch (e) {
    if (id === requestId) error.value = (e as Error).message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}

function retry() {
  if (props.game) loadDetail(props.game.appid);
}

function requestClose() {
  emit('close');
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.game) requestClose();
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) requestClose();
}

watch(() => props.game, (game, previous) => {
  if (game) {
    if (!previous) {
      lastFocused = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', onDocumentKeydown);
    }
    loadDetail(game.appid);
    nextTick(() => panelEl.value?.focus());
  } else {
    requestId++;
    loading.value = false;
    document.removeEventListener('keydown', onDocumentKeydown);
    lastFocused?.focus();
    lastFocused = null;
  }
});

onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="game"
      class="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-8"
      @mousedown="onBackdrop"
    >
      <div
        ref="panelEl"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="steam-game-title"
        class="relative flex flex-col w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[88vh] bg-surface-1 sm:border border-neon-cyan/30 sm:rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
      >
        <!-- Close -->
        <button
          type="button"
          class="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary bg-surface-0/70 hover:text-text-primary hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors cursor-pointer"
          aria-label="Cerrar"
          @click="requestClose"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <!-- Hero -->
          <div class="relative">
            <!-- overflow-hidden: clips the scale-105 backdrop, which otherwise widens the scroller -->
            <div class="absolute inset-0 overflow-hidden" aria-hidden="true">
              <SteamHeaderImage
                :sources="headerSources"
                class="w-full h-full object-cover object-top opacity-40 blur-[2px] scale-105"
              />
              <div class="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/80 to-surface-1/30" />
            </div>

            <div class="relative flex gap-4 sm:gap-5 p-4 sm:p-6 pt-12 sm:pt-10">
              <img
                v-if="game.poster"
                :src="game.poster"
                :alt="`Poster de ${game.name}`"
                class="shrink-0 w-24 sm:w-36 rounded-lg object-cover aspect-3/4 bg-surface-3 border border-border-default shadow-lg"
                width="144"
                height="192"
                @error="hideOnError"
              />
              <div class="min-w-0 flex flex-col justify-end">
                <h2 id="steam-game-title" class="text-lg sm:text-2xl font-bold text-neon-cyan neon-glow-cyan leading-tight pr-8">
                  {{ game.name }}
                </h2>
                <p class="mt-1 text-xs text-text-secondary">
                  <span v-if="game.developer">{{ game.developer }}</span>
                  <template v-if="game.publisher && game.publisher !== game.developer">
                    <span class="text-surface-4" aria-hidden="true"> &middot; </span>{{ game.publisher }}
                  </template>
                  <template v-if="game.released">
                    <span class="text-surface-4" aria-hidden="true"> &middot; </span>{{ game.released }}
                  </template>
                </p>

                <div v-if="genres.length" class="flex flex-wrap gap-1 mt-2" role="list" aria-label="Géneros">
                  <span
                    v-for="g in genres"
                    :key="g"
                    role="listitem"
                    class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded"
                  >
                    {{ g }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-2 mt-3">
                  <a
                    :href="`https://store.steampowered.com/app/${game.appid}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors"
                  >
                    <IconSteam :size="14" />
                    Ver en Steam
                    <span class="sr-only">(abre en una pestaña nueva)</span>
                  </a>
                  <span
                    v-if="game.metacritic"
                    :class="metacriticClass(game.metacritic)"
                    class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold border rounded-lg"
                  >
                    {{ game.metacritic }} <span class="font-normal opacity-80">Metacritic</span>
                  </span>
                  <span
                    v-if="controllerLabel[game.controller_support]"
                    class="px-2 py-1 text-[11px] text-text-secondary border border-border-default rounded-lg"
                  >
                    {{ controllerLabel[game.controller_support] }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 sm:p-6 pt-2 sm:pt-2 space-y-6">
            <!-- Playtime -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-surface-2 border border-border-default rounded-xl p-3">
                <p class="text-[10px] uppercase tracking-wider text-text-muted">Tiempo jugado</p>
                <p class="mt-1 text-sm font-semibold" :class="game.playtime > 0 ? 'text-neon-cyan' : 'text-neon-pink'">
                  {{ formatPlaytime(game.playtime) }}
                </p>
              </div>
              <div class="bg-surface-2 border border-border-default rounded-xl p-3">
                <p class="text-[10px] uppercase tracking-wider text-text-muted">Última vez</p>
                <p class="mt-1 text-sm font-semibold text-text-primary">{{ formatDate(game.last_played) }}</p>
              </div>
            </div>

            <!-- Description + screenshots -->
            <section v-if="detail?.store && (detail.store.description || detail.store.screenshots.length)" aria-labelledby="steam-game-about">
              <h3 id="steam-game-about" class="text-sm font-semibold text-text-primary mb-2">Sobre el juego</h3>
              <p v-if="detail.store.description" class="text-xs text-text-secondary leading-relaxed">
                {{ detail.store.description }}
              </p>
              <ul v-if="detail.store.screenshots.length" class="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-thin" aria-label="Screenshots">
                <li v-for="(shot, i) in detail.store.screenshots" :key="shot.full" class="shrink-0">
                  <a
                    :href="shot.full"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block rounded-lg overflow-hidden border border-border-default hover:border-neon-cyan/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors"
                  >
                    <img
                      :src="shot.thumb"
                      :alt="`Screenshot ${i + 1} de ${game.name}`"
                      class="w-48 aspect-video object-cover bg-surface-3"
                      loading="lazy"
                      width="192"
                      height="108"
                    />
                  </a>
                </li>
              </ul>
            </section>

            <!-- HowLongToBeat -->
            <section v-if="hasHltb" aria-labelledby="steam-game-hltb">
              <h3 id="steam-game-hltb" class="flex items-center gap-1.5 text-sm font-semibold text-text-primary mb-2">
                <IconClock :size="14" class="text-neon-cyan" />
                HowLongToBeat
              </h3>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-surface-2 border border-border-default rounded-xl p-3 text-center">
                  <p class="text-base font-semibold text-neon-cyan">{{ formatHltb(game.hltb_main) }}</p>
                  <p class="text-[10px] text-text-secondary mt-0.5">Historia</p>
                </div>
                <div class="bg-surface-2 border border-border-default rounded-xl p-3 text-center">
                  <p class="text-base font-semibold text-neon-blue">{{ formatHltb(game.hltb_extra) }}</p>
                  <p class="text-[10px] text-text-secondary mt-0.5">+ Extras</p>
                </div>
                <div class="bg-surface-2 border border-border-default rounded-xl p-3 text-center">
                  <p class="text-base font-semibold text-neon-green">{{ formatHltb(game.hltb_completionist) }}</p>
                  <p class="text-[10px] text-text-secondary mt-0.5">100%</p>
                </div>
              </div>
            </section>

            <!-- Achievements -->
            <section aria-labelledby="steam-game-achievements">
              <h3 id="steam-game-achievements" class="flex items-center gap-1.5 text-sm font-semibold text-text-primary mb-2">
                <IconTrophy :size="14" class="text-neon-gold" />
                Logros
              </h3>

              <div v-if="loading" class="border border-dashed border-neon-cyan/20 rounded-xl p-6 text-center">
                <p class="text-xs text-neon-cyan animate-pulse" role="status">[ Consultando Steam... ]</p>
              </div>

              <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-6 text-center">
                <p class="text-xs text-neon-pink" role="alert">{{ error }}</p>
                <button
                  type="button"
                  class="mt-3 px-3 py-1.5 text-xs text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors cursor-pointer"
                  @click="retry"
                >
                  Reintentar
                </button>
              </div>

              <p v-else-if="detail && !achievements" class="border border-dashed border-border-default rounded-xl p-6 text-center text-xs text-text-secondary">
                Este juego no tiene logros en Steam
              </p>

              <template v-else-if="achievements">
                <div class="bg-surface-2 border border-border-default rounded-xl p-4">
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="text-sm text-text-secondary">
                      <span class="text-lg font-bold" :class="allDone ? 'text-neon-gold' : 'text-neon-cyan'">{{ achievements.achieved }}</span>
                      de <span class="font-semibold text-text-primary">{{ achievements.total }}</span> conseguidos
                    </p>
                    <span class="text-xs font-semibold" :class="allDone ? 'text-neon-gold' : 'text-neon-cyan'">{{ progress }}%</span>
                  </div>
                  <div
                    class="mt-2 h-2 rounded-full bg-surface-3 overflow-hidden"
                    role="progressbar"
                    :aria-valuenow="progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-label="`Logros conseguidos: ${progress}%`"
                  >
                    <div
                      class="h-full rounded-full transition-[width] duration-500"
                      :class="allDone ? 'bg-neon-gold' : 'bg-neon-cyan'"
                      :style="{ width: `${progress}%` }"
                    />
                  </div>
                  <p v-if="allDone" class="mt-3 text-xs font-medium text-neon-gold">¡Tienes todos los logros!</p>
                </div>

                <div v-if="!allDone" class="mt-4">
                  <p class="text-xs text-text-secondary mb-2">
                    Te faltan <span class="text-neon-pink font-semibold">{{ achievements.missing.length }}</span>
                    <span class="text-text-muted"> · los más comunes primero</span>
                  </p>
                  <ul class="space-y-2" aria-label="Logros que faltan">
                    <li
                      v-for="a in achievements.missing"
                      :key="a.apiname"
                      class="flex items-center gap-3 bg-surface-2/60 border border-border-default rounded-lg p-2"
                    >
                      <img
                        v-if="a.icon"
                        :src="a.icon"
                        alt=""
                        class="shrink-0 w-10 h-10 rounded-md bg-surface-3"
                        loading="lazy"
                        width="40"
                        height="40"
                        @error="hideOnError"
                      />
                      <div class="flex-1 min-w-0 break-words">
                        <p class="text-xs font-semibold text-text-primary">{{ a.name }}</p>
                        <details v-if="a.hidden && a.description" class="mt-0.5 text-[11px] text-text-secondary">
                          <summary class="cursor-pointer text-text-muted hover:text-neon-cyan">Logro oculto — ver descripción</summary>
                          <p class="mt-0.5">{{ a.description }}</p>
                        </details>
                        <p v-else-if="a.hidden" class="mt-0.5 text-[11px] text-text-muted">Logro oculto</p>
                        <p v-else-if="a.description" class="mt-0.5 text-[11px] text-text-secondary">{{ a.description }}</p>
                      </div>
                      <span
                        v-if="a.percent !== null"
                        class="shrink-0 text-[10px] text-text-secondary"
                        :title="`El ${a.percent}% de los jugadores lo tiene`"
                      >
                        {{ a.percent }}%
                        <span class="sr-only">de los jugadores lo tiene</span>
                      </span>
                    </li>
                  </ul>
                </div>
              </template>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
