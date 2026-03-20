<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import NextGamesCard from './NextGamesCard.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconCalendar from '../Icons/IconCalendar.vue';

interface NextGame {
  id: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  cover: string;
  bgImage: string;
  releaseDate: number;
  platforms: string[];
  steamUrl: string;
  hypes: number;
  follows: number;
}

const games = ref<NextGame[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const selectedMonth = ref(String(new Date().getMonth()));
const filterType = ref<'all' | 'upcoming' | 'released' | 'featured'>('all');

// Featured games stored in D1 database
const featuredIds = ref<Set<number>>(new Set());

async function loadFeatured() {
  try {
    const res = await fetch('/api/next-games/featured');
    if (res.ok) {
      const ids: number[] = await res.json();
      featuredIds.value = new Set(ids);
    }
  } catch { /* ignore */ }
}

async function toggleFeatured(id: number) {
  // Optimistic update
  const was = featuredIds.value.has(id);
  if (was) {
    featuredIds.value.delete(id);
  } else {
    featuredIds.value.add(id);
  }
  featuredIds.value = new Set(featuredIds.value);

  try {
    const res = await fetch('/api/next-games/featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ igdb_id: id }),
    });
    if (!res.ok) throw new Error();
  } catch {
    // Revert on error
    if (was) {
      featuredIds.value.add(id);
    } else {
      featuredIds.value.delete(id);
    }
    featuredIds.value = new Set(featuredIds.value);
  }
}

const now = Date.now() / 1000;

const allMonths = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' },
];

// Count games per month for the badge
const gamesPerMonth = computed(() => {
  const counts: Record<number, number> = {};
  for (const g of games.value) {
    if (g.releaseDate) {
      const m = new Date(g.releaseDate * 1000).getMonth();
      counts[m] = (counts[m] || 0) + 1;
    }
  }
  return counts;
});

const filteredGames = computed(() => {
  let result = games.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.developer?.toLowerCase().includes(q) ||
      g.genres?.toLowerCase().includes(q)
    );
  }

  if (selectedMonth.value !== '') {
    const month = Number(selectedMonth.value);
    result = result.filter(g => {
      if (!g.releaseDate) return false;
      return new Date(g.releaseDate * 1000).getMonth() === month;
    });
  }

  if (filterType.value === 'upcoming') {
    result = result.filter(g => g.releaseDate > now);
  } else if (filterType.value === 'released') {
    result = result.filter(g => g.releaseDate <= now);
  } else if (filterType.value === 'featured') {
    result = result.filter(g => featuredIds.value.has(g.id));
  }

  return result;
});

const upcomingCount = computed(() => games.value.filter(g => g.releaseDate > now).length);
const releasedCount = computed(() => games.value.filter(g => g.releaseDate <= now).length);
const featuredCount = computed(() => games.value.filter(g => featuredIds.value.has(g.id)).length);

async function fetchGames() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/next-games');
    if (!res.ok) throw new Error('Error al cargar los próximos juegos');
    games.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadFeatured();
  fetchGames();
});

</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-neon-pink neon-glow-pink leading-tight">próximos_juegos</h1>
      <p class="text-text-secondary text-sm leading-relaxed mt-1">Lanzamientos del {{ new Date().getFullYear() }} que tienes en el radar</p>

      <!-- Totals -->
      <div v-if="!loading && games.length > 0" class="flex items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
        <span class="inline-flex items-center gap-1">
          <IconGrid :size="14" class="text-neon-pink" />
          <span class="text-neon-pink font-semibold">{{ games.length }}</span> juegos
        </span>
        <span class="text-surface-4" aria-hidden="true">&middot;</span>
        <span class="inline-flex items-center gap-1">
          <IconCalendar :size="14" class="text-neon-pink" />
          <span class="text-neon-pink font-semibold">{{ upcomingCount }}</span> por lanzar
        </span>
        <span class="text-surface-4" aria-hidden="true">&middot;</span>
        <span class="inline-flex items-center gap-1">
          <span class="text-neon-green font-semibold">{{ releasedCount }}</span> lanzados
        </span>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-linear-to-r from-neon-pink/40 via-neon-pink/20 to-transparent"></div>

    <!-- Filters -->
    <div v-if="!loading && games.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar juego, developer, género..."
          aria-label="Buscar juego por nombre, developer o género"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-pink/40 transition-colors w-full sm:w-64"
        />
        <select
          v-model="selectedMonth"
          aria-label="Filtrar por mes"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
        >
          <option value="">Todos los meses</option>
          <option v-for="m in allMonths" :key="m.value" :value="String(m.value)">
            {{ m.label }} ({{ gamesPerMonth[m.value] || 0 }})
          </option>
        </select>
        <select
          v-model="filterType"
          aria-label="Filtrar por estado"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="upcoming">Por lanzar</option>
          <option value="released">Lanzados</option>
        </select>
        <!-- Featured filter button -->
        <button
          @click="filterType = filterType === 'featured' ? 'all' : 'featured'"
          :aria-pressed="filterType === 'featured'"
          aria-label="Filtrar por destacados"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors cursor-pointer"
          :class="filterType === 'featured'
            ? 'text-neon-pink border-neon-pink/40 bg-neon-pink/10'
            : 'text-text-secondary border-border-default hover:text-neon-pink hover:border-neon-pink/30 hover:bg-neon-pink/5'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" :fill="filterType === 'featured' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/></svg>
          Destacados
          <span v-if="featuredCount > 0" class="text-neon-pink font-semibold">{{ featuredCount }}</span>
        </button>
        <span class="text-[11px] text-text-secondary ml-auto">
          {{ filteredGames.length }} de {{ games.length }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium animate-pulse" role="status">[ Escaneando lanzamientos... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        @click="fetchGames"
        class="mt-4 px-4 py-2 text-xs text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="games.length === 0" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-3">[ Sin juegos ]</div>
      <p class="text-text-secondary text-xs">No se encontraron próximos juegos para este año.</p>
    </div>

    <!-- No results -->
    <div v-else-if="filteredGames.length === 0" class="border border-dashed border-neon-pink/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Games grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Próximos juegos">
      <NextGamesCard
        v-for="game in filteredGames"
        :key="game.id"
        :game="game"
        :featured="featuredIds.has(game.id)"
        @toggle-featured="toggleFeatured"
      />
    </div>
  </div>
</template>
