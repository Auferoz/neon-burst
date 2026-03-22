<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import MoviesCard from './MoviesCard.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconClock from '../Icons/IconClock.vue';
import IconStar from '../Icons/IconStar.vue';

interface Movie {
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  list_slug: string;
}

const movies = ref<Movie[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const filterYear = ref(String(new Date().getFullYear()));
const filterGenre = ref('');

// Extract unique years from list_slug (movies-YYYY → YYYY), sorted desc
const allYears = computed(() => {
  const years = new Set<string>();
  for (const m of movies.value) {
    if (m.list_slug) {
      const year = m.list_slug.replace('movies-', '');
      if (year) years.add(year);
    }
  }
  return [...years].sort((a, b) => Number(b) - Number(a));
});

// Extract unique genres from all movies
const allGenres = computed(() => {
  const genres = new Set<string>();
  for (const m of movies.value) {
    if (m.genres) {
      for (const g of m.genres.split(',')) {
        const trimmed = g.trim();
        if (trimmed) genres.add(trimmed);
      }
    }
  }
  return [...genres].sort();
});

const filteredMovies = computed(() => {
  let result = movies.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(m => m.title.toLowerCase().includes(q));
  }

  if (filterYear.value) {
    const slug = `movies-${filterYear.value}`;
    result = result.filter(m => m.list_slug === slug);
  }

  if (filterGenre.value) {
    const genre = filterGenre.value.toLowerCase();
    result = result.filter(m =>
      m.genres?.toLowerCase().split(',').map(g => g.trim()).includes(genre)
    );
  }

  return result;
});

// Global stats
const totalMovies = computed(() => movies.value.length);
const totalHours = computed(() => Math.round(movies.value.reduce((s, m) => s + (m.runtime || 0), 0) / 60));
const avgRating = computed(() => {
  const rated = movies.value.filter(m => m.rating > 0);
  if (!rated.length) return 0;
  return Math.round((rated.reduce((s, m) => s + m.rating, 0) / rated.length) * 10) / 10;
});
const totalGenres = computed(() => allGenres.value.length);

// Filtered stats
const filteredTotalMovies = computed(() => filteredMovies.value.length);
const filteredTotalHours = computed(() => Math.round(filteredMovies.value.reduce((s, m) => s + (m.runtime || 0), 0) / 60));
const filteredAvgRating = computed(() => {
  const rated = filteredMovies.value.filter(m => m.rating > 0);
  if (!rated.length) return 0;
  return Math.round((rated.reduce((s, m) => s + m.rating, 0) / rated.length) * 10) / 10;
});
const filteredTotalGenres = computed(() => {
  const genres = new Set<string>();
  for (const m of filteredMovies.value) {
    if (m.genres) {
      for (const g of m.genres.split(',')) {
        const trimmed = g.trim();
        if (trimmed) genres.add(trimmed);
      }
    }
  }
  return genres.size;
});

const defaultYear = String(new Date().getFullYear());
const hasActiveFilters = computed(() =>
  searchQuery.value !== '' || filterYear.value !== defaultYear || filterGenre.value !== ''
);

async function fetchMovies() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/movies');
    if (!res.ok) throw new Error('Error al cargar películas');
    movies.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchMovies);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-neon-emerald neon-glow-emerald leading-tight">movies</h1>
        <p class="text-text-secondary text-sm leading-relaxed mt-1">Lista de películas vistas por año</p>

        <!-- Global stats -->
        <div v-if="!loading && movies.length > 0" class="flex items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
          <span class="inline-flex items-center gap-1">
            <IconGrid :size="14" class="text-neon-emerald" />
            <span class="text-neon-emerald font-semibold">{{ totalMovies }}</span> películas
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconClock :size="14" class="text-neon-emerald" />
            <span class="text-neon-emerald font-semibold">{{ totalHours.toLocaleString() }}h</span> vistas
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconStar :size="14" class="text-neon-emerald" />
            <span class="text-neon-emerald font-semibold">{{ avgRating }}</span> rating
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <span class="text-neon-emerald font-semibold">{{ totalGenres }}</span> géneros
          </span>
        </div>
      </div>

      <!-- Mini stats cards (right side) -->
      <div
        v-if="!loading && filteredMovies.length > 0"
        class="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:shrink-0"
        role="list"
        aria-label="Resumen de estadísticas"
      >
        <div role="listitem" :aria-label="`${filteredTotalMovies} películas`" class="bg-neon-emerald/10 border-neon-emerald/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-emerald shrink-0" aria-hidden="true">
            <IconGrid :size="20" />
          </div>
          <div class="min-w-0">
            <div class="text-neon-emerald text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredTotalMovies }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Películas</div>
          </div>
        </div>
        <div role="listitem" :aria-label="`${filteredTotalHours} horas vistas`" class="bg-neon-cyan/10 border-neon-cyan/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-cyan shrink-0" aria-hidden="true">
            <IconClock :size="20" />
          </div>
          <div class="min-w-0">
            <div class="text-neon-cyan text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredTotalHours }}h</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Vistas</div>
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
        <div role="listitem" :aria-label="`${filteredTotalGenres} géneros`" class="bg-neon-pink/10 border-neon-pink/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden">
          <div class="text-neon-pink shrink-0" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          </div>
          <div class="min-w-0">
            <div class="text-neon-pink text-lg lg:text-xl font-bold leading-none mb-0.5">{{ filteredTotalGenres }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Géneros</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-linear-to-r from-neon-emerald/40 via-neon-emerald/20 to-transparent"></div>


    <!-- Filters -->
    <div v-if="!loading && movies.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar película..."
          aria-label="Buscar película por nombre"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-emerald/40 transition-colors w-full sm:w-64"
        />
        <select
          v-model="filterYear"
          aria-label="Filtrar por año visto"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-emerald/40 transition-colors cursor-pointer"
        >
          <option value="">Todos los años</option>
          <option v-for="y in allYears" :key="y" :value="y">{{ y }}</option>
        </select>
        <select
          v-model="filterGenre"
          aria-label="Filtrar por género"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-emerald/40 transition-colors cursor-pointer"
        >
          <option value="">Todos los géneros</option>
          <option v-for="g in allGenres" :key="g" :value="g">{{ g }}</option>
        </select>
        <span class="text-[11px] text-text-secondary ml-auto">
          <template v-if="hasActiveFilters">
            {{ filteredTotalMovies }} de {{ totalMovies }}
          </template>
          <template v-else>
            {{ totalMovies }} películas
          </template>
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-emerald/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-emerald font-medium animate-pulse" role="status">[ Conectando con Trakt... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        @click="fetchMovies"
        class="mt-4 px-4 py-2 text-xs text-neon-emerald border border-neon-emerald/30 rounded-lg hover:bg-neon-emerald/10 transition-colors cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="filteredMovies.length === 0 && movies.length > 0" class="border border-dashed border-neon-emerald/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Empty state -->
    <div v-else-if="movies.length === 0" class="border border-dashed border-neon-emerald/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-emerald font-medium mb-2">[ Sin datos ]</div>
      <p class="text-text-secondary text-xs">Ejecuta el sync para cargar películas desde Trakt</p>
    </div>

    <!-- Movies grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list" aria-label="Lista de películas">
      <div v-for="movie in filteredMovies" :key="movie.trakt_id" role="listitem">
        <MoviesCard :movie="movie" />
      </div>
    </div>
  </div>
</template>
