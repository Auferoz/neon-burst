<script setup lang="ts">
/**
 * "Agregar lista" de la pestaña Por comprar: un juego por línea (título, URL de
 * la tienda o appid) → cada uno se resuelve contra Steam desde el navegador
 * (`/api/wishlist/lookup`, de a dos) → vista previa con checkboxes → alta masiva
 * (`/api/wishlist/bulk`). Mismo flujo que `LibraryImportModal.vue`.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { formatClp, parseWishlistLines, type WishlistPrice } from '../../utils/wishlist';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; imported: [] }>();

interface Row {
  input: string;
  status: 'pending' | 'found' | 'missing';
  selected: boolean;
  already: boolean;
  steam_appid: number | null;
  name: string;
  image: string;
  release_label: string;
  price: WishlistPrice | null;
}

type Step = 'paste' | 'preview' | 'done';

/** Igual que WISHLIST_BULK_MAX del servidor. */
const MAX_ROWS = 100;

const step = ref<Step>('paste');
const rawList = ref('');
const rows = ref<Row[]>([]);
const progress = ref(0);
const resolving = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const resultMessage = ref('');
let cancelled = false;

const panelEl = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

const lines = computed(() => parseWishlistLines(rawList.value, Number.POSITIVE_INFINITY));
const selectable = computed(() => rows.value.filter(r => r.status === 'found' && !r.already));
const selected = computed(() => selectable.value.filter(r => r.selected));
const foundCount = computed(() => rows.value.filter(r => r.status === 'found').length);
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(r => r.selected));

function emptyRow(input: string): Row {
  return { input, status: 'pending', selected: false, already: false, steam_appid: null, name: input, image: '', release_label: '', price: null };
}

async function resolveAll() {
  const list = lines.value.slice(0, MAX_ROWS);
  if (list.length === 0) {
    errorMessage.value = 'Pega al menos un juego';
    return;
  }
  errorMessage.value = '';
  rows.value = list.map(emptyRow);
  progress.value = 0;
  cancelled = false;
  resolving.value = true;
  step.value = 'preview';

  let cursor = 0;
  async function worker() {
    while (cursor < list.length && !cancelled) {
      const row = rows.value[cursor++];
      try {
        const res = await fetch(`/api/wishlist/lookup?q=${encodeURIComponent(row.input)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        Object.assign(row, {
          status: 'found',
          steam_appid: data.steam_appid,
          name: data.name,
          image: data.image || '',
          release_label: data.release_label || '',
          price: data.price ?? null,
          already: !!data.already_added,
          selected: !data.already_added,
        });
      } catch {
        row.status = 'missing';
      } finally {
        progress.value++;
      }
    }
  }

  await Promise.all([worker(), worker()]);
  resolving.value = false;
}

function cancelResolve() {
  cancelled = true;
  resolving.value = false;
}

function toggleAll() {
  const next = !allSelected.value;
  for (const row of selectable.value) row.selected = next;
}

async function saveSelected() {
  if (selected.value.length === 0) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const games = selected.value.map(r => ({
      steam_appid: r.steam_appid,
      name: r.name,
      image: r.image,
      release_label: r.release_label,
    }));
    const res = await fetch('/api/wishlist/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo agregar');
    resultMessage.value = (data as { message?: string }).message || 'Agregados';
    step.value = 'done';
    emit('imported');
  } catch (e) {
    errorMessage.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

function reset() {
  step.value = 'paste';
  rawList.value = '';
  rows.value = [];
  progress.value = 0;
  errorMessage.value = '';
  resultMessage.value = '';
  cancelled = false;
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close');
}

watch(() => props.open, open => {
  if (open) {
    reset();
    lastFocused = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onDocumentKeydown);
    nextTick(() => panelEl.value?.focus());
  } else {
    cancelled = true;
    document.removeEventListener('keydown', onDocumentKeydown);
    lastFocused?.focus();
    lastFocused = null;
  }
});

onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown));
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
        aria-labelledby="wishlist-import-title"
        class="relative flex flex-col w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[88vh] bg-surface-1 sm:border border-neon-pink/30 sm:rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
      >
        <div class="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-border-default">
          <h2 id="wishlist-import-title" class="text-lg font-bold text-neon-pink neon-glow-pink leading-tight">
            Agregar lista de juegos
          </h2>
          <button
            type="button"
            class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="sr-only" aria-live="polite" role="status">
          {{ step === 'preview' && !resolving ? `${foundCount} de ${rows.length} encontrados en Steam` : '' }}
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin p-4 sm:p-5">
          <!-- Step 1: paste -->
          <div v-if="step === 'paste'" class="space-y-4">
            <div>
              <label for="wishlist-import-list" class="block text-xs text-text-secondary mb-1">
                Un juego por línea: título, URL de la tienda de Steam o appid
              </label>
              <textarea
                id="wishlist-import-list"
                v-model="rawList"
                rows="10"
                placeholder="Hollow Knight: Silksong&#10;https://store.steampowered.com/app/1145350/Hades_II/&#10;3357650"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink/40 resize-y font-mono scrollbar-thin"
              ></textarea>
              <p class="text-[11px] text-text-muted mt-1">
                {{ lines.length }} juego{{ lines.length === 1 ? '' : 's' }} detectado{{ lines.length === 1 ? '' : 's' }}
                <span v-if="lines.length > MAX_ROWS" class="text-neon-pink"> — se buscarán los primeros {{ MAX_ROWS }}</span>
              </p>
            </div>
            <p v-if="errorMessage" class="text-[11px] text-neon-pink" role="alert">{{ errorMessage }}</p>
          </div>

          <!-- Step 2: preview -->
          <div v-else-if="step === 'preview'" class="space-y-4">
            <div v-if="resolving" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-text-secondary">
                <span>Buscando en Steam... {{ progress }} / {{ rows.length }}</span>
                <button type="button" class="text-[11px] text-neon-pink hover:underline cursor-pointer" @click="cancelResolve">Cancelar</button>
              </div>
              <div class="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div class="h-full bg-neon-pink transition-all duration-200" :style="{ width: `${(progress / rows.length) * 100}%` }"></div>
              </div>
            </div>

            <div v-else class="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span><span class="text-neon-pink font-semibold">{{ foundCount }}</span> de {{ rows.length }} encontrados en Steam</span>
              <button
                v-if="selectable.length > 0"
                type="button"
                class="text-[11px] px-2 py-1 rounded-lg border border-border-default text-text-muted hover:text-neon-pink hover:border-neon-pink/40 transition-colors cursor-pointer"
                @click="toggleAll"
              >{{ allSelected ? 'Desmarcar todo' : 'Marcar todo' }}</button>
              <span class="ml-auto">{{ selected.length }} seleccionados</span>
            </div>

            <ul class="border border-border-default rounded-lg divide-y divide-border-default" aria-label="Juegos encontrados">
              <li v-for="(row, i) in rows" :key="i">
                <label
                  class="flex items-center gap-3 p-2 transition-colors"
                  :class="row.status === 'found' && !row.already ? 'hover:bg-surface-2/60 cursor-pointer' : 'opacity-70'"
                >
                  <input
                    v-model="row.selected"
                    type="checkbox"
                    :disabled="row.status !== 'found' || row.already"
                    class="shrink-0 accent-neon-pink cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div class="shrink-0 w-20 aspect-[231/87] rounded bg-surface-3 overflow-hidden flex items-center justify-center">
                    <img v-if="row.image" :src="row.image" alt="" class="w-full h-full object-cover" loading="lazy" />
                    <span v-else class="text-[9px] text-text-muted">?</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-text-primary truncate">{{ row.name }}</p>
                    <p class="text-[11px] truncate">
                      <span v-if="row.status === 'pending'" class="text-text-muted animate-pulse">buscando...</span>
                      <span v-else-if="row.status === 'missing'" class="text-neon-pink">sin resultado en Steam — no se agrega</span>
                      <span v-else-if="row.already" class="text-text-muted">ya está en la lista</span>
                      <span v-else-if="row.input.toLowerCase() !== row.name.toLowerCase()" class="text-text-muted italic">pegaste: {{ row.input }}</span>
                    </p>
                  </div>
                  <span v-if="row.price" class="shrink-0 text-xs font-semibold" :class="row.price.discount > 0 ? 'text-neon-pink' : 'text-text-primary'">
                    <span v-if="row.price.discount > 0" class="text-[10px]">-{{ row.price.discount }}% </span>{{ formatClp(row.price.final) }}
                  </span>
                </label>
              </li>
            </ul>

            <p v-if="errorMessage" class="text-[11px] text-neon-pink" role="alert">{{ errorMessage }}</p>
          </div>

          <!-- Step 3: done -->
          <div v-else class="py-6 text-center">
            <p class="text-sm text-neon-green" role="status">✓ {{ resultMessage }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-border-default">
          <template v-if="step === 'paste'">
            <button type="button" class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer" @click="emit('close')">Cancelar</button>
            <button
              type="button"
              :disabled="lines.length === 0"
              class="px-4 py-2 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              @click="resolveAll"
            >Buscar en Steam →</button>
          </template>
          <template v-else-if="step === 'preview'">
            <button type="button" class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer" @click="step = 'paste'">← Volver</button>
            <button
              type="button"
              :disabled="resolving || saving || selected.length === 0"
              class="px-4 py-2 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              @click="saveSelected"
            >{{ saving ? 'Agregando...' : `Agregar ${selected.length} a la lista` }}</button>
          </template>
          <template v-else>
            <button type="button" class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer" @click="reset">Agregar otra lista</button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer"
              @click="emit('close')"
            >Listo</button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
