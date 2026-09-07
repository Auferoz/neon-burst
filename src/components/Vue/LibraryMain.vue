<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import LibraryCard from './LibraryCard.vue';
import LibraryFormModal from './LibraryFormModal.vue';
import LibraryImportModal from './LibraryImportModal.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconLibrary from '../Icons/IconLibrary.vue';
import { STORES } from '../../data/stores';

interface LibraryGame {
  id: number;
  title: string;
  store: string;
  igdb_id: number | null;
  poster: string;
  artworks: string;
  released: string;
  companie: string;
  genre: string;
  description: string;
  trailer: string;
  store_url: string;
  owned_via: string;
  notes: string;
}

const games = ref<LibraryGame[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const selectedStore = ref('');
const sortBy = ref<'title' | 'released' | 'recent'>('title');

const formOpen = ref(false);
const importOpen = ref(false);
const editing = ref<LibraryGame | null>(null);

/** Only the stores that actually have games, so the filter never offers dead options. */
const activeStores = computed(() => {
  const present = new Set(games.value.map((g) => g.store));
  return STORES.filter((s) => present.has(s));
});

const countByStore = computed(() => {
  const counts: Record<string, number> = {};
  for (const g of games.value) counts[g.store] = (counts[g.store] ?? 0) + 1;
  return counts;
});

/** DD/MM/YYYY -> timestamp, 0 when empty or unparsable. Same convention as playedGames. */
function parseFecha(fecha: string): number {
  if (!fecha) return 0;
  const [d, m, y] = fecha.split('/');
  const time = new Date(`${y}-${m}-${d}`).getTime();
  return Number.isNaN(time) ? 0 : time;
}

const filteredGames = computed(() => {
  let result = games.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.companie.toLowerCase().includes(q) ||
        g.genre.toLowerCase().includes(q),
    );
  }

  if (selectedStore.value) {
    result = result.filter((g) => g.store === selectedStore.value);
  }

  return [...result].sort((a, b) => {
    if (sortBy.value === 'title') return a.title.localeCompare(b.title);
    if (sortBy.value === 'released') return parseFecha(b.released) - parseFecha(a.released);
    return b.id - a.id;
  });
});

async function fetchGames(force = false) {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/library', force ? { cache: 'no-store' } : {});
    if (!res.ok) throw new Error('Error al cargar la biblioteca');
    games.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(game: LibraryGame) {
  editing.value = game;
  formOpen.value = true;
}

async function removeGame(game: LibraryGame) {
  if (!window.confirm(`Borrar "${game.title}" de ${game.store}?`)) return;
  const res = await fetch(`/api/library/${game.id}`, { method: 'DELETE' });
  if (res.ok) {
    games.value = games.value.filter((g) => g.id !== game.id);
  } else {
    const data = await res.json().catch(() => ({}));
    error.value = (data as any).error || 'No se pudo borrar';
  }
}

onMounted(() => fetchGames());
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl sm:text-2xl font-bold text-neon-yellow leading-tight">
          game_library
        </h1>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-yellow"
          @click="openCreate"
        >+ Añadir</button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border-default rounded-lg hover:text-neon-yellow hover:border-neon-yellow/30 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-yellow"
          @click="importOpen = true"
        >Importar lista</button>
      </div>

      <p class="text-text-secondary text-sm leading-relaxed mt-1">
        Juegos que poseo fuera de Steam — Epic, GOG, EA, Ubisoft, Xbox y compañía
      </p>

      <div
        v-if="!loading && games.length > 0"
        class="flex flex-wrap items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary"
      >
        <span class="inline-flex items-center gap-1">
          <IconGrid :size="14" class="text-neon-yellow" />
          <span class="text-neon-yellow font-semibold">{{ games.length }}</span> juegos
        </span>
        <span class="inline-flex items-center gap-1">
          <IconLibrary :size="14" class="text-neon-yellow" />
          <span class="text-neon-yellow font-semibold">{{ activeStores.length }}</span> tiendas
        </span>
      </div>

      <!-- Cross-nav -->
      <div class="flex flex-wrap items-center gap-2 mt-4">
        <a
          href="/mySteamGames"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors"
        >Biblioteca de Steam →</a>
        <a
          href="/playedGames"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors"
        >Jugados →</a>
      </div>
    </div>

    <div class="h-px bg-linear-to-r from-neon-yellow/40 via-neon-yellow/20 to-transparent"></div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Buscar juego..."
        aria-label="Buscar juego"
        class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-neon-yellow/40 focus-visible:outline-none transition-colors"
      />
      <select
        v-model="selectedStore"
        aria-label="Filtrar por tienda"
        class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none transition-colors"
      >
        <option value="">Todas las tiendas</option>
        <option v-for="s in activeStores" :key="s" :value="s">
          {{ s }} ({{ countByStore[s] }})
        </option>
      </select>
      <select
        v-model="sortBy"
        aria-label="Ordenar"
        class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none transition-colors"
      >
        <option value="title">Título (A-Z)</option>
        <option value="released">Lanzamiento</option>
        <option value="recent">Añadidos recientemente</option>
      </select>
      <span class="ml-auto text-xs text-text-muted">
        {{ filteredGames.length }} de {{ games.length }}
      </span>
    </div>

    <!-- States -->
    <div
      v-if="loading"
      class="border border-dashed border-neon-yellow/20 rounded-xl p-10 sm:p-14 text-center text-text-muted text-sm animate-pulse"
    >Cargando biblioteca...</div>

    <div
      v-else-if="error"
      class="border border-dashed border-neon-pink/20 rounded-xl p-10 text-center"
      role="alert"
    >
      <p class="text-neon-pink text-sm mb-3">{{ error }}</p>
      <button
        type="button"
        class="text-xs px-3 py-1.5 border border-neon-pink/30 rounded-lg text-neon-pink hover:bg-neon-pink/10 transition-colors cursor-pointer"
        @click="fetchGames(true)"
      >Reintentar</button>
    </div>

    <div
      v-else-if="games.length === 0"
      class="border border-dashed border-neon-yellow/20 rounded-xl p-10 sm:p-14 text-center"
    >
      <p class="text-text-secondary text-sm mb-2">Todavía no hay juegos en la biblioteca.</p>
      <p class="text-text-muted text-xs">
        Estas tiendas no tienen API pública, así que la carga es manual.
        Usá <strong class="text-neon-yellow">Importar lista</strong> para cargar muchos de una.
      </p>
    </div>

    <div
      v-else-if="filteredGames.length === 0"
      class="border border-dashed border-neon-yellow/20 rounded-xl p-10 text-center text-text-muted text-sm"
    >Ningún juego coincide con el filtro.</div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
      <LibraryCard
        v-for="game in filteredGames"
        :key="game.id"
        :game="game"
        @edit="openEdit"
        @remove="removeGame"
      />
    </div>

    <LibraryFormModal
      :open="formOpen"
      :game="editing"
      @close="formOpen = false"
      @saved="fetchGames(true)"
    />
    <LibraryImportModal
      :open="importOpen"
      @close="importOpen = false"
      @imported="fetchGames(true)"
    />
  </div>
</template>
