<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface SeriesFormData {
  id?: number;
  trakt_slug: string;
  season_number: number | '';
  year_watched: number | '';
  platform: string;
  status_viewed: string;
}

const props = defineProps<{
  open: boolean;
  entry?: SeriesFormData | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const isEdit = ref(false);
const saving = ref(false);
const error = ref('');

const form = ref<SeriesFormData>(emptyForm());

function emptyForm(): SeriesFormData {
  return {
    trakt_slug: '',
    season_number: 1,
    year_watched: new Date().getFullYear(),
    platform: '',
    status_viewed: 'completed',
  };
}

watch(() => props.open, (val) => {
  if (val) {
    if (props.entry) {
      isEdit.value = true;
      form.value = { ...props.entry };
    } else {
      isEdit.value = false;
      form.value = emptyForm();
    }
    error.value = '';
    nextTick(() => {
      document.getElementById('series-slug')?.focus();
    });
  }
});

async function save() {
  if (!form.value.trakt_slug.trim()) {
    error.value = 'El slug de Trakt es obligatorio';
    return;
  }
  if (!form.value.season_number) {
    error.value = 'La temporada es obligatoria';
    return;
  }
  if (!form.value.year_watched) {
    error.value = 'El año es obligatorio';
    return;
  }

  saving.value = true;
  error.value = '';

  const payload = {
    trakt_slug: form.value.trakt_slug.trim().toLowerCase(),
    season_number: Number(form.value.season_number),
    year_watched: Number(form.value.year_watched),
    platform: form.value.platform.trim(),
    status_viewed: form.value.status_viewed,
  };

  try {
    const url = isEdit.value ? `/api/series/${form.value.id}` : '/api/series';
    const method = isEdit.value ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  if ((e.target as HTMLElement).id === 'series-modal-backdrop') {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="series-modal-backdrop"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
    >
      <div
        class="relative w-full max-w-lg bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? 'Editar serie' : 'Agregar serie'"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 class="text-lg font-bold text-text-primary">
            {{ isEdit ? 'Editar serie' : 'Agregar serie' }}
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

        <!-- Body -->
        <form @submit.prevent="save" class="p-5 space-y-4">
          <!-- Error -->
          <div v-if="error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2">
            {{ error }}
          </div>

          <!-- Trakt Slug -->
          <div>
            <label for="series-slug" class="block text-xs text-text-muted mb-1">Trakt Slug *</label>
            <input
              id="series-slug"
              v-model="form.trakt_slug"
              type="text"
              required
              :disabled="isEdit"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-indigo/50 focus:ring-1 focus:ring-neon-indigo/20 transition-colors disabled:opacity-50"
              placeholder="ej: white-collar, solo-leveling"
            />
            <p class="text-[10px] text-text-muted mt-1">El slug de la serie en trakt.tv (parte final de la URL)</p>
          </div>

          <!-- Season + Year -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="series-season" class="block text-xs text-text-muted mb-1">Temporada *</label>
              <input
                id="series-season"
                v-model="form.season_number"
                type="number"
                min="1"
                required
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 focus:ring-1 focus:ring-neon-indigo/20 transition-colors"
                placeholder="1"
              />
            </div>
            <div>
              <label for="series-year" class="block text-xs text-text-muted mb-1">Año visto *</label>
              <input
                id="series-year"
                v-model="form.year_watched"
                type="number"
                min="2000"
                required
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 focus:ring-1 focus:ring-neon-indigo/20 transition-colors"
                :placeholder="String(new Date().getFullYear())"
              />
            </div>
          </div>

          <!-- Platform + Status -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="series-platform" class="block text-xs text-text-muted mb-1">Plataforma</label>
              <input
                id="series-platform"
                v-model="form.platform"
                type="text"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-indigo/50 focus:ring-1 focus:ring-neon-indigo/20 transition-colors"
                placeholder="Netflix, Crunchyroll..."
              />
            </div>
            <div>
              <label for="series-status" class="block text-xs text-text-muted mb-1">Estado</label>
              <select
                id="series-status"
                v-model="form.status_viewed"
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-indigo/50 transition-colors cursor-pointer"
              >
                <option value="completed">Completed</option>
                <option value="ongoing">Ongoing</option>
              </select>
            </div>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-5 border-t border-border-default">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 text-xs text-text-muted border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="save"
            :disabled="saving"
            class="px-5 py-2 text-xs font-medium text-surface-0 bg-neon-indigo rounded-lg hover:bg-neon-indigo/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {{ saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Agregar serie') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
