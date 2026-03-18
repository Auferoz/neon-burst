<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import GameCard from './GameCard.vue';
import GamesFilter from './GamesFilter.vue';
import GamesDashboard from './GamesDashboard.vue';
import GameFormModal from './GameFormModal.vue';

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

  return result;
});

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

function onGameCreated() {
  fetchGames();
}

onMounted(fetchGames);
</script>

<template>
  <div class="space-y-6">
    <!-- Header + Dashboard -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
      <!-- Title -->
      <div class="shrink-0">
        <div class="flex items-center gap-3 mb-1">
          <span class="w-2 h-2 rounded-full bg-neon-blue shrink-0" aria-hidden="true"></span>
          <h1 class="text-xl sm:text-2xl font-bold text-neon-blue neon-glow-blue leading-tight">played_games</h1>
        </div>
        <p class="text-text-secondary text-sm leading-relaxed pl-5">Historial de juegos completados, abandonados y en progreso</p>
        <button
          @click="showCreateModal = true"
          class="mt-2 ml-5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Agregar juego
        </button>
      </div>

      <!-- Stats -->
      <GamesDashboard v-if="!loading && games.length > 0" :games="games" />
    </div>

    <!-- Separacion entre header y filtros -->
    <div class="h-px bg-linear-to-r from-neon-blue/40 via-neon-cyan/20 to-transparent my-4"></div>

    <!-- Filters -->
    <GamesFilter
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
      <div class="text-sm text-neon-blue/60 font-medium animate-pulse">[ Cargando juegos... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink/60 font-medium mb-2">[ Error ]</div>
      <p class="text-text-muted text-xs">{{ error }}</p>
      <button
        @click="fetchGames"
        class="mt-4 px-4 py-2 text-xs text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors duration-200 cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="games.length === 0" class="border border-dashed border-neon-blue/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-blue/60 font-medium mb-3">[ Sin juegos ]</div>
      <p class="text-text-muted text-xs">No hay juegos registrados en la base de datos.</p>
    </div>

    <!-- No results for filters -->
    <div v-else-if="filteredGames.length === 0" class="border border-dashed border-neon-blue/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-muted font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Games grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <GameCard
        v-for="game in filteredGames"
        :key="game.id"
        :game="game"
      />
    </div>

    <!-- Create modal -->
    <GameFormModal
      :open="showCreateModal"
      @close="showCreateModal = false"
      @saved="onGameCreated"
    />
  </div>
</template>
