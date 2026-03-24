<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import SeriesCard from './SeriesCard.vue';
import SeriesFormModal from './SeriesFormModal.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconClock from '../Icons/IconClock.vue';
import IconStar from '../Icons/IconStar.vue';

interface SeriesEntry {
  id: number;
  trakt_slug: string;
  season_number: number;
  year_watched: number;
  platform: string;
  status_viewed: string;
  title: string;
  year: number;
  overview: string;
  rating: number;
  genres: string;
  network: string;
  runtime: number;
  poster: string;
  tmdb_id: number;
  imdb_id: string;
}

const series = ref<SeriesEntry[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const filterYear = ref(String(new Date().getFullYear()));
const filterPlatform = ref('');
const filterStatus = ref('');

// Modal state
const showModal = ref(false);
const editEntry = ref<any>(null);

// Unique years from year_watched, sorted desc
const allYears = computed(() => {
  const years = new Set<number>();
  for (const s of series.value) years.add(s.year_watched);
  return [...years].sort((a, b) => b - a);
});

// Unique platforms
const allPlatforms = computed(() => {
  const platforms = new Set<string>();
  for (const s of series.value) {
    if (s.platform) platforms.add(s.platform.charAt(0).toUpperCase() + s.platform.slice(1).toLowerCase());
  }
  return [...platforms].sort();
});

const filteredSeries = computed(() => {
  let result = series.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(s => (s.title || s.trakt_slug).toLowerCase().includes(q));
  }

  if (filterYear.value) {
    result = result.filter(s => s.year_watched === Number(filterYear.value));
  }

  if (filterPlatform.value) {
    const p = filterPlatform.value.toLowerCase();
    result = result.filter(s => s.platform?.toLowerCase() === p);
  }

  if (filterStatus.value) {
    result = result.filter(s => s.status_viewed === filterStatus.value);
  }

  return result;
});

// Global stats
const totalSeasons = computed(() => series.value.length);
const uniqueShows = computed(() => new Set(series.value.map(s => s.trakt_slug)).size);
const avgRating = computed(() => {
  const rated = series.value.filter(s => s.rating > 0);
  if (!rated.length) return 0;
  return Math.round((rated.reduce((sum, s) => sum + s.rating, 0) / rated.length) * 10) / 10;
});
const totalPlatforms = computed(() => allPlatforms.value.length);

// Filtered stats
const filteredTotalSeasons = computed(() => filteredSeries.value.length);
const filteredUniqueShows = computed(() => new Set(filteredSeries.value.map(s => s.trakt_slug)).size);
const filteredAvgRating = computed(() => {
  const rated = filteredSeries.value.filter(s => s.rating > 0);
  if (!rated.length) return 0;
  return Math.round((rated.reduce((sum, s) => sum + s.rating, 0) / rated.length) * 10) / 10;
});
const filteredTotalPlatforms = computed(() => {
  const platforms = new Set<string>();
  for (const s of filteredSeries.value) {
    if (s.platform) platforms.add(s.platform.toLowerCase());
  }
  return platforms.size;
});

const defaultYear = String(new Date().getFullYear());
const hasActiveFilters = computed(() =>
  searchQuery.value !== '' || filterYear.value !== defaultYear || filterPlatform.value !== '' || filterStatus.value !== ''
);

async function fetchSeries() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/series');
    if (!res.ok) throw new Error('Error al cargar series');
    series.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  editEntry.value = null;
  showModal.value = true;
}

function openEdit(entry: SeriesEntry) {
  editEntry.value = {
    id: entry.id,
    trakt_slug: entry.trakt_slug,
    season_number: entry.season_number,
    year_watched: entry.year_watched,
    platform: entry.platform,
    status_viewed: entry.status_viewed,
  };
  showModal.value = true;
}

function onSaved() {
  fetchSeries();
}

onMounted(fetchSeries);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-bold text-neon-indigo leading-tight">series</h1>
          <button
            @click="openAdd"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-indigo border border-neon-indigo/30 rounded-lg hover:bg-neon-indigo/10 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Agregar
          </button>
        </div>
        <p class="text-text-secondary text-sm leading-relaxed mt-1">Lista de series vistas por año</p>

        <!-- Global stats -->
        <div v-if="!loading && series.length > 0" class="flex flex-wrap items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
          <span class="inline-flex items-center gap-1">
            <IconGrid :size="14" class="text-neon-indigo" />
            <span class="text-neon-indigo font-semibold">{{ totalSeasons }}</span> temporadas
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconClock :size="14" class="text-neon-indigo" />
            <span class="text-neon-indigo font-semibold">{{ uniqueShows }}</span> series
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconStar :size="14" class="text-neon-indigo" />
            <span class="text-neon-indigo font-semibold">{{ avgRating }}</span> rating
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <span class="text-neon-indigo font-semibold">{{ totalPlatforms }}</span> plataformas
          </span>
        </div>
      </div>

      <!-- Mini stats cards (right side) -->
      <div
        v-if="!loading && filteredSeries.length > 0"
        class="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:shrink-0"
        role="list"
        aria-label="Resumen de estadísticas"
      >
        <div role="listitem" :aria-label="`${filteredTotalSeasons} temporadas`" class="bg-neon-indigo/10 border-neon-indigo/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-indigo shrink-0" aria-hidden="true">
            <IconGrid :size="20" />
          </div>
          <div class="min-w-0">
            <div class="text-neon-indigo text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredTotalSeasons }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Temporadas</div>
          </div>
        </div>
        <div role="listitem" :aria-label="`${filteredUniqueShows} series únicas`" class="bg-neon-cyan/10 border-neon-cyan/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-cyan shrink-0" aria-hidden="true">
            <IconClock :size="20" />
          </div>
          <div class="min-w-0">
            <div class="text-neon-cyan text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredUniqueShows }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Series</div>
          </div>
        </div>
        <div role="listitem" :aria-label="`Rating promedio ${filteredAvgRating}`" class="bg-neon-yellow/10 border-neon-yellow/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-yellow shrink-0" aria-hidden="true">
            <IconStar :size="20" />
          </div>
          <div class="min-w-0">
            <div class="text-neon-yellow text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredAvgRating }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Rating</div>
          </div>
        </div>
        <div role="listitem" :aria-label="`${filteredTotalPlatforms} plataformas`" class="bg-neon-pink/10 border-neon-pink/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-pink shrink-0" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-neon-pink text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredTotalPlatforms }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Plataformas</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-linear-to-r from-neon-indigo/40 via-neon-indigo/20 to-transparent"></div>

    <!-- Filters -->
    <div v-if="!loading && series.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar serie..."
          aria-label="Buscar serie por nombre"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-indigo/40 transition-colors w-full sm:w-64"
        />
        <select
          v-model="filterYear"
          aria-label="Filtrar por año visto"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-indigo/40 transition-colors cursor-pointer"
        >
          <option value="">Todos los años</option>
          <option v-for="y in allYears" :key="y" :value="String(y)">{{ y }}</option>
        </select>
        <select
          v-model="filterPlatform"
          aria-label="Filtrar por plataforma"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-indigo/40 transition-colors cursor-pointer"
        >
          <option value="">Todas las plataformas</option>
          <option v-for="p in allPlatforms" :key="p" :value="p.toLowerCase()">{{ p }}</option>
        </select>
        <select
          v-model="filterStatus"
          aria-label="Filtrar por estado"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-indigo/40 transition-colors cursor-pointer"
        >
          <option value="">Todos los estados</option>
          <option value="completed">Completed</option>
          <option value="ongoing">Ongoing</option>
        </select>
        <span class="text-[11px] text-text-secondary ml-auto">
          <template v-if="hasActiveFilters">
            {{ filteredTotalSeasons }} de {{ totalSeasons }}
          </template>
          <template v-else>
            {{ totalSeasons }} temporadas
          </template>
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-indigo/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-indigo font-medium animate-pulse" role="status">[ Cargando series... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        @click="fetchSeries"
        class="mt-4 px-4 py-2 text-xs text-neon-indigo border border-neon-indigo/30 rounded-lg hover:bg-neon-indigo/10 transition-colors cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="filteredSeries.length === 0 && series.length > 0" class="border border-dashed border-neon-indigo/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Empty state -->
    <div v-else-if="series.length === 0" class="border border-dashed border-neon-indigo/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-indigo font-medium mb-2">[ Sin datos ]</div>
      <p class="text-text-secondary text-xs">Agrega tu primera serie con el botón "Agregar"</p>
    </div>

    <!-- Series grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list" aria-label="Lista de series">
      <div v-for="s in filteredSeries" :key="s.id" role="listitem">
        <SeriesCard :series="s" @edit="openEdit" />
      </div>
    </div>

    <!-- Form Modal -->
    <SeriesFormModal
      :open="showModal"
      :entry="editEntry"
      @close="showModal = false"
      @saved="onSaved"
    />
  </div>
</template>
