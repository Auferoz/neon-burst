<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { SERIES_STATUS_OPTIONS } from '../../utils/seriesFormOptions';

interface SeriesEntryRow {
  id: number;
  season_number: number;
  year_watched: number;
  platform: string;
  status_viewed: string;
}

const props = defineProps<{
  open: boolean;
  title: string;
  traktSlug: string;
  ratingPersonal: number | null;
  entries: SeriesEntryRow[];
}>();

const emit = defineEmits<{
  close: [];
}>();

// ── Mi score ──
const scoreValue = ref<number | ''>('');
const scoreSaving = ref(false);
const scoreError = ref('');

interface EditableRow extends SeriesEntryRow {
  saving: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  error: string;
}

const rows = ref<EditableRow[]>([]);

// Sugerencias de plataforma: las ya usadas en otras temporadas de esta misma
// serie (no la lista global, que no está disponible en la ficha server-side).
const platformSuggestions = computed(() =>
  [...new Set(props.entries.map(e => e.platform).filter(Boolean))].sort()
);

watch(() => props.open, (val) => {
  if (!val) return;
  scoreValue.value = props.ratingPersonal ?? '';
  scoreError.value = '';
  rows.value = props.entries
    .slice()
    .sort((a, b) => a.season_number - b.season_number)
    .map(e => ({ ...e, saving: false, confirmingDelete: false, deleting: false, error: '' }));
  nextTick(() => document.getElementById(`series-entry-year-${rows.value[0]?.id}`)?.focus());
});

async function saveScore() {
  scoreSaving.value = true;
  scoreError.value = '';
  try {
    const res = await fetch(`/api/series/score/${props.traktSlug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating_personal: scoreValue.value === '' ? null : Number(scoreValue.value) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    window.location.reload();
  } catch (e) {
    scoreError.value = (e as Error).message;
    scoreSaving.value = false;
  }
}

async function saveRow(row: EditableRow) {
  row.saving = true;
  row.error = '';
  try {
    const res = await fetch(`/api/series/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year_watched: Number(row.year_watched),
        platform: row.platform.trim(),
        status_viewed: row.status_viewed,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    window.location.reload();
  } catch (e) {
    row.error = (e as Error).message;
    row.saving = false;
  }
}

async function deleteRow(row: EditableRow) {
  row.deleting = true;
  row.error = '';
  try {
    const res = await fetch(`/api/series/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    if (rows.value.length === 1) {
      window.location.href = '/ListSeries';
    } else {
      window.location.reload();
    }
  } catch (e) {
    row.error = (e as Error).message;
    row.deleting = false;
    row.confirmingDelete = false;
  }
}

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'series-entries-modal-backdrop') emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="series-entries-modal-backdrop"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
      @keydown="onKeydown"
    >
      <div
        class="relative w-full max-w-2xl bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-entries-modal-title"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 id="series-entries-modal-title" class="text-lg font-bold text-text-primary">
            Editar {{ title }}
          </h2>
          <button
            @click="emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <!-- Mi score: uno por serie, no por temporada -->
          <div>
            <label for="series-entries-score" class="block text-xs text-text-muted mb-1">Mi score (0-100)</label>
            <div class="flex items-center gap-2 flex-wrap">
              <input
                id="series-entries-score"
                v-model="scoreValue"
                type="number"
                min="0"
                max="100"
                placeholder="Vacío = sin puntuar"
                class="w-32 bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 transition-colors"
              />
              <button
                type="button"
                @click="saveScore"
                :disabled="scoreSaving"
                class="px-3 py-1.5 text-xs font-medium text-neon-indigo border border-neon-indigo/30 rounded-lg hover:bg-neon-indigo/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {{ scoreSaving ? 'Guardando...' : 'Guardar score' }}
              </button>
            </div>
            <p v-if="scoreError" class="text-[11px] text-neon-pink mt-1" role="alert">{{ scoreError }}</p>
          </div>

          <div class="h-px bg-border-default"></div>

          <!-- Body: una fila por temporada registrada -->
          <div class="space-y-4">
          <div
            v-for="row in rows"
            :key="row.id"
            class="border border-border-default rounded-xl p-4 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-neon-indigo">Temporada {{ row.season_number }}</span>
              <button
                v-if="!row.confirmingDelete"
                type="button"
                @click="row.confirmingDelete = true"
                class="text-[11px] text-neon-pink hover:underline cursor-pointer"
                :aria-label="`Eliminar temporada ${row.season_number} (${row.year_watched})`"
              >
                Eliminar
              </button>
            </div>

            <div v-if="row.error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2" role="alert">
              {{ row.error }}
            </div>

            <!-- Confirmación de borrado, en el propio modal -->
            <div
              v-if="row.confirmingDelete"
              class="flex items-center justify-between gap-3 bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2"
              role="alert"
            >
              <span class="text-xs text-text-primary">¿Eliminar temporada {{ row.season_number }} ({{ row.year_watched }})?</span>
              <div class="flex gap-2 shrink-0">
                <button
                  type="button"
                  @click="row.confirmingDelete = false"
                  :disabled="row.deleting"
                  class="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-lg hover:bg-surface-3 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  @click="deleteRow(row)"
                  :disabled="row.deleting"
                  :aria-label="`Confirmar eliminación de temporada ${row.season_number} (${row.year_watched})`"
                  class="px-3 py-1.5 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {{ row.deleting ? 'Eliminando...' : 'Sí, eliminar' }}
                </button>
              </div>
            </div>

            <div v-else class="grid grid-cols-3 gap-3">
              <div>
                <label :for="`series-entry-year-${row.id}`" class="block text-[11px] text-text-muted mb-1">Año visto</label>
                <input
                  :id="`series-entry-year-${row.id}`"
                  v-model="row.year_watched"
                  type="number"
                  min="2000"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 transition-colors"
                />
              </div>
              <div>
                <label :for="`series-entry-platform-${row.id}`" class="block text-[11px] text-text-muted mb-1">Plataforma</label>
                <input
                  :id="`series-entry-platform-${row.id}`"
                  v-model="row.platform"
                  type="text"
                  :list="`series-entry-platform-options-${row.id}`"
                  autocomplete="off"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 transition-colors"
                />
                <datalist :id="`series-entry-platform-options-${row.id}`">
                  <option v-for="p in platformSuggestions" :key="p" :value="p" />
                </datalist>
              </div>
              <div>
                <label :for="`series-entry-status-${row.id}`" class="block text-[11px] text-text-muted mb-1">Estado</label>
                <select
                  :id="`series-entry-status-${row.id}`"
                  v-model="row.status_viewed"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 transition-colors cursor-pointer"
                >
                  <option v-for="opt in SERIES_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>

            <div v-if="!row.confirmingDelete" class="flex justify-end">
              <button
                type="button"
                @click="saveRow(row)"
                :disabled="row.saving"
                class="px-3 py-1.5 text-xs font-medium text-neon-indigo border border-neon-indigo/30 rounded-lg hover:bg-neon-indigo/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {{ row.saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-5 border-t border-border-default">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 text-xs text-text-muted border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
