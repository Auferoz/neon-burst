<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import LibraryCard from './LibraryCard.vue';
import LibraryFilters from './LibraryFilters.vue';
import LibraryFormModal from './LibraryFormModal.vue';
import LibraryImportModal from './LibraryImportModal.vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconLibrary from '../Icons/IconLibrary.vue';
import IconGamepad from '../Icons/IconGamepad.vue';
import IconRocket from '../Icons/IconRocket.vue';
import { STORES } from '../../data/stores';
import { buildGroups, type LibraryGame } from '../../utils/libraryGrouping';
import { filterAndSortGroups, type SortBy, type DataFilter } from '../../utils/libraryFilters';

const games = ref<LibraryGame[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const selectedStore = ref('');
const sortBy = ref<SortBy>('title');
const dataFilter = ref<DataFilter>('all');

const formOpen = ref(false);
const importOpen = ref(false);
const editing = ref<LibraryGame | null>(null);

/** One entry per game, carrying every store it is owned on. */
const groups = computed(() => buildGroups(games.value));

const incompleteCount = computed(() => groups.value.filter((g) => g.missing.length > 0).length);
const multiStoreCount = computed(() => groups.value.filter((g) => g.stores.length > 1).length);

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

const visibleGroups = computed(() =>
  filterAndSortGroups(groups.value, {
    search: searchQuery.value,
    store: selectedStore.value,
    data: dataFilter.value,
    sort: sortBy.value,
  }),
);

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

/** Jumps straight to the games that need manual checking. */
function showIncomplete() {
  dataFilter.value = 'incomplete';
  selectedStore.value = '';
  searchQuery.value = '';
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
          <span class="text-neon-yellow font-semibold">{{ groups.length }}</span> juegos
        </span>
        <span class="inline-flex items-center gap-1">
          <IconLibrary :size="14" class="text-neon-yellow" />
          <span class="text-neon-yellow font-semibold">{{ activeStores.length }}</span> tiendas
        </span>
        <span>
          <span class="text-neon-yellow font-semibold">{{ games.length }}</span> copias
        </span>
        <span v-if="multiStoreCount">
          <span class="text-neon-yellow font-semibold">{{ multiStoreCount }}</span> en varias tiendas
        </span>
        <button
          v-if="incompleteCount"
          type="button"
          class="inline-flex items-center gap-1 text-neon-pink hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-pink rounded"
          @click="showIncomplete"
        >
          ⚠ <span class="font-semibold">{{ incompleteCount }}</span> sin información
        </button>
      </div>

      <!-- Cross-nav -->
      <div class="flex flex-wrap items-center gap-2 mt-4">
        <a
          href="/playedGames"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors"
        >
          <IconGamepad :size="14" />
          Jugados
        </a>
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

    <div class="h-px bg-linear-to-r from-neon-yellow/40 via-neon-yellow/20 to-transparent"></div>

    <LibraryFilters
      v-model:search="searchQuery"
      v-model:store="selectedStore"
      v-model:sort="sortBy"
      v-model:data="dataFilter"
      :active-stores="activeStores"
      :count-by-store="countByStore"
      :incomplete-count="incompleteCount"
      :shown-count="visibleGroups.length"
      :total-count="groups.length"
    />

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
      v-else-if="visibleGroups.length === 0"
      class="border border-dashed border-neon-yellow/20 rounded-xl p-10 text-center text-text-muted text-sm"
    >Ningún juego coincide con el filtro.</div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
      <LibraryCard
        v-for="group in visibleGroups"
        :key="group.key"
        :group="group"
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
