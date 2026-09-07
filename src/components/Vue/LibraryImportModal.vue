<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { igdbImage } from '../../utils/igdbImage';
import { STORES, OWNED_VIA } from '../../data/stores';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; imported: [] }>();

interface ResolvedRow {
  input: string;
  selected: boolean;
  resolved: boolean;
  title: string;
  igdb_id: number | null;
  poster: string;
  artworks: string;
  released: string;
  companie: string;
  genre: string;
  description: string;
  trailer: string;
}

type Step = 'paste' | 'preview' | 'done';

const step = ref<Step>('paste');
const store = ref<string>(STORES[0]);
const ownedVia = ref<string>('Compra');
const rawList = ref('');
const rows = ref<ResolvedRow[]>([]);
const progress = ref(0);
const total = ref(0);
const resolving = ref(false);
const cancelled = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const resultMessage = ref('');

/** Server caps a single import; keep the client in step with it. */
const MAX_ROWS = 200;

const titles = computed(() =>
  rawList.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

const selectedCount = computed(() => rows.value.filter((r) => r.selected).length);
const resolvedCount = computed(() => rows.value.filter((r) => r.resolved).length);
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => r.selected));

function emptyRow(input: string): ResolvedRow {
  return {
    input,
    selected: true,
    resolved: false,
    title: input,
    igdb_id: null,
    poster: '',
    artworks: '',
    released: '',
    companie: '',
    genre: '',
    description: '',
    trailer: '',
  };
}

/**
 * Resolves each title against IGDB from the browser, two at a time.
 *
 * This runs client-side on purpose: a Worker has a per-request subrequest cap, so
 * resolving a 100-title list inside one endpoint would blow it. Each lookup here
 * is its own request, the cap never applies, and the user sees real progress.
 * Concurrency 2 also stays well under IGDB's 4 req/s limit.
 */
async function resolveAll() {
  const list = titles.value.slice(0, MAX_ROWS);
  if (list.length === 0) {
    errorMessage.value = 'Pegá al menos un título';
    return;
  }

  errorMessage.value = '';
  rows.value = list.map(emptyRow);
  total.value = list.length;
  progress.value = 0;
  cancelled.value = false;
  resolving.value = true;
  step.value = 'preview';

  let cursor = 0;

  async function worker() {
    while (cursor < list.length && !cancelled.value) {
      const index = cursor++;
      try {
        const res = await fetch(`/api/igdb/lookup?q=${encodeURIComponent(list[index])}`);
        if (res.ok) {
          const data = await res.json();
          const row = rows.value[index];
          row.resolved = true;
          row.title = (data as any).title || row.input;
          row.igdb_id = (data as any).igdb_id ?? null;
          row.poster = (data as any).poster || '';
          row.artworks = (data as any).artworks || '';
          row.released = (data as any).released || '';
          row.companie = (data as any).companie || '';
          row.genre = (data as any).genre || '';
          row.description = (data as any).description || '';
          row.trailer = (data as any).trailer || '';
        }
      } catch {
        // Leave the row unresolved; it can still be imported as title + store.
      } finally {
        progress.value++;
      }
    }
  }

  await Promise.all([worker(), worker()]);
  resolving.value = false;
}

function cancelResolve() {
  cancelled.value = true;
  resolving.value = false;
}

function toggleAll() {
  const next = !allSelected.value;
  for (const row of rows.value) row.selected = next;
}

async function saveSelected() {
  const chosen = rows.value.filter((r) => r.selected);
  if (chosen.length === 0) {
    errorMessage.value = 'No hay nada seleccionado';
    return;
  }

  saving.value = true;
  errorMessage.value = '';

  const payload = {
    games: chosen.map((r) => ({
      title: r.title,
      store: store.value,
      owned_via: ownedVia.value,
      igdb_id: r.igdb_id,
      poster: r.poster,
      artworks: r.artworks,
      released: r.released,
      companie: r.companie,
      genre: r.genre,
      description: r.description,
      trailer: r.trailer,
    })),
  };

  try {
    const res = await fetch('/api/library/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      errorMessage.value = (data as any).error || 'No se pudo importar';
      return;
    }

    resultMessage.value = (data as any).message || 'Importado';
    step.value = 'done';
    emit('imported');
  } catch (e) {
    errorMessage.value = (e as Error).message || 'Error de red';
  } finally {
    saving.value = false;
  }
}

function reset() {
  step.value = 'paste';
  rawList.value = '';
  rows.value = [];
  progress.value = 0;
  total.value = 0;
  errorMessage.value = '';
  resultMessage.value = '';
  cancelled.value = false;
}

watch(
  () => props.open,
  (open) => {
    if (open) reset();
    else cancelled.value = true;
  },
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/80 backdrop-blur-sm p-4 sm:p-8"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-modal-title"
    @keydown.esc="emit('close')"
  >
    <div class="w-full max-w-3xl bg-surface-1 border border-border-default rounded-xl my-auto">
      <div class="flex items-center justify-between gap-4 p-4 border-b border-border-default">
        <h2 id="import-modal-title" class="text-sm font-semibold text-neon-yellow">
          Importar lista de juegos
        </h2>
        <button
          type="button"
          class="text-text-muted hover:text-text-primary transition-colors cursor-pointer text-lg leading-none px-2"
          aria-label="Cerrar"
          @click="emit('close')"
        >×</button>
      </div>

      <!-- Step 1: paste -->
      <div v-if="step === 'paste'" class="p-4 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="import-store" class="block text-xs text-text-secondary mb-1">Tienda *</label>
            <select
              id="import-store"
              v-model="store"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            >
              <option v-for="s in STORES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label for="import-owned" class="block text-xs text-text-secondary mb-1">
              Adquirido por
            </label>
            <select
              id="import-owned"
              v-model="ownedVia"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            >
              <option v-for="o in OWNED_VIA" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>
        </div>

        <div>
          <label for="import-list" class="block text-xs text-text-secondary mb-1">
            Un título por línea
          </label>
          <textarea
            id="import-list"
            v-model="rawList"
            rows="10"
            placeholder="Control&#10;Alan Wake II&#10;Disco Elysium"
            class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-neon-yellow/40 focus-visible:outline-none resize-y font-mono"
          ></textarea>
          <p class="text-[11px] text-text-muted mt-1">
            {{ titles.length }} título{{ titles.length === 1 ? '' : 's' }} detectado{{ titles.length === 1 ? '' : 's' }}
            <span v-if="titles.length > MAX_ROWS" class="text-neon-pink">
              — se importarán los primeros {{ MAX_ROWS }}
            </span>
          </p>
        </div>

        <p v-if="errorMessage" class="text-[11px] text-neon-pink" role="alert">✗ {{ errorMessage }}</p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
          <button
            type="button"
            class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            @click="emit('close')"
          >Cancelar</button>
          <button
            type="button"
            :disabled="titles.length === 0"
            class="px-4 py-2 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            @click="resolveAll"
          >Buscar en IGDB →</button>
        </div>
      </div>

      <!-- Step 2: preview -->
      <div v-else-if="step === 'preview'" class="p-4 space-y-4">
        <div v-if="resolving" class="space-y-2">
          <div class="flex items-center justify-between text-xs text-text-secondary">
            <span>Consultando IGDB... {{ progress }} / {{ total }}</span>
            <button
              type="button"
              class="text-[11px] text-neon-pink hover:underline cursor-pointer"
              @click="cancelResolve"
            >Cancelar</button>
          </div>
          <div class="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              class="h-full bg-neon-yellow transition-all duration-200"
              :style="{ width: total ? `${(progress / total) * 100}%` : '0%' }"
            ></div>
          </div>
        </div>

        <div v-else class="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span>
            <span class="text-neon-yellow font-semibold">{{ resolvedCount }}</span>
            de {{ rows.length }} resueltos en IGDB
          </span>
          <button
            type="button"
            class="text-[11px] px-2 py-1 rounded-lg border border-border-default text-text-muted hover:text-neon-yellow hover:border-neon-yellow/40 transition-colors cursor-pointer"
            @click="toggleAll"
          >{{ allSelected ? 'Desmarcar todo' : 'Marcar todo' }}</button>
          <span class="ml-auto">{{ selectedCount }} seleccionados</span>
        </div>

        <div class="max-h-96 overflow-y-auto border border-border-default rounded-lg divide-y divide-border-default">
          <label
            v-for="(row, i) in rows"
            :key="i"
            class="flex items-center gap-3 p-2 hover:bg-surface-2/60 cursor-pointer transition-colors"
          >
            <input
              v-model="row.selected"
              type="checkbox"
              class="shrink-0 accent-neon-yellow cursor-pointer"
            />
            <div class="shrink-0 w-8 h-11 rounded bg-surface-3 overflow-hidden flex items-center justify-center">
              <img
                v-if="row.poster"
                :src="igdbImage(row.poster, 'thumb')"
                alt=""
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <span v-else class="text-[9px] text-text-muted">?</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-primary truncate">{{ row.title }}</p>
              <p class="text-[11px] text-text-muted truncate">
                <span v-if="row.resolved">
                  {{ row.companie || 'sin compañía' }}
                  <span v-if="row.released"> · {{ row.released }}</span>
                </span>
                <span v-else class="text-neon-pink">
                  sin resultado en IGDB — se guarda solo el título
                </span>
              </p>
            </div>
            <span v-if="row.input !== row.title" class="shrink-0 text-[10px] text-text-muted italic">
              pegaste: {{ row.input }}
            </span>
          </label>
        </div>

        <p v-if="errorMessage" class="text-[11px] text-neon-pink" role="alert">✗ {{ errorMessage }}</p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
          <button
            type="button"
            class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            @click="step = 'paste'"
          >← Volver</button>
          <button
            type="button"
            :disabled="resolving || saving || selectedCount === 0"
            class="px-4 py-2 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            @click="saveSelected"
          >{{ saving ? 'Guardando...' : `Añadir ${selectedCount} a ${store}` }}</button>
        </div>
      </div>

      <!-- Step 3: done -->
      <div v-else class="p-6 space-y-4 text-center">
        <p class="text-sm text-neon-green">✓ {{ resultMessage }}</p>
        <div class="flex items-center justify-center gap-2">
          <button
            type="button"
            class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            @click="reset"
          >Importar otra lista</button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer"
            @click="emit('close')"
          >Listo</button>
        </div>
      </div>
    </div>
  </div>
</template>
