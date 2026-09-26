<script setup lang="ts">
/**
 * Global search (Ctrl+K / Cmd+K). Mounted once in Layout.astro (client:idle,
 * only when !hideMenu) so it is available from any public page. Only
 * searches public sections — see src/utils/search.ts and searchService.ts —
 * /streaming and /myTodoist are never reachable from here.
 */
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { groupResults, type SearchResult, type SearchSectionKey } from '../../utils/search';
import IconSearch from '../Icons/IconSearch.vue';
import IconRepeat from '../Icons/IconRepeat.vue';

const isOpen = ref(false);
const queryText = ref('');
const loading = ref(false);
const errorMsg = ref('');
const results = ref<SearchResult[]>([]);
const activeIndex = ref(-1);
const hasSearched = ref(false);

const inputEl = ref<HTMLInputElement | null>(null);
let lastFocused: HTMLElement | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;

// Literal class map — Tailwind purges anything built by interpolation
// (same pattern as EditButton.vue / SyncButton.vue).
const accentTextClasses: Record<SearchSectionKey, string> = {
  games: 'text-neon-blue',
  library: 'text-neon-yellow',
  steam: 'text-neon-cyan',
  movies: 'text-neon-emerald',
  series: 'text-neon-indigo',
  manga: 'text-neon-orange',
};

const groups = computed(() => groupResults(results.value));
const flatResults = computed(() => groups.value.flatMap((g) => g.results));
const showMinLengthHint = computed(() => {
  const trimmed = queryText.value.trim();
  return trimmed.length > 0 && trimmed.length < 2;
});
const showEmptyState = computed(
  () => hasSearched.value && !loading.value && !errorMsg.value && flatResults.value.length === 0 && !showMinLengthHint.value,
);

function optionId(r: SearchResult): string {
  return `global-search-option-${r.section}-${r.id}`;
}

const activeDescendantId = computed(() => {
  const active = flatResults.value[activeIndex.value];
  return active ? optionId(active) : undefined;
});

function isActive(r: SearchResult): boolean {
  const active = flatResults.value[activeIndex.value];
  return !!active && active.section === r.section && active.id === r.id;
}

function openSearch() {
  if (isOpen.value) return;
  lastFocused = document.activeElement as HTMLElement | null;
  isOpen.value = true;
  queryText.value = '';
  results.value = [];
  errorMsg.value = '';
  hasSearched.value = false;
  activeIndex.value = -1;
  nextTick(() => inputEl.value?.focus());
}

function closeSearch() {
  if (!isOpen.value) return;
  isOpen.value = false;
  abortController?.abort();
  clearTimeout(debounceTimer);
  lastFocused?.focus();
}

function toggleSearch() {
  if (isOpen.value) closeSearch();
  else openSearch();
}

function onBackdropMousedown(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'global-search-backdrop') closeSearch();
}

async function runSearch(q: string) {
  abortController?.abort();
  const controller = new AbortController();
  abortController = controller;
  loading.value = true;
  errorMsg.value = '';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));

    if (controller.signal.aborted) return;

    if (!res.ok) {
      errorMsg.value = (data as { error?: string }).error || 'Error al buscar';
      results.value = [];
      return;
    }

    results.value = (data as { results?: SearchResult[] }).results || [];
    activeIndex.value = results.value.length ? 0 : -1;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    errorMsg.value = 'Error al buscar';
    results.value = [];
  } finally {
    if (!controller.signal.aborted) {
      loading.value = false;
      hasSearched.value = true;
    }
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  const trimmed = queryText.value.trim();

  if (trimmed.length < 2) {
    abortController?.abort();
    loading.value = false;
    hasSearched.value = false;
    errorMsg.value = '';
    results.value = [];
    activeIndex.value = -1;
    return;
  }

  debounceTimer = setTimeout(() => runSearch(trimmed), 200);
}

function moveActive(delta: number) {
  const len = flatResults.value.length;
  if (!len) return;
  activeIndex.value = (activeIndex.value + delta + len) % len;
}

function navigateTo(r: SearchResult) {
  window.location.href = r.href;
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveActive(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveActive(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const active = flatResults.value[activeIndex.value];
    if (active) navigateTo(active);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  }
}

function onGlobalKeydown(e: KeyboardEvent) {
  const isModK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
  if (isModK) {
    e.preventDefault();
    toggleSearch();
  } else if (e.key === 'Escape' && isOpen.value) {
    // The input handles its own Escape; this covers focus on the close button.
    closeSearch();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  clearTimeout(debounceTimer);
  abortController?.abort();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      id="global-search-backdrop"
      class="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto px-4 py-4 sm:py-16"
      @mousedown="onBackdropMousedown"
    >
      <div
        class="relative w-full max-w-xl bg-surface-1 border border-border-default rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
      >
        <h2 id="global-search-title" class="sr-only">Buscar en todo el catálogo</h2>

        <div class="flex items-center gap-3 p-4 border-b border-border-default">
          <IconSearch :size="18" class="shrink-0 text-text-muted" />
          <input
            ref="inputEl"
            v-model="queryText"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="groups.length > 0"
            aria-controls="global-search-listbox"
            :aria-activedescendant="activeDescendantId"
            autocomplete="off"
            placeholder="Buscar juegos, películas, series, manga..."
            class="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            @input="onInput"
            @keydown="onInputKeydown"
          />
          <IconRepeat v-if="loading" :size="16" class="shrink-0 text-text-muted animate-spin" />
          <button
            type="button"
            class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
            aria-label="Cerrar búsqueda"
            @click="closeSearch"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div id="global-search-listbox" role="listbox" aria-label="Resultados de búsqueda" class="max-h-[60vh] overflow-y-auto p-2">
          <p v-if="showMinLengthHint" class="px-3 py-4 text-xs text-text-muted text-center">
            Escribe al menos 2 caracteres
          </p>

          <p v-else-if="errorMsg" role="alert" class="px-3 py-4 text-xs text-neon-pink text-center">
            {{ errorMsg }}
          </p>

          <p v-else-if="showEmptyState" class="px-3 py-4 text-xs text-text-muted text-center">
            Sin resultados para "{{ queryText.trim() }}"
          </p>

          <div v-else-if="!queryText.trim()" class="px-3 py-4 text-xs text-text-muted text-center">
            Escribe para buscar en todo el catálogo
          </div>

          <div v-for="group in groups" :key="group.key" role="group" :aria-label="group.label" class="mb-2 last:mb-0">
            <p class="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" :class="accentTextClasses[group.key]">
              {{ group.label }}
            </p>
            <ul>
              <li
                v-for="r in group.results"
                :id="optionId(r)"
                :key="`${r.section}-${r.id}`"
                role="option"
                :aria-selected="isActive(r)"
                class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                :class="isActive(r) ? 'bg-surface-3' : 'hover:bg-surface-2'"
                @mousemove="activeIndex = flatResults.indexOf(r)"
                @click="navigateTo(r)"
              >
                <div class="shrink-0 w-9 h-9 rounded-md overflow-hidden bg-surface-3 flex items-center justify-center">
                  <img v-if="r.image" :src="r.image" alt="" class="w-full h-full object-cover" loading="lazy" />
                  <IconSearch v-else :size="14" class="text-text-muted" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-text-primary truncate">{{ r.title }}</p>
                  <p v-if="r.subtitle" class="text-[11px] text-text-muted truncate">{{ r.subtitle }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="px-4 py-2.5 border-t border-border-default">
          <p class="text-[10px] text-text-muted text-center">
            ↑↓ para moverte · Enter para abrir · Esc para cerrar
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
