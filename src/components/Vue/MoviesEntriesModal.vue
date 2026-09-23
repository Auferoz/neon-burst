<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';

interface MovieWatchedRow {
  watched_id: number;
  year_watched: number;
  platform: string;
}

const props = defineProps<{
  open: boolean;
  title: string;
  tmdbId: number;
  ratingPersonal: number | null;
  ratingTmdb: number | null;
  ratingImdb: number | null;
  entries: MovieWatchedRow[];
}>();

const emit = defineEmits<{
  close: [];
}>();

// ── Scores (Mi score + overrides manuales de TMDB/IMDb) ──
const scoreValue = ref<number | ''>('');
const tmdbValue = ref<number | ''>('');
const imdbValue = ref<number | ''>('');
const scoreSaving = ref(false);
const scoreError = ref('');

// Snapshot al abrir el modal: solo se manda al servidor lo que haya cambiado.
let initialPersonal: number | null = null;
let initialTmdb: number | null = null;
let initialImdb: number | null = null;

function toValueOrNull(v: number | ''): number | null {
  return v === '' ? null : Number(v);
}

// ── Viewings list ──
interface EditableRow extends MovieWatchedRow {
  saving: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  error: string;
}

const rows = ref<EditableRow[]>([]);

const platformSuggestions = computed(() =>
  [...new Set(props.entries.map(e => e.platform).filter(Boolean))].sort()
);

watch(() => props.open, (val) => {
  if (!val) return;
  initialPersonal = props.ratingPersonal ?? null;
  initialTmdb = props.ratingTmdb ?? null;
  initialImdb = props.ratingImdb ?? null;
  scoreValue.value = initialPersonal ?? '';
  tmdbValue.value = initialTmdb ?? '';
  imdbValue.value = initialImdb ?? '';
  scoreError.value = '';
  rows.value = props.entries
    .slice()
    .sort((a, b) => b.year_watched - a.year_watched)
    .map(e => ({ ...e, saving: false, confirmingDelete: false, deleting: false, error: '' }));
  nextTick(() => document.getElementById('movie-entries-score')?.focus());
});

async function saveScore() {
  scoreSaving.value = true;
  scoreError.value = '';
  try {
    const body: Record<string, number | null> = {};
    const nextPersonal = toValueOrNull(scoreValue.value);
    const nextTmdb = toValueOrNull(tmdbValue.value);
    const nextImdb = toValueOrNull(imdbValue.value);
    if (nextPersonal !== initialPersonal) body.rating_personal = nextPersonal;
    if (nextTmdb !== initialTmdb) body.rating_tmdb = nextTmdb;
    if (nextImdb !== initialImdb) body.rating_imdb = nextImdb;

    if (Object.keys(body).length === 0) {
      scoreSaving.value = false;
      return;
    }

    const res = await fetch(`/api/movies/score/${props.tmdbId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    const res = await fetch(`/api/movies/${row.watched_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year_watched: Number(row.year_watched),
        platform: row.platform.trim(),
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
    const res = await fetch(`/api/movies/${row.watched_id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    // Borrar todos los visionados deja intacto el score personal
    // (movies_personal es una tabla aparte, no se toca acá).
    if (rows.value.length === 1) {
      window.location.href = '/ListMovies';
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
  if ((e.target as HTMLElement).id === 'movie-entries-modal-backdrop') emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="movie-entries-modal-backdrop"
      class="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
      @keydown="onKeydown"
    >
      <div
        class="relative w-full max-w-2xl bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-entries-modal-title"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 id="movie-entries-modal-title" class="text-lg font-bold text-text-primary">
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
          <!-- Scores -->
          <div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="movie-entries-score" class="block text-xs text-text-muted mb-1">Mi score (0-100)</label>
                <input
                  id="movie-entries-score"
                  v-model="scoreValue"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Sin puntuar"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 transition-colors"
                />
              </div>
              <div>
                <label for="movie-entries-tmdb" class="block text-xs text-text-muted mb-1">TMDB (0-100)</label>
                <input
                  id="movie-entries-tmdb"
                  v-model="tmdbValue"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Vacío = automático"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 transition-colors"
                />
              </div>
              <div>
                <label for="movie-entries-imdb" class="block text-xs text-text-muted mb-1">IMDb (0-100)</label>
                <input
                  id="movie-entries-imdb"
                  v-model="imdbValue"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Vacío = automático"
                  class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 transition-colors"
                />
              </div>
            </div>
            <p class="text-[11px] text-text-muted mt-1">
              TMDB e IMDb vacíos se siguen actualizando solos; un valor cargado a mano deja de refrescarse.
            </p>
            <div class="mt-2">
              <button
                type="button"
                @click="saveScore"
                :disabled="scoreSaving"
                class="px-3 py-1.5 text-xs font-medium text-neon-emerald border border-neon-emerald/30 rounded-lg hover:bg-neon-emerald/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {{ scoreSaving ? 'Guardando...' : 'Guardar scores' }}
              </button>
            </div>
            <p v-if="scoreError" class="text-[11px] text-neon-pink mt-1" role="alert">{{ scoreError }}</p>
          </div>

          <div class="h-px bg-border-default"></div>

          <!-- Visionados -->
          <div>
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Visionados
            </h3>
            <div class="space-y-3">
              <div
                v-for="row in rows"
                :key="row.watched_id"
                class="border border-border-default rounded-xl p-4 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-neon-emerald">{{ row.year_watched }}</span>
                  <button
                    v-if="!row.confirmingDelete"
                    type="button"
                    @click="row.confirmingDelete = true"
                    class="text-[11px] text-neon-pink hover:underline cursor-pointer"
                    :aria-label="`Eliminar visionado de ${row.year_watched}`"
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
                  <span class="text-xs text-text-primary">¿Eliminar el visionado de {{ row.year_watched }}?</span>
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
                      :aria-label="`Confirmar eliminación del visionado de ${row.year_watched}`"
                      class="px-3 py-1.5 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {{ row.deleting ? 'Eliminando...' : 'Sí, eliminar' }}
                    </button>
                  </div>
                </div>

                <div v-else class="grid grid-cols-2 gap-3">
                  <div>
                    <label :for="`movie-entry-year-${row.watched_id}`" class="block text-[11px] text-text-muted mb-1">Año visto</label>
                    <input
                      :id="`movie-entry-year-${row.watched_id}`"
                      v-model="row.year_watched"
                      type="number"
                      min="1900"
                      max="2100"
                      class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label :for="`movie-entry-platform-${row.watched_id}`" class="block text-[11px] text-text-muted mb-1">Plataforma</label>
                    <input
                      :id="`movie-entry-platform-${row.watched_id}`"
                      v-model="row.platform"
                      type="text"
                      :list="`movie-entry-platform-options-${row.watched_id}`"
                      autocomplete="off"
                      class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 transition-colors"
                    />
                    <datalist :id="`movie-entry-platform-options-${row.watched_id}`">
                      <option v-for="p in platformSuggestions" :key="p" :value="p" />
                    </datalist>
                  </div>
                </div>

                <div v-if="!row.confirmingDelete" class="flex justify-end">
                  <button
                    type="button"
                    @click="saveRow(row)"
                    :disabled="row.saving"
                    class="px-3 py-1.5 text-xs font-medium text-neon-emerald border border-neon-emerald/30 rounded-lg hover:bg-neon-emerald/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {{ row.saving ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
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
