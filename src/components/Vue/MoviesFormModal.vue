<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface MoviePreview {
  tmdb_id: number;
  title: string;
  year: number | null;
  released: string;
  poster: string;
  overview: string;
  watched_years: number[];
}

const props = withDefaults(defineProps<{
  open: boolean;
  /** Plataformas ya usadas en otras entradas, para sugerir en el campo Plataforma */
  platforms?: string[];
}>(), {
  platforms: () => [],
});

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const query = ref('');
const yearWatched = ref<number | ''>(new Date().getFullYear());
const platform = ref('');
const ratingPersonal = ref<number | ''>('');

const preview = ref<MoviePreview | null>(null);
const looking = ref(false);
const saving = ref(false);
const error = ref('');

function reset() {
  query.value = '';
  yearWatched.value = new Date().getFullYear();
  platform.value = '';
  ratingPersonal.value = '';
  preview.value = null;
  error.value = '';
}

watch(() => props.open, (val) => {
  if (val) {
    reset();
    nextTick(() => document.getElementById('movie-query')?.focus());
  }
});

// Si se cambia lo escrito, la previsualización anterior deja de ser válida
watch(query, () => { preview.value = null; });

async function lookup() {
  if (!query.value.trim()) {
    error.value = 'Escribe el slug de Trakt o el id de TMDB';
    return;
  }

  looking.value = true;
  error.value = '';
  preview.value = null;

  try {
    const res = await fetch(`/api/movies/lookup?q=${encodeURIComponent(query.value.trim())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    preview.value = data as MoviePreview;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    looking.value = false;
  }
}

async function save() {
  if (!preview.value) {
    error.value = 'Busca la película antes de guardar';
    return;
  }
  if (!yearWatched.value) {
    error.value = 'El año es obligatorio';
    return;
  }

  saving.value = true;
  error.value = '';

  try {
    const res = await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.value.trim(),
        year_watched: Number(yearWatched.value),
        platform: platform.value.trim(),
        rating_personal: ratingPersonal.value === '' ? null : Number(ratingPersonal.value),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }

    emit('saved');
    emit('close');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'movie-modal-backdrop') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="movie-modal-backdrop"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
    >
      <div
        class="relative w-full max-w-lg bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        aria-label="Agregar película"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 class="text-lg font-bold text-text-primary">Agregar película</h2>
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

        <!-- Body -->
        <form @submit.prevent="save" class="p-5 space-y-4">
          <div v-if="error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2" role="alert">
            {{ error }}
          </div>

          <!-- Búsqueda -->
          <div>
            <label for="movie-query" class="block text-xs text-text-muted mb-1">Película *</label>
            <div class="flex gap-2">
              <input
                id="movie-query"
                v-model="query"
                type="text"
                required
                class="flex-1 min-w-0 bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-emerald/50 focus:ring-1 focus:ring-neon-emerald/20 transition-colors"
                placeholder="ej: dune-part-two-2024"
                @keydown.enter.prevent="lookup"
              />
              <button
                type="button"
                @click="lookup"
                :disabled="looking"
                class="shrink-0 px-4 py-2 text-xs font-medium text-neon-emerald border border-neon-emerald/30 rounded-lg hover:bg-neon-emerald/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ looking ? 'Buscando...' : 'Buscar' }}
              </button>
            </div>
            <p class="text-[10px] text-text-muted mt-1">
              Slug o URL de Trakt, o el id de TMDB si hay dos películas del mismo título y año
            </p>
          </div>

          <!-- Previsualización -->
          <div
            v-if="preview"
            class="flex gap-3 bg-surface-2 border border-neon-emerald/20 rounded-lg p-3"
          >
            <img
              v-if="preview.poster"
              :src="preview.poster"
              :alt="preview.title"
              class="w-16 rounded-md object-cover aspect-2/3 bg-surface-3 shrink-0"
              width="64"
              height="96"
            />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-text-primary leading-tight">{{ preview.title }}</div>
              <div class="text-xs text-text-muted mt-0.5">
                {{ preview.year || 'sin año' }} &middot; TMDB {{ preview.tmdb_id }}
              </div>
              <p v-if="preview.overview" class="text-[11px] text-text-secondary mt-1.5 line-clamp-3">
                {{ preview.overview }}
              </p>
              <p
                v-if="preview.watched_years.length"
                class="text-[11px] text-neon-yellow mt-1.5"
              >
                Ya registrada en: {{ preview.watched_years.join(', ') }}
              </p>
            </div>
          </div>

          <!-- Año + Plataforma -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="movie-year" class="block text-xs text-text-muted mb-1">Año visto *</label>
              <input
                id="movie-year"
                v-model="yearWatched"
                type="number"
                min="1900"
                max="2100"
                required
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-emerald/50 focus:ring-1 focus:ring-neon-emerald/20 transition-colors"
              />
            </div>
            <div>
              <label for="movie-platform" class="block text-xs text-text-muted mb-1">Plataforma</label>
              <input
                id="movie-platform"
                v-model="platform"
                type="text"
                list="movie-platforms"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-emerald/50 focus:ring-1 focus:ring-neon-emerald/20 transition-colors"
                placeholder="ej: Netflix, Cine"
              />
              <datalist id="movie-platforms">
                <option v-for="p in platforms" :key="p" :value="p" />
              </datalist>
            </div>
          </div>

          <!-- Mi score -->
          <div>
            <label for="movie-rating-personal" class="block text-xs text-text-muted mb-1">Mi score (0-100)</label>
            <input
              id="movie-rating-personal"
              v-model="ratingPersonal"
              type="number"
              min="0"
              max="100"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-emerald/50 focus:ring-1 focus:ring-neon-emerald/20 transition-colors"
              placeholder="Opcional"
            />
          </div>

          <!-- Acciones -->
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 text-xs text-text-secondary border border-border-default rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="saving || !preview"
              class="px-4 py-2 text-xs font-medium text-neon-emerald border border-neon-emerald/30 bg-neon-emerald/10 rounded-lg hover:bg-neon-emerald/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Guardando...' : 'Agregar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
