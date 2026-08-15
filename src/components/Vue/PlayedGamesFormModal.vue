<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface DateEntry {
  year: number | '';
  fecha_inicio: string;
  fecha_final: string;
  horas: number | '';
}

interface GameData {
  id?: number;
  title: string;
  released: string;
  companie: string;
  poster: string;
  trailer: string;
  artworks: string;
  genre: string;
  estado: string;
  logros_obt: number | '';
  logros_total: number | '';
  console_pc: string;
  igdb_id: number | '' ;
  first_year_played: number | '';
  description: string;
  rating_metacritic: number | '';
  rating_rawg: number | '';
  is_demo: boolean;
  is_early_access: boolean;
  is_testing: boolean;
  dates_played: DateEntry[];
}

const props = defineProps<{
  open: boolean;
  game?: GameData | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [game: GameData];
}>();

const isEdit = ref(false);
const saving = ref(false);
const error = ref('');

const form = ref<GameData>(emptyForm());

// --- Autocompletar desde IGDB ---
const igdbQuery = ref('');
const importing = ref(false);
const importError = ref('');
const importedFields = ref<string[]>([]);

/** Campos que rellena IGDB; el resto los completa el usuario a mano. */
const IGDB_FIELDS = [
  'title', 'released', 'companie', 'console_pc', 'genre',
  'poster', 'artworks', 'trailer', 'description',
] as const;

const FIELD_LABELS: Record<string, string> = {
  title: 'Título', released: 'Lanzamiento', companie: 'Compañía',
  console_pc: 'Plataforma', genre: 'Géneros', poster: 'Poster',
  artworks: 'Artwork', trailer: 'Trailer', description: 'Descripción',
};

async function importFromIgdb() {
  const q = igdbQuery.value.trim();
  if (!q || importing.value) return;

  importing.value = true;
  importError.value = '';
  importedFields.value = [];

  try {
    const res = await fetch(`/api/igdb/lookup?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data as any).error || `Error ${res.status}`);
    }

    const filled: string[] = [];
    for (const field of IGDB_FIELDS) {
      const value = (data as any)[field];
      if (value) {
        (form.value as any)[field] = value;
        filled.push(FIELD_LABELS[field]!);
      }
    }
    form.value.igdb_id = (data as any).igdb_id || '';

    importedFields.value = filled;
    error.value = '';
  } catch (e) {
    importError.value = (e as Error).message;
  } finally {
    importing.value = false;
  }
}

function emptyForm(): GameData {
  return {
    title: '', released: '', companie: '', poster: '', trailer: '',
    artworks: '', genre: '', estado: 'Jugando',
    logros_obt: '', logros_total: '', console_pc: '', igdb_id: '',
    first_year_played: '', description: '', rating_metacritic: '',
    rating_rawg: '', is_demo: false, is_early_access: false, is_testing: false, dates_played: [],
  };
}

watch(() => props.open, (val) => {
  if (val) {
    if (props.game) {
      isEdit.value = true;
      form.value = {
        ...props.game,
        logros_obt: props.game.logros_obt || '',
        logros_total: props.game.logros_total || '',
        igdb_id: props.game.igdb_id || '',
        first_year_played: props.game.first_year_played || '',
        rating_metacritic: props.game.rating_metacritic || '',
        rating_rawg: props.game.rating_rawg || '',
        is_demo: !!props.game.is_demo,
        is_early_access: !!props.game.is_early_access,
        is_testing: !!props.game.is_testing,
        dates_played: props.game.dates_played?.length
          ? props.game.dates_played.map(d => ({ ...d }))
          : [],
      };
    } else {
      isEdit.value = false;
      form.value = emptyForm();
    }
    error.value = '';
    igdbQuery.value = '';
    importError.value = '';
    importedFields.value = [];
    nextTick(() => {
      // Al crear, el flujo natural empieza por el importador de IGDB
      document.getElementById(isEdit.value ? 'game-title' : 'game-igdb-query')?.focus();
    });
  }
});

function addDate() {
  form.value.dates_played.push({ year: '', fecha_inicio: '', fecha_final: '', horas: '' });
}

function removeDate(i: number) {
  form.value.dates_played.splice(i, 1);
}

async function save() {
  if (!form.value.title.trim()) {
    error.value = 'El título es obligatorio';
    return;
  }

  saving.value = true;
  error.value = '';

  const payload = {
    ...form.value,
    logros_obt: Number(form.value.logros_obt) || 0,
    logros_total: Number(form.value.logros_total) || 0,
    igdb_id: Number(form.value.igdb_id) || null,
    first_year_played: Number(form.value.first_year_played) || null,
    rating_metacritic: Number(form.value.rating_metacritic) || null,
    rating_rawg: Number(form.value.rating_rawg) || null,
    is_demo: form.value.is_demo ? 1 : 0,
    is_early_access: form.value.is_early_access ? 1 : 0,
    is_testing: form.value.is_testing ? 1 : 0,
    dates_played: form.value.dates_played
      .filter(d => d.year)
      .map(d => ({
        year: Number(d.year),
        fecha_inicio: d.fecha_inicio,
        fecha_final: d.fecha_final,
        horas: Number(d.horas) || 0,
      })),
  };

  try {
    const url = isEdit.value ? `/api/games/${form.value.id}` : '/api/games';
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

    const saved = await res.json();
    emit('saved', saved);
    emit('close');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).id === 'modal-backdrop') {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      id="modal-backdrop"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      @mousedown="onBackdrop"
    >
      <div
        class="relative w-full max-w-2xl bg-surface-1 border border-border-default rounded-2xl shadow-2xl my-4"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? 'Editar juego' : 'Agregar juego'"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-default">
          <h2 class="text-lg font-bold text-text-primary">
            {{ isEdit ? 'Editar juego' : 'Agregar juego' }}
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
        <form @submit.prevent="save" class="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <!-- Error -->
          <div v-if="error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2">
            {{ error }}
          </div>

          <!-- Autocompletar desde IGDB -->
          <div class="border border-neon-cyan/20 bg-neon-cyan/5 rounded-lg p-3 space-y-2">
            <label for="game-igdb-query" class="flex items-center gap-2 text-xs text-neon-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
              </svg>
              Autocompletar desde IGDB
            </label>

            <div class="flex flex-col sm:flex-row gap-2">
              <input
                id="game-igdb-query"
                v-model="igdbQuery"
                type="text"
                :disabled="importing"
                @keydown.enter.prevent="importFromIgdb"
                class="flex-1 bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 disabled:opacity-50 transition-colors"
                placeholder="https://www.igdb.com/games/bright-memory  ·  bright-memory  ·  103298"
              />
              <button
                type="button"
                @click="importFromIgdb"
                :disabled="importing || !igdbQuery.trim()"
                class="px-4 py-2 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                {{ importing ? 'Buscando...' : 'Traer datos' }}
              </button>
            </div>

            <p v-if="importError" class="text-xs text-neon-pink">{{ importError }}</p>
            <p v-else-if="importedFields.length" class="text-xs text-neon-green">
              Datos cargados: {{ importedFields.join(', ') }}. Revisa y completa el resto.
            </p>
            <p v-else class="text-[11px] text-text-muted">
              Pega la URL del juego en IGDB, su slug o su ID. Sobrescribe los campos que IGDB tenga.
            </p>
          </div>

          <!-- Title + Estado -->
          <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label for="game-title" class="block text-xs text-text-muted mb-1">Título *</label>
              <input
                id="game-title"
                v-model="form.title"
                type="text"
                required
                class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors"
                placeholder="Nombre del juego"
              />
            </div>
            <div>
              <label for="game-estado" class="block text-xs text-text-muted mb-1">Estado</label>
              <select
                id="game-estado"
                v-model="form.estado"
                class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors cursor-pointer"
              >
                <option value="Jugando">Jugando</option>
                <option value="Recurrente">Recurrente</option>
                <option value="Pausado">Pausado</option>
                <option value="Completado">Completado</option>
                <option value="Abandonado">Abandonado</option>
              </select>
            </div>
          </div>

          <!-- Marcas: Demo / Early Access / Review -->
          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="form.is_demo"
                class="w-4 h-4 rounded border-border-default bg-surface-2 text-neon-purple accent-neon-purple cursor-pointer"
              />
              <span class="text-xs text-text-secondary">Demo</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="form.is_early_access"
                class="w-4 h-4 rounded border-border-default bg-surface-2 text-neon-yellow accent-neon-yellow cursor-pointer"
              />
              <span class="text-xs text-text-secondary">Early Access</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="form.is_testing"
                class="w-4 h-4 rounded border-border-default bg-surface-2 text-neon-cyan accent-neon-cyan cursor-pointer"
              />
              <span class="text-xs text-text-secondary">Review</span>
            </label>
          </div>

          <!-- Company + Released + Platform -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label for="game-companie" class="block text-xs text-text-muted mb-1">Compañía</label>
              <input id="game-companie" v-model="form.companie" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="Studio / Publisher" />
            </div>
            <div>
              <label for="game-released" class="block text-xs text-text-muted mb-1">Lanzamiento</label>
              <input id="game-released" v-model="form.released" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="2024" />
            </div>
            <div>
              <label for="game-platform" class="block text-xs text-text-muted mb-1">Plataforma</label>
              <input id="game-platform" v-model="form.console_pc" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="PC, Xbox, PS5..." />
            </div>
          </div>

          <!-- Genre -->
          <div>
            <label for="game-genre" class="block text-xs text-text-muted mb-1">Géneros</label>
            <input id="game-genre" v-model="form.genre" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="RPG, Acción, Aventura..." />
          </div>

          <!-- Media IDs -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label for="game-poster" class="block text-xs text-text-muted mb-1">Poster (IGDB ID)</label>
              <input id="game-poster" v-model="form.poster" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="co1234" />
            </div>
            <div>
              <label for="game-artworks" class="block text-xs text-text-muted mb-1">Artwork (IGDB ID)</label>
              <input id="game-artworks" v-model="form.artworks" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="ar1234" />
            </div>
            <div>
              <label for="game-trailer" class="block text-xs text-text-muted mb-1">Trailer (YouTube ID)</label>
              <input id="game-trailer" v-model="form.trailer" type="text" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="dQw4w9WgXcQ" />
            </div>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label for="game-logros-obt" class="block text-xs text-text-muted mb-1">Logros obt.</label>
              <input id="game-logros-obt" v-model="form.logros_obt" type="number" min="0" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="0" />
            </div>
            <div>
              <label for="game-logros-total" class="block text-xs text-text-muted mb-1">Logros total</label>
              <input id="game-logros-total" v-model="form.logros_total" type="number" min="0" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="0" />
            </div>
            <div>
              <label for="game-first-year" class="block text-xs text-text-muted mb-1">Primer año</label>
              <input id="game-first-year" v-model="form.first_year_played" type="number" min="1990" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="2024" />
            </div>
          </div>

          <!-- Ratings + IGDB -->
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label for="game-mc" class="block text-xs text-text-muted mb-1">Metacritic</label>
              <input id="game-mc" v-model="form.rating_metacritic" type="number" min="0" max="100" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="0-100" />
            </div>
            <div>
              <label for="game-rawg" class="block text-xs text-text-muted mb-1">RAWG</label>
              <input id="game-rawg" v-model="form.rating_rawg" type="number" step="0.01" min="0" max="5" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="0-5" />
            </div>
            <div>
              <label for="game-igdb" class="block text-xs text-text-muted mb-1">IGDB ID</label>
              <input id="game-igdb" v-model="form.igdb_id" type="number" class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors" placeholder="12345" />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label for="game-desc" class="block text-xs text-text-muted mb-1">Descripción</label>
            <textarea
              id="game-desc"
              v-model="form.description"
              rows="3"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors resize-y"
              placeholder="Descripción del juego..."
            />
          </div>

          <!-- Dates played -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-text-muted">Historial de juego</label>
              <button
                type="button"
                @click="addDate"
                class="text-xs text-neon-blue hover:text-neon-cyan transition-colors cursor-pointer flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Añadir
              </button>
            </div>

            <div v-if="form.dates_played.length === 0" class="text-xs text-text-muted border border-dashed border-border-default rounded-lg p-3 text-center">
              Sin registros de fechas
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(d, i) in form.dates_played"
                :key="i"
                class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end"
              >
                <div>
                  <label v-if="i === 0" class="block text-[10px] text-text-muted mb-1">Año</label>
                  <input v-model="d.year" type="number" min="1990" placeholder="2024" class="w-full bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors" />
                </div>
                <div>
                  <label v-if="i === 0" class="block text-[10px] text-text-muted mb-1">Inicio</label>
                  <input v-model="d.fecha_inicio" type="text" placeholder="01/01/2024" class="w-full bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors" />
                </div>
                <div>
                  <label v-if="i === 0" class="block text-[10px] text-text-muted mb-1">Final</label>
                  <input v-model="d.fecha_final" type="text" placeholder="31/01/2024" class="w-full bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors" />
                </div>
                <div>
                  <label v-if="i === 0" class="block text-[10px] text-text-muted mb-1">Horas</label>
                  <input v-model="d.horas" type="number" step="0.1" min="0" placeholder="0" class="w-full bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors" />
                </div>
                <button
                  type="button"
                  @click="removeDate(i)"
                  class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-neon-pink hover:bg-neon-pink/10 transition-colors cursor-pointer"
                  :class="{ 'mt-4': i === 0 }"
                  aria-label="Eliminar fecha"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
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
            class="px-5 py-2 text-xs font-medium text-surface-0 bg-neon-blue rounded-lg hover:bg-neon-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {{ saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear juego') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
