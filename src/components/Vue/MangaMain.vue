<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import MangaCard from './MangaCard.vue';
import MangaFormModal from './MangaFormModal.vue';
import IconBook from '../Icons/IconBook.vue';
import IconClock from '../Icons/IconClock.vue';
import IconStar from '../Icons/IconStar.vue';

interface MangaEntry {
  id: number;
  anilist_id: number;
  estado: string;
  capitulo_actual: number;
  platform: string;
  fecha_inicio: string;
  fecha_final: string;
  rating_personal: number | null;
  title_romaji: string;
  title_english: string;
  title_native: string;
  type: string;
  format: string;
  status: string;
  cover: string;
  cover_color: string;
  chapters: number | null;
  volumes: number | null;
  genres_json: string;
}

const manga = ref<MangaEntry[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const filterType = ref('');
const filterEstado = ref('');
const filterFormat = ref('');
const filterGenre = ref('');

// Modal state (Agregar only — editing happens from the manga detail page)
const showModal = ref(false);

const allTypes = computed(() => [...new Set(manga.value.map(m => m.type).filter(Boolean))].sort());
const allFormats = computed(() => [...new Set(manga.value.map(m => m.format).filter(Boolean))].sort());
const allGenres = computed(() => {
  const genres = new Set<string>();
  for (const m of manga.value) {
    try {
      for (const g of JSON.parse(m.genres_json || '[]') as string[]) genres.add(g);
    } catch { /* */ }
  }
  return [...genres].sort();
});

const platformSuggestions = computed(() => {
  const groups = new Map<string, Map<string, number>>();
  for (const m of manga.value) {
    const value = m.platform?.trim();
    if (!value) continue;
    const key = value.toLowerCase().replace(/\s+/g, '');
    const variants = groups.get(key) || new Map<string, number>();
    variants.set(value, (variants.get(value) || 0) + 1);
    groups.set(key, variants);
  }
  const capitalized = (v: string) => (/^\p{Lu}/u.test(v) ? 1 : 0);
  return [...groups.values()]
    .map(variants => [...variants.entries()]
      .sort((a, b) => capitalized(b[0]) - capitalized(a[0]) || b[1] - a[1])[0]![0])
    .sort((a, b) => a.localeCompare(b, 'es'));
});

function mangaGenres(m: MangaEntry): string[] {
  try { return JSON.parse(m.genres_json || '[]'); } catch { return []; }
}

const filteredManga = computed(() => {
  let result = manga.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(m => (m.title_english || m.title_romaji).toLowerCase().includes(q));
  }
  if (filterType.value) result = result.filter(m => m.type === filterType.value);
  if (filterEstado.value) result = result.filter(m => m.estado === filterEstado.value);
  if (filterFormat.value) result = result.filter(m => m.format === filterFormat.value);
  if (filterGenre.value) result = result.filter(m => mangaGenres(m).includes(filterGenre.value));

  return result;
});

// Stats
const totalManga = computed(() => manga.value.length);
const readingCount = computed(() => manga.value.filter(m => m.estado === 'Leyendo').length);
const completedCount = computed(() => manga.value.filter(m => m.estado === 'Completado').length);
const totalChaptersRead = computed(() => manga.value.reduce((sum, m) => sum + (m.capitulo_actual || 0), 0));

const hasActiveFilters = computed(() =>
  searchQuery.value !== '' || filterType.value !== '' || filterEstado.value !== '' ||
  filterFormat.value !== '' || filterGenre.value !== ''
);

async function fetchManga(force = false) {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/manga', force ? { cache: 'no-store' } : {});
    if (!res.ok) throw new Error('Error al cargar manga');
    manga.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  showModal.value = true;
}

function onSaved() {
  fetchManga(true);
}

onMounted(fetchManga);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-bold text-neon-orange leading-tight">manga</h1>
          <button
            @click="openAdd"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-orange border border-neon-orange/30 rounded-lg hover:bg-neon-orange/10 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Agregar
          </button>
        </div>
        <p class="text-text-secondary text-sm leading-relaxed mt-1">Manga, manhwa y manhua leídos</p>

        <!-- Global stats -->
        <div v-if="!loading && manga.length > 0" class="flex flex-wrap items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
          <span class="inline-flex items-center gap-1">
            <IconBook :size="14" class="text-neon-orange" />
            <span class="text-neon-orange font-semibold">{{ totalManga }}</span> títulos
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconClock :size="14" class="text-neon-orange" />
            <span class="text-neon-orange font-semibold">{{ readingCount }}</span> leyendo
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <IconStar :size="14" class="text-neon-orange" />
            <span class="text-neon-orange font-semibold">{{ completedCount }}</span> completados
          </span>
          <span class="text-border-default">&middot;</span>
          <span class="inline-flex items-center gap-1">
            <span class="text-neon-orange font-semibold">{{ totalChaptersRead }}</span> capítulos leídos
          </span>
        </div>
      </div>

      <!-- Mini stats cards -->
      <div v-if="!loading && filteredManga.length > 0" class="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:shrink-0" role="list" aria-label="Resumen de estadísticas">
        <div role="listitem" class="bg-neon-orange/10 border-neon-orange/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
          <div class="text-neon-orange shrink-0" aria-hidden="true"><IconBook :size="20" /></div>
          <div class="min-w-0">
            <div class="text-neon-orange text-lg lg:text-xl font-bold leading-none mb-0.5">{{ totalManga }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Títulos</div>
          </div>
        </div>
        <div role="listitem" class="bg-neon-blue/10 border-neon-blue/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
          <div class="text-neon-blue shrink-0" aria-hidden="true"><IconClock :size="20" /></div>
          <div class="min-w-0">
            <div class="text-neon-blue text-lg lg:text-xl font-bold leading-none mb-0.5">{{ readingCount }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Leyendo</div>
          </div>
        </div>
        <div role="listitem" class="bg-neon-gold/10 border-neon-gold/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
          <div class="text-neon-gold shrink-0" aria-hidden="true"><IconStar :size="20" /></div>
          <div class="min-w-0">
            <div class="text-neon-gold text-lg lg:text-xl font-bold leading-none mb-0.5">{{ completedCount }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Completados</div>
          </div>
        </div>
        <div role="listitem" class="bg-neon-pink/10 border-neon-pink/25 relative border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
          <div class="text-neon-pink shrink-0" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-neon-pink text-lg lg:text-xl font-bold leading-none mb-0.5">{{ totalChaptersRead }}</div>
            <div class="text-[11px] lg:text-xs text-text-secondary truncate">Capítulos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-linear-to-r from-neon-orange/40 via-neon-orange/20 to-transparent"></div>

    <!-- Filters -->
    <div v-if="!loading && manga.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar manga..."
          aria-label="Buscar manga por título"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-orange/40 transition-colors w-full sm:w-64"
        />
        <select v-model="filterType" aria-label="Filtrar por tipo" class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-orange/40 transition-colors cursor-pointer">
          <option value="">Todos los tipos</option>
          <option v-for="t in allTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="filterEstado" aria-label="Filtrar por estado" class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-orange/40 transition-colors cursor-pointer">
          <option value="">Todos los estados</option>
          <option value="Leyendo">Leyendo</option>
          <option value="Completado">Completado</option>
          <option value="Pausado">Pausado</option>
          <option value="Abandonado">Abandonado</option>
          <option value="Pendiente">Pendiente</option>
        </select>
        <select v-model="filterFormat" aria-label="Filtrar por formato" class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-orange/40 transition-colors cursor-pointer">
          <option value="">Todos los formatos</option>
          <option v-for="f in allFormats" :key="f" :value="f">{{ f }}</option>
        </select>
        <select v-model="filterGenre" aria-label="Filtrar por género" class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-orange/40 transition-colors cursor-pointer">
          <option value="">Todos los géneros</option>
          <option v-for="g in allGenres" :key="g" :value="g">{{ g }}</option>
        </select>
        <span class="text-[11px] text-text-secondary ml-auto">
          <template v-if="hasActiveFilters">{{ filteredManga.length }} de {{ totalManga }}</template>
          <template v-else>{{ totalManga }} títulos</template>
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-orange/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-orange font-medium animate-pulse" role="status">[ Cargando manga... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button @click="fetchManga()" class="mt-4 px-4 py-2 text-xs text-neon-orange border border-neon-orange/30 rounded-lg hover:bg-neon-orange/10 transition-colors cursor-pointer">
        Reintentar
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="filteredManga.length === 0 && manga.length > 0" class="border border-dashed border-neon-orange/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Empty state -->
    <div v-else-if="manga.length === 0" class="border border-dashed border-neon-orange/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-orange font-medium mb-2">[ Sin datos ]</div>
      <p class="text-text-secondary text-xs">Agregá tu primer manga con el botón "Agregar"</p>
    </div>

    <!-- Manga grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list" aria-label="Lista de manga">
      <div v-for="m in filteredManga" :key="m.id" role="listitem">
        <MangaCard :manga="m" />
      </div>
    </div>

    <!-- Form Modal (Agregar only) -->
    <MangaFormModal
      :open="showModal"
      :entry="null"
      :platforms="platformSuggestions"
      @close="showModal = false"
      @saved="onSaved"
    />
  </div>
</template>
