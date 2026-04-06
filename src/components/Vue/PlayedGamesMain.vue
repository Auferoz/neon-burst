<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import PlayedGamesCard from './PlayedGamesCard.vue';
import PlayedGamesFilter from './PlayedGamesFilter.vue';
import PlayedGamesDashboard from './PlayedGamesDashboard.vue';
import PlayedGamesFormModal from './PlayedGamesFormModal.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconClock from '../Icons/IconClock.vue';
import IconTrophy from '../Icons/IconTrophy.vue';
import IconPlusCircle from '../Icons/IconPlusCircle.vue';
import IconLibrary from '../Icons/IconLibrary.vue';
import IconRocket from '../Icons/IconRocket.vue';

interface Game {
  id: number;
  title: string;
  released: string;
  companie: string;
  poster: string;
  trailer: string;
  artworks: string;
  genre: string;
  estado: string;
  horas_total: number;
  logros_obt: number;
  logros_total: number;
  console_pc: string;
  igdb_id: number | null;
  first_year_played: number | null;
  years_played: number[];
  description: string;
  latest_fecha_inicio: string;
}

const currentYear = new Date().getFullYear();

const games = ref<Game[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const selectedAño = ref(String(currentYear));
const selectedEstado = ref('');
const selectedPlataforma = ref('');

const años = computed(() =>
  [...new Set(games.value.flatMap(g => g.years_played))].sort((a, b) => b - a)
);

const estados = computed(() =>
  [...new Set(games.value.map(g => g.estado))].sort()
);

const plataformas = computed(() =>
  [...new Set(games.value.map(g => g.console_pc))].sort()
);

const filteredGames = computed(() => {
  let result = games.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.companie.toLowerCase().includes(q) ||
      g.genre.toLowerCase().includes(q)
    );
  }

  if (selectedAño.value) {
    const year = Number(selectedAño.value);
    result = result.filter(g => g.years_played.includes(year));
  }

  if (selectedEstado.value) {
    result = result.filter(g => g.estado === selectedEstado.value);
  }

  if (selectedPlataforma.value) {
    result = result.filter(g => g.console_pc === selectedPlataforma.value);
  }

  return [...result].sort((a, b) => {
    const dateA = parseFecha(a.latest_fecha_inicio);
    const dateB = parseFecha(b.latest_fecha_inicio);
    return dateB - dateA;
  });
});

function parseFecha(fecha: string): number {
  if (!fecha) return 0;
  const parts = fecha.split('/');
  if (parts.length === 3) {
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
  }
  return 0;
}

async function fetchGames() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/games');
    if (!res.ok) throw new Error('Error al cargar los juegos');
    games.value = await res.json();

    // If no games for current year, show all
    if (selectedAño.value && !games.value.some(g => g.years_played.includes(currentYear))) {
      selectedAño.value = '';
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const showCreateModal = ref(false);
const showReplayPicker = ref(false);
const showReplayModal = ref(false);
const replayGame = ref<Record<string, unknown> | null>(null);
const replaySearch = ref('');
const replayLoading = ref(false);

const replayFilteredGames = computed(() => {
  if (!replaySearch.value) return games.value;
  const q = replaySearch.value.toLowerCase();
  return games.value.filter(g => g.title.toLowerCase().includes(q));
});

async function selectReplay(game: Game) {
  replayLoading.value = true;
  try {
    const res = await fetch(`/api/games/${game.id}`);
    if (!res.ok) throw new Error();
    const full = await res.json();
    // Add empty date entry for the new replay session
    full.dates_played = full.dates_played || [];
    full.dates_played.push({ year: currentYear, fecha_inicio: '', fecha_final: '', horas: '' });
    full.estado = 'Jugando';
    replayGame.value = full;
    showReplayPicker.value = false;
    replaySearch.value = '';
    showReplayModal.value = true;
  } catch {
    // fallback: just close
    showReplayPicker.value = false;
  } finally {
    replayLoading.value = false;
  }
}

function onReplaySaved() {
  replayGame.value = null;
  fetchGames();
}

function onGameCreated() {
  fetchGames();
}

onMounted(fetchGames);
</script>

<template>
  <div class="space-y-6">
    <!-- Header + Dashboard -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
      <!-- Title + Totals -->
      <div class="shrink-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl sm:text-2xl font-bold text-neon-blue neon-glow-blue leading-tight">played_games</h1>
        </div>
        <p class="text-text-secondary text-sm leading-relaxed">Historial de juegos completados, abandonados y en progreso</p>

        <!-- Totals inline -->
        <div v-if="!loading && games.length > 0" class="flex items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
          <span class="inline-flex items-center gap-1">
            <IconGrid :size="14" class="text-neon-cyan" />
            <span class="text-neon-cyan font-semibold">{{ games.length }}</span> juegos
          </span>
          <span class="text-surface-4" aria-hidden="true">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconClock :size="14" class="text-neon-blue" />
            <span class="text-neon-blue font-semibold">{{ Math.round(games.reduce((s, g) => s + (g.horas_total || 0), 0)).toLocaleString() }}h</span> jugadas
          </span>
          <span class="text-surface-4" aria-hidden="true">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconTrophy :size="14" class="text-neon-green" />
            <span class="text-neon-green font-semibold">{{ games.reduce((s, g) => s + (g.logros_obt || 0), 0).toLocaleString() }}</span> logros
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 mt-4">
          <button
            @click="showCreateModal = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors cursor-pointer"
          >
            <IconPlusCircle :size="14" />
            Agregar juego
          </button>
          <button
            @click="showReplayPicker = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/10 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
            </svg>
            Rejugar
          </button>
          <a
            href="/mySteamGames"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors"
          >
            <IconLibrary :size="14" />
            Steam
          </a>
          <a
            href="/nextGames"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors"
          >
            <IconRocket :size="14" />
            Próximos
          </a>
        </div>

      </div>


      <!-- Stats -->
      <PlayedGamesDashboard v-if="!loading && games.length > 0" :games="games" />
    </div>

    <!-- Separacion entre header y filtros -->
    <div class="h-px bg-linear-to-r from-neon-blue/40 via-neon-cyan/20 to-transparent my-4"></div>

    <!-- Filters -->
    <PlayedGamesFilter
      v-if="!loading && games.length > 0"
      :años="años"
      :estados="estados"
      :plataformas="plataformas"
      v-model:search-query="searchQuery"
      v-model:selected-año="selectedAño"
      v-model:selected-estado="selectedEstado"
      v-model:selected-plataforma="selectedPlataforma"
      :total-games="games.length"
      :filtered-count="filteredGames.length"
    />

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-blue/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-blue font-medium animate-pulse" role="status">[ Cargando juegos... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        @click="fetchGames"
        class="mt-4 px-4 py-2 text-xs text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors duration-200 cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="games.length === 0" class="border border-dashed border-neon-blue/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-blue font-medium mb-3">[ Sin juegos ]</div>
      <p class="text-text-secondary text-xs">No hay juegos registrados en la base de datos.</p>
    </div>

    <!-- No results for filters -->
    <div v-else-if="filteredGames.length === 0" class="border border-dashed border-neon-blue/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Games grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Juegos jugados">
      <PlayedGamesCard
        v-for="game in filteredGames"
        :key="game.id"
        :game="game"
      />
    </div>

    <!-- Create modal -->
    <PlayedGamesFormModal
      :open="showCreateModal"
      @close="showCreateModal = false"
      @saved="onGameCreated"
    />

    <!-- Replay picker modal -->
    <Teleport to="body">
      <div
        v-if="showReplayPicker"
        id="replay-backdrop"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
        @mousedown.self="showReplayPicker = false; replaySearch = ''"
      >
        <div
          class="relative w-full max-w-md bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar juego para rejugar"
        >
          <div class="flex items-center justify-between p-5 border-b border-border-default">
            <h2 class="text-lg font-bold text-text-primary">Rejugar juego</h2>
            <button
              @click="showReplayPicker = false; replaySearch = ''"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="p-5">
            <input
              v-model="replaySearch"
              type="text"
              placeholder="Buscar juego..."
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20 transition-colors mb-3"
              autofocus
            />

            <div class="max-h-80 overflow-y-auto space-y-1">
              <button
                v-for="g in replayFilteredGames"
                :key="g.id"
                @click="selectReplay(g)"
                :disabled="replayLoading"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <img
                  v-if="g.poster"
                  :src="`https://images.igdb.com/igdb/image/upload/t_cover_small/${g.poster}.webp`"
                  :alt="g.title"
                  class="w-8 h-10 rounded object-cover bg-surface-3 shrink-0"
                />
                <div v-else class="w-8 h-10 rounded bg-surface-3 shrink-0" />
                <div class="min-w-0">
                  <div class="text-sm font-medium text-text-primary truncate">{{ g.title }}</div>
                  <div class="text-[11px] text-text-muted">
                    {{ g.console_pc }} · {{ g.estado }}
                    <span v-if="g.years_played.length" class="text-text-muted"> · {{ g.years_played.join(', ') }}</span>
                  </div>
                </div>
              </button>
              <div v-if="replayFilteredGames.length === 0" class="text-xs text-text-muted text-center py-4">
                Sin resultados
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Replay edit modal -->
    <PlayedGamesFormModal
      :open="showReplayModal"
      :game="replayGame as any"
      @close="showReplayModal = false; replayGame = null"
      @saved="onReplaySaved"
    />
  </div>
</template>
