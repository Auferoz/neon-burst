<script setup lang="ts">
/**
 * Steam raffle ("Sortear"). Container: owns the filters, the exclusions, the
 * saved lists (fetched lazily from D1) and the phase machine
 * 'filters' | 'lists' | 'spinning' | 'result'. The winner is chosen BEFORE the
 * animation; the reel only plays it back. Pure rules: src/utils/steamRaffle.ts.
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import {
  availableGenres,
  buildReelSchedule,
  cryptoUint32,
  defaultFilters,
  filterPool,
  pickWinnerIndex,
  sanitizeFilters,
  type RaffleFilters,
  type RaffleGame,
  type RaffleList,
  type ReelStep,
} from '../../utils/steamRaffle';
import SteamRaffleFilters from './SteamRaffleFilters.vue';
import SteamRaffleReel from './SteamRaffleReel.vue';
import SteamRaffleLists from './SteamRaffleLists.vue';
import SteamRaffleResult from './SteamRaffleResult.vue';

const props = defineProps<{
  open: boolean;
  games: RaffleGame[];
}>();

const emit = defineEmits<{ close: [] }>();

type Phase = 'filters' | 'lists' | 'spinning' | 'result';

const STORAGE_KEY = 'nb_steam_raffle_filters';
const REEL_TICKS = 36;
const REEL_MS = 4000;
const NO_EXCLUSIONS: ReadonlySet<number> = new Set();

const phase = ref<Phase>('filters');
const filters = ref<RaffleFilters>(defaultFilters());
const excluded = ref<Set<number>>(new Set());
const filtersOpen = ref(false);

const lists = ref<RaffleList[]>([]);
const listsLoading = ref(false);
const listsLoaded = ref(false);
const listsBusy = ref(false);
const listsError = ref('');

const winner = ref<RaffleGame | null>(null);
const reelPool = ref<RaffleGame[]>([]);
const schedule = ref<ReelStep[]>([]);
const announcement = ref('');

const panelEl = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

// ── Derived ──

const genreOptions = computed(() => availableGenres(props.games));
const matching = computed(() => filterPool(props.games, filters.value, lists.value, NO_EXCLUSIONS));
const pool = computed(() => matching.value.filter(g => !excluded.value.has(g.appid)));
const canRaffle = computed(() => pool.value.length > 0);
const counterText = computed(() => {
  const n = pool.value.length;
  return `🎲 ${n} ${n === 1 ? 'juego' : 'juegos'} en el bombo`;
});

// ── Persistence (filters only; exclusions are per session) ──

function loadFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) filters.value = sanitizeFilters(JSON.parse(raw));
  } catch {
    // No storage, blocked or corrupt JSON: keep the defaults.
  }
}

watch(filters, value => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: the raffle works the same, just without memory.
  }
}, { deep: true });

// ── Lists ──

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function loadLists() {
  listsLoading.value = true;
  listsError.value = '';
  try {
    lists.value = await api<RaffleList[]>('/api/steam/raffle-lists', { cache: 'no-store' });
    listsLoaded.value = true;
    dropStaleListFilter();
  } catch (e) {
    listsError.value = (e as Error).message;
  } finally {
    listsLoading.value = false;
  }
}

function dropStaleListFilter() {
  if (filters.value.listId !== null && !lists.value.some(l => l.id === filters.value.listId)) {
    filters.value = { ...filters.value, listId: null };
  }
}

async function mutateLists(action: () => Promise<void>) {
  listsBusy.value = true;
  listsError.value = '';
  try {
    await action();
  } catch (e) {
    listsError.value = (e as Error).message;
  } finally {
    listsBusy.value = false;
  }
}

function onCreate(name: string) {
  return mutateLists(async () => {
    const created = await api<RaffleList>('/api/steam/raffle-lists', jsonInit('POST', { name }));
    lists.value = [...lists.value, created].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
}

function onRename(id: number, name: string) {
  return mutateLists(async () => {
    const updated = await api<RaffleList>(`/api/steam/raffle-lists/${id}`, jsonInit('PATCH', { name }));
    lists.value = lists.value
      .map(l => (l.id === id ? updated : l))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
}

function onRemove(id: number) {
  return mutateLists(async () => {
    await api(`/api/steam/raffle-lists/${id}`, { method: 'DELETE' });
    lists.value = lists.value.filter(l => l.id !== id);
    dropStaleListFilter();
  });
}

function onAddItem(listId: number, appid: number) {
  return mutateLists(async () => {
    await api(`/api/steam/raffle-lists/${listId}/items`, jsonInit('POST', { appid }));
    lists.value = lists.value.map(l =>
      l.id === listId && !l.appids.includes(appid) ? { ...l, appids: [...l.appids, appid] } : l,
    );
  });
}

function onRemoveItem(listId: number, appid: number) {
  return mutateLists(async () => {
    await api(`/api/steam/raffle-lists/${listId}/items/${appid}`, { method: 'DELETE' });
    lists.value = lists.value.map(l =>
      l.id === listId ? { ...l, appids: l.appids.filter(a => a !== appid) } : l,
    );
  });
}

// ── Exclusions ──

function toggleExcluded(appid: number) {
  const next = new Set(excluded.value);
  if (next.has(appid)) next.delete(appid);
  else next.add(appid);
  excluded.value = next;
}

function resetExclusions() {
  excluded.value = new Set();
}

function resetFilters() {
  filters.value = defaultFilters();
}

// ── Raffle ──

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showResult(game: RaffleGame) {
  winner.value = game;
  announcement.value = `Elegido: ${game.name}`;
  phase.value = 'result';
}

function start() {
  const frozen = pool.value;
  if (frozen.length === 0) {
    phase.value = 'filters';
    return;
  }
  announcement.value = '';
  const index = pickWinnerIndex(frozen.length, cryptoUint32);
  const chosen = frozen[index];
  winner.value = chosen;

  if (frozen.length === 1 || prefersReducedMotion()) {
    showResult(chosen);
    return;
  }

  reelPool.value = frozen;
  schedule.value = buildReelSchedule(frozen.length, index, { ticks: REEL_TICKS, totalMs: REEL_MS });
  phase.value = 'spinning';
}

function finishReel() {
  if (phase.value === 'spinning' && winner.value) showResult(winner.value);
}

function excludeWinnerAndAgain() {
  if (winner.value) toggleExcludedOn(winner.value.appid);
  start();
}

function toggleExcludedOn(appid: number) {
  const next = new Set(excluded.value);
  next.add(appid);
  excluded.value = next;
}

// ── Dialog behavior ──

function requestClose() {
  emit('close');
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return;
  if (phase.value === 'spinning') {
    // First Escape stops the reel and shows the result; a second one closes.
    finishReel();
    return;
  }
  requestClose();
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) requestClose();
}

watch(() => props.open, open => {
  if (open) {
    lastFocused = document.activeElement as HTMLElement | null;
    phase.value = 'filters';
    filtersOpen.value = false;
    if (!listsLoaded.value) loadLists();
    nextTick(() => panelEl.value?.focus());
    document.addEventListener('keydown', onDocumentKeydown);
  } else {
    document.removeEventListener('keydown', onDocumentKeydown);
    lastFocused?.focus();
    lastFocused = null;
  }
});

watch(phase, value => {
  if (value === 'result') nextTick(() => panelEl.value?.focus());
});

onMounted(loadFilters);
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown));

const tabClass = (active: boolean) =>
  active
    ? 'text-neon-cyan border-neon-cyan'
    : 'text-text-secondary border-transparent hover:text-text-primary';
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-8"
      @mousedown="onBackdrop"
    >
      <div
        ref="panelEl"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="steam-raffle-title"
        class="relative flex flex-col w-full sm:max-w-5xl h-full sm:h-[85vh] bg-surface-1 sm:border border-border-default sm:rounded-2xl shadow-2xl focus:outline-none"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 border-b border-border-default">
          <div class="min-w-0">
            <h2 id="steam-raffle-title" class="text-lg font-bold text-neon-cyan neon-glow-cyan leading-tight">
              Sortear un juego
            </h2>
            <div v-if="phase === 'filters' || phase === 'lists'" role="tablist" aria-label="Secciones del sorteo" class="flex gap-4 mt-2">
              <button
                id="raffle-tab-filters"
                type="button"
                role="tab"
                :aria-selected="phase === 'filters'"
                aria-controls="raffle-panel"
                :class="tabClass(phase === 'filters')"
                class="pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer"
                @click="phase = 'filters'"
              >
                Sorteo
              </button>
              <button
                id="raffle-tab-lists"
                type="button"
                role="tab"
                :aria-selected="phase === 'lists'"
                aria-controls="raffle-panel"
                :class="tabClass(phase === 'lists')"
                class="pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer"
                @click="phase = 'lists'"
              >
                Listas
              </button>
            </div>
            <div v-else class="pb-2"></div>
          </div>
          <button
            type="button"
            class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
            aria-label="Cerrar"
            @click="requestClose"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Winner announcement for screen readers -->
        <div class="sr-only" aria-live="polite" role="status">{{ announcement }}</div>

        <!-- Body -->
        <div id="raffle-panel" class="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4 sm:p-5">
          <!-- Sorteo: filters + pool -->
          <div v-if="phase === 'filters'" class="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-6 lg:h-full">
            <aside class="lg:overflow-y-auto lg:pr-2" aria-label="Filtros del sorteo">
              <button
                type="button"
                class="lg:hidden w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg cursor-pointer"
                :aria-expanded="filtersOpen"
                aria-controls="raffle-filters-body"
                @click="filtersOpen = !filtersOpen"
              >
                Filtros
                <span aria-hidden="true">{{ filtersOpen ? '−' : '+' }}</span>
              </button>
              <div
                id="raffle-filters-body"
                :class="filtersOpen ? 'block' : 'hidden'"
                class="mt-3 lg:mt-0 lg:block"
              >
                <SteamRaffleFilters
                  v-model="filters"
                  :genres="genreOptions"
                  :lists="lists"
                  @reset="resetFilters"
                />
              </div>
            </aside>

            <section class="mt-4 lg:mt-0 min-w-0 lg:overflow-y-auto" aria-label="Juegos en el bombo">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p class="text-sm font-semibold text-neon-cyan">{{ counterText }}</p>
                <button
                  v-if="excluded.size > 0"
                  type="button"
                  class="text-[11px] text-text-secondary underline hover:text-neon-cyan cursor-pointer"
                  @click="resetExclusions"
                >
                  Restablecer exclusiones ({{ excluded.size }})
                </button>
              </div>
              <p v-if="matching.length > 0" class="text-[11px] text-text-muted mb-3">
                Haz clic en un juego para sacarlo de este sorteo.
              </p>

              <p v-if="matching.length === 0" class="border border-dashed border-neon-cyan/20 rounded-xl p-8 text-center text-sm text-text-secondary">
                No hay juegos con estos filtros
              </p>
              <ul v-else class="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2" aria-label="Juegos que coinciden con los filtros">
                <li v-for="g in matching" :key="g.appid">
                  <button
                    type="button"
                    :aria-pressed="excluded.has(g.appid)"
                    :aria-label="excluded.has(g.appid) ? `${g.name} (excluido de este sorteo)` : g.name"
                    :title="g.name"
                    :class="excluded.has(g.appid) ? 'opacity-40 grayscale border-neon-pink/40' : 'border-border-default hover:border-neon-cyan/50'"
                    class="relative block w-full aspect-3/4 rounded-lg border overflow-hidden bg-surface-2 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
                    @click="toggleExcluded(g.appid)"
                  >
                    <img
                      v-if="g.poster"
                      :src="g.poster"
                      alt=""
                      loading="lazy"
                      class="w-full h-full object-cover"
                    />
                    <span
                      v-else
                      class="w-full h-full flex items-center justify-center p-1.5 text-center text-[10px] font-medium text-text-secondary"
                    >
                      {{ g.name }}
                    </span>
                    <span
                      v-if="excluded.has(g.appid)"
                      class="absolute inset-0 flex items-center justify-center bg-black/40 text-neon-pink text-3xl font-bold"
                      aria-hidden="true"
                    >
                      ×
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          </div>

          <!-- Listas -->
          <div v-else-if="phase === 'lists'" class="max-w-3xl mx-auto lg:h-full lg:overflow-y-auto">
            <SteamRaffleLists
              :lists="lists"
              :games="games"
              :loading="listsLoading"
              :busy="listsBusy"
              :error="listsError"
              @create="onCreate"
              @rename="onRename"
              @remove="onRemove"
              @add-item="onAddItem"
              @remove-item="onRemoveItem"
            />
          </div>

          <!-- Spinning -->
          <SteamRaffleReel
            v-else-if="phase === 'spinning'"
            :pool="reelPool"
            :schedule="schedule"
            @done="finishReel"
          />

          <!-- Result -->
          <div v-else-if="phase === 'result' && winner" class="lg:h-full lg:overflow-y-auto">
            <SteamRaffleResult
              :game="winner"
              @again="start"
              @exclude-and-again="excludeWinnerAndAgain"
              @back-to-filters="phase = 'filters'"
            />
          </div>
        </div>

        <!-- Footer -->
        <div
          v-if="phase === 'filters'"
          class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border-default"
        >
          <p id="raffle-empty-hint" class="text-xs text-text-muted">
            {{ canRaffle ? '' : 'No hay juegos con estos filtros' }}
          </p>
          <button
            type="button"
            :disabled="!canRaffle"
            aria-describedby="raffle-empty-hint"
            class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 bg-neon-cyan/10 rounded-lg hover:bg-neon-cyan/20 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            @click="start"
          >
            Sortear
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
