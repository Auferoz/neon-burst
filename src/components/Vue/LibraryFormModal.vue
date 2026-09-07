<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { STORES, OWNED_VIA } from '../../data/stores';

interface LibraryGame {
  id?: number;
  title: string;
  store: string;
  igdb_id: number | null;
  poster: string;
  artworks: string;
  released: string;
  companie: string;
  genre: string;
  description: string;
  trailer: string;
  store_url: string;
  owned_via: string;
  notes: string;
}

const props = defineProps<{ open: boolean; game: LibraryGame | null }>();
const emit = defineEmits<{ close: []; saved: [LibraryGame] }>();

function emptyForm(): LibraryGame {
  return {
    title: '',
    store: STORES[0],
    igdb_id: null,
    poster: '',
    artworks: '',
    released: '',
    companie: '',
    genre: '',
    description: '',
    trailer: '',
    store_url: '',
    owned_via: 'Compra',
    notes: '',
  };
}

const form = ref<LibraryGame>(emptyForm());
const isEdit = ref(false);
const saving = ref(false);
const saveError = ref('');

const igdbQuery = ref('');
const igdbLoading = ref(false);
const igdbError = ref('');
const igdbMessage = ref('');

/** Fields IGDB is allowed to overwrite — everything else stays user-owned. */
const IGDB_FIELDS = [
  'title',
  'released',
  'companie',
  'genre',
  'poster',
  'artworks',
  'trailer',
  'description',
] as const;

const FIELD_LABELS: Record<string, string> = {
  title: 'título',
  released: 'lanzamiento',
  companie: 'compañía',
  genre: 'géneros',
  poster: 'carátula',
  artworks: 'artwork',
  trailer: 'trailer',
  description: 'descripción',
};

async function importFromIgdb() {
  if (!igdbQuery.value.trim() || igdbLoading.value) return;

  igdbLoading.value = true;
  igdbError.value = '';
  igdbMessage.value = '';

  try {
    const res = await fetch(`/api/igdb/lookup?q=${encodeURIComponent(igdbQuery.value.trim())}`);
    const data = await res.json();

    if (!res.ok) {
      igdbError.value = (data as any).error || 'No se pudo consultar IGDB';
      return;
    }

    const filled: string[] = [];
    for (const field of IGDB_FIELDS) {
      const value = (data as any)[field];
      if (value) {
        (form.value as any)[field] = value;
        filled.push(FIELD_LABELS[field]);
      }
    }
    if ((data as any).igdb_id) form.value.igdb_id = (data as any).igdb_id;

    igdbMessage.value = filled.length
      ? `Datos cargados: ${filled.join(', ')}`
      : 'IGDB no devolvió datos utilizables';
  } catch (e) {
    igdbError.value = (e as Error).message || 'Error de red';
  } finally {
    igdbLoading.value = false;
  }
}

async function save() {
  if (!form.value.title.trim()) {
    saveError.value = 'El título es obligatorio';
    return;
  }

  saving.value = true;
  saveError.value = '';

  const payload = {
    ...form.value,
    title: form.value.title.trim(),
    igdb_id: form.value.igdb_id ? Number(form.value.igdb_id) : null,
  };

  try {
    const url = isEdit.value ? `/api/library/${form.value.id}` : '/api/library';
    const res = await fetch(url, {
      method: isEdit.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      saveError.value = (data as any).error || 'No se pudo guardar';
      return;
    }

    emit('saved', data as LibraryGame);
    emit('close');
  } catch (e) {
    saveError.value = (e as Error).message || 'Error de red';
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    isEdit.value = !!props.game;
    form.value = props.game ? { ...props.game } : emptyForm();
    igdbQuery.value = '';
    igdbError.value = '';
    igdbMessage.value = '';
    saveError.value = '';
    await nextTick();
    const target = document.getElementById(isEdit.value ? 'lib-title' : 'lib-igdb-query');
    target?.focus();
  },
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/80 backdrop-blur-sm p-4 sm:p-8"
    role="dialog"
    aria-modal="true"
    aria-labelledby="lib-modal-title"
    @keydown.esc="emit('close')"
  >
    <div class="w-full max-w-2xl bg-surface-1 border border-border-default rounded-xl my-auto">
      <div class="flex items-center justify-between gap-4 p-4 border-b border-border-default">
        <h2 id="lib-modal-title" class="text-sm font-semibold text-neon-yellow">
          {{ isEdit ? 'Editar juego' : 'Añadir juego a la biblioteca' }}
        </h2>
        <button
          type="button"
          class="text-text-muted hover:text-text-primary transition-colors cursor-pointer text-lg leading-none px-2"
          aria-label="Cerrar"
          @click="emit('close')"
        >×</button>
      </div>

      <form class="p-4 space-y-4" @submit.prevent="save">
        <!-- IGDB autocomplete -->
        <div class="bg-surface-2 border border-border-default rounded-lg p-3 space-y-2">
          <label for="lib-igdb-query" class="block text-xs font-medium text-text-secondary">
            Autocompletar desde IGDB
          </label>
          <div class="flex gap-2">
            <input
              id="lib-igdb-query"
              v-model="igdbQuery"
              type="text"
              placeholder="URL de IGDB, slug o ID"
              class="flex-1 bg-surface-1 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-neon-yellow/40 focus-visible:outline-none"
              @keydown.enter.prevent="importFromIgdb"
            />
            <button
              type="button"
              :disabled="igdbLoading"
              class="px-3 py-2 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              @click="importFromIgdb"
            >{{ igdbLoading ? 'Buscando...' : 'Buscar' }}</button>
          </div>
          <p v-if="igdbMessage" class="text-[11px] text-neon-green">✓ {{ igdbMessage }}</p>
          <p v-if="igdbError" class="text-[11px] text-neon-pink" role="alert">✗ {{ igdbError }}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label for="lib-title" class="block text-xs text-text-secondary mb-1">Título *</label>
            <input
              id="lib-title"
              v-model="form.title"
              type="text"
              required
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div>
            <label for="lib-store" class="block text-xs text-text-secondary mb-1">Tienda *</label>
            <select
              id="lib-store"
              v-model="form.store"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            >
              <option v-for="s in STORES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div>
            <label for="lib-owned" class="block text-xs text-text-secondary mb-1">Adquirido por</label>
            <select
              id="lib-owned"
              v-model="form.owned_via"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            >
              <option v-for="o in OWNED_VIA" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>

          <div>
            <label for="lib-released" class="block text-xs text-text-secondary mb-1">
              Lanzamiento (DD/MM/YYYY)
            </label>
            <input
              id="lib-released"
              v-model="form.released"
              type="text"
              placeholder="15/10/2019"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div>
            <label for="lib-companie" class="block text-xs text-text-secondary mb-1">Compañía</label>
            <input
              id="lib-companie"
              v-model="form.companie"
              type="text"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="lib-genre" class="block text-xs text-text-secondary mb-1">Géneros</label>
            <input
              id="lib-genre"
              v-model="form.genre"
              type="text"
              placeholder="Action, RPG"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div>
            <label for="lib-poster" class="block text-xs text-text-secondary mb-1">
              Poster (IGDB image_id)
            </label>
            <input
              id="lib-poster"
              v-model="form.poster"
              type="text"
              placeholder="co1sfj"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div>
            <label for="lib-artworks" class="block text-xs text-text-secondary mb-1">
              Artwork (IGDB image_id)
            </label>
            <input
              id="lib-artworks"
              v-model="form.artworks"
              type="text"
              placeholder="ar4pd7"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="lib-store-url" class="block text-xs text-text-secondary mb-1">
              URL en la tienda
            </label>
            <input
              id="lib-store-url"
              v-model="form.store_url"
              type="url"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="lib-notes" class="block text-xs text-text-secondary mb-1">Notas</label>
            <textarea
              id="lib-notes"
              v-model="form.notes"
              rows="2"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none resize-y"
            ></textarea>
          </div>
        </div>

        <p v-if="saveError" class="text-[11px] text-neon-pink" role="alert">✗ {{ saveError }}</p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
          <button
            type="button"
            class="px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            @click="emit('close')"
          >Cancelar</button>
          <button
            type="submit"
            :disabled="saving"
            class="px-4 py-2 text-xs font-medium text-neon-yellow border border-neon-yellow/30 rounded-lg hover:bg-neon-yellow/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >{{ saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Añadir' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
