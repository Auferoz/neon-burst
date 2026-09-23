<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface MangaPreview {
  anilist_id: number;
  title: string;
  type: string;
  format: string;
  status: string;
  chapters: number | null;
  cover: string;
  already_added: boolean;
}

interface MangaEditEntry {
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
  cover: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  entry?: MangaEditEntry | null;
  /** Plataformas ya usadas en otras entradas, para sugerir en el campo Plataforma */
  platforms?: string[];
}>(), {
  platforms: () => [],
});

const emit = defineEmits<{
  close: [];
  saved: [];
  deleted: [];
}>();

const isEdit = ref(false);
const query = ref('');
const preview = ref<MangaPreview | null>(null);
const looking = ref(false);
const saving = ref(false);
const error = ref('');
const confirmingDelete = ref(false);
const deleting = ref(false);

const estado = ref('Leyendo');
const capituloActual = ref<number | ''>(0);
const platform = ref('');
const fechaInicio = ref('');
const fechaFinal = ref('');
const ratingPersonal = ref<number | ''>('');

function reset() {
  query.value = '';
  preview.value = null;
  estado.value = 'Leyendo';
  capituloActual.value = 0;
  platform.value = '';
  fechaInicio.value = '';
  fechaFinal.value = '';
  ratingPersonal.value = '';
  error.value = '';
}

watch(() => props.open, (val) => {
  if (!val) return;
  error.value = '';
  confirmingDelete.value = false;
  if (props.entry) {
    isEdit.value = true;
    estado.value = props.entry.estado;
    capituloActual.value = props.entry.capitulo_actual;
    platform.value = props.entry.platform;
    fechaInicio.value = props.entry.fecha_inicio;
    fechaFinal.value = props.entry.fecha_final;
    ratingPersonal.value = props.entry.rating_personal ?? '';
    preview.value = null;
    query.value = '';
    nextTick(() => document.getElementById('manga-estado')?.focus());
  } else {
    isEdit.value = false;
    reset();
    nextTick(() => document.getElementById('manga-query')?.focus());
  }
});

// Si se cambia lo escrito, la previsualización anterior deja de ser válida
watch(query, () => { preview.value = null; });

async function lookup() {
  if (!query.value.trim()) {
    error.value = 'Pegá la URL o el id de AniList';
    return;
  }

  looking.value = true;
  error.value = '';
  preview.value = null;

  try {
    const res = await fetch(`/api/manga/lookup?q=${encodeURIComponent(query.value.trim())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    preview.value = data as MangaPreview;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    looking.value = false;
  }
}

async function save() {
  if (!isEdit.value && !preview.value) {
    error.value = 'Buscá el manga antes de guardar';
    return;
  }

  saving.value = true;
  error.value = '';

  const payload = {
    estado: estado.value,
    capitulo_actual: Number(capituloActual.value) || 0,
    platform: platform.value.trim(),
    fecha_inicio: fechaInicio.value.trim(),
    fecha_final: fechaFinal.value.trim(),
    rating_personal: ratingPersonal.value === '' ? null : Number(ratingPersonal.value),
  };

  try {
    const url = isEdit.value ? `/api/manga/${props.entry!.id}` : '/api/manga';
    const method = isEdit.value ? 'PUT' : 'POST';
    const body = isEdit.value ? payload : { query: query.value.trim(), ...payload };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

async function deleteEntry() {
  if (!isEdit.value || !props.entry) return;
  deleting.value = true;
  error.value = '';
  try {
    const res = await fetch(`/api/manga/${props.entry.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    emit('deleted');
    emit('close');
  } catch (e) {
    error.value = (e as Error).message;
    deleting.value = false;
    confirmingDelete.value = false;
  }
}

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'manga-modal-backdrop') emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="manga-modal-backdrop"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
      @keydown="onKeydown"
    >
      <div
        class="relative w-full max-w-lg bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? 'Editar manga' : 'Agregar manga'"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 class="text-lg font-bold text-text-primary">{{ isEdit ? 'Editar manga' : 'Agregar manga' }}</h2>
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

          <!-- Búsqueda (solo alta) -->
          <div v-if="!isEdit">
            <label for="manga-query" class="block text-xs text-text-muted mb-1">Manga *</label>
            <div class="flex gap-2">
              <input
                id="manga-query"
                v-model="query"
                type="text"
                required
                class="flex-1 min-w-0 bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
                placeholder="ej: https://anilist.co/manga/30013 o 30013"
                @keydown.enter.prevent="lookup"
              />
              <button
                type="button"
                @click="lookup"
                :disabled="looking"
                class="shrink-0 px-4 py-2 text-xs font-medium text-neon-orange border border-neon-orange/30 rounded-lg hover:bg-neon-orange/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ looking ? 'Buscando...' : 'Buscar' }}
              </button>
            </div>
            <p class="text-[10px] text-text-muted mt-1">URL o id de AniList</p>
          </div>

          <!-- Previsualización -->
          <div v-if="preview" class="flex gap-3 bg-surface-2 border border-neon-orange/20 rounded-lg p-3">
            <img
              v-if="preview.cover"
              :src="preview.cover"
              :alt="preview.title"
              class="w-16 rounded-md object-cover aspect-[2/3] bg-surface-3 shrink-0"
              width="64"
              height="96"
            />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-text-primary leading-tight">{{ preview.title }}</div>
              <div class="text-xs text-text-muted mt-0.5">
                {{ preview.type }} &middot; {{ preview.chapters ?? '?' }} caps
              </div>
              <p v-if="preview.already_added" class="text-[11px] text-neon-yellow mt-1.5">
                Ya está en tu lista
              </p>
            </div>
          </div>

          <!-- Edit-mode cover/title reminder -->
          <div v-if="isEdit && entry" class="flex gap-3 bg-surface-2 border border-border-default rounded-lg p-3">
            <img
              v-if="entry.cover"
              :src="entry.cover"
              :alt="entry.title_english || entry.title_romaji"
              class="w-16 rounded-md object-cover aspect-[2/3] bg-surface-3 shrink-0"
              width="64"
              height="96"
            />
            <div class="min-w-0 flex items-center">
              <div class="text-sm font-semibold text-text-primary leading-tight">{{ entry.title_english || entry.title_romaji }}</div>
            </div>
          </div>

          <!-- Estado + Capítulo -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="manga-estado" class="block text-xs text-text-muted mb-1">Estado</label>
              <select
                id="manga-estado"
                v-model="estado"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-orange/50 transition-colors cursor-pointer"
              >
                <option value="Leyendo">Leyendo</option>
                <option value="Completado">Completado</option>
                <option value="Pausado">Pausado</option>
                <option value="Abandonado">Abandonado</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </div>
            <div>
              <label for="manga-capitulo" class="block text-xs text-text-muted mb-1">Capítulo actual</label>
              <input
                id="manga-capitulo"
                v-model="capituloActual"
                type="number"
                min="0"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
              />
            </div>
          </div>

          <!-- Plataforma -->
          <div>
            <label for="manga-platform" class="block text-xs text-text-muted mb-1">Plataforma</label>
            <input
              id="manga-platform"
              v-model="platform"
              type="text"
              list="manga-platform-options"
              autocomplete="off"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
              placeholder="MangaPlus, Manta, físico..."
            />
            <datalist id="manga-platform-options">
              <option v-for="p in platforms" :key="p" :value="p" />
            </datalist>
          </div>

          <!-- Fechas -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="manga-fecha-inicio" class="block text-xs text-text-muted mb-1">Fecha inicio</label>
              <input
                id="manga-fecha-inicio"
                v-model="fechaInicio"
                type="text"
                placeholder="DD/MM/YYYY"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
              />
            </div>
            <div>
              <label for="manga-fecha-final" class="block text-xs text-text-muted mb-1">Fecha final</label>
              <input
                id="manga-fecha-final"
                v-model="fechaFinal"
                type="text"
                placeholder="DD/MM/YYYY"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
              />
            </div>
          </div>

          <!-- Score personal -->
          <div>
            <label for="manga-rating" class="block text-xs text-text-muted mb-1">Mi score (0-100)</label>
            <input
              id="manga-rating"
              v-model="ratingPersonal"
              type="number"
              min="0"
              max="100"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-orange/50 focus:ring-1 focus:ring-neon-orange/20 transition-colors"
              placeholder="Opcional"
            />
          </div>

          <!-- Eliminar (solo edición), con confirmación en el propio modal -->
          <div v-if="isEdit && !confirmingDelete" class="pt-1">
            <button
              type="button"
              @click="confirmingDelete = true"
              class="text-xs text-neon-pink hover:underline cursor-pointer"
            >
              Eliminar este manga
            </button>
          </div>
          <div
            v-if="isEdit && confirmingDelete"
            class="flex items-center justify-between gap-3 bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2"
            role="alert"
          >
            <span class="text-xs text-text-primary">¿Eliminar este manga de tu lista?</span>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                @click="confirmingDelete = false"
                :disabled="deleting"
                class="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-lg hover:bg-surface-3 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                @click="deleteEntry"
                :disabled="deleting"
                class="px-3 py-1.5 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {{ deleting ? 'Eliminando...' : 'Sí, eliminar' }}
              </button>
            </div>
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
              :disabled="saving || (!isEdit && !preview)"
              class="px-4 py-2 text-xs font-medium text-neon-orange border border-neon-orange/30 bg-neon-orange/10 rounded-lg hover:bg-neon-orange/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Agregar') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
