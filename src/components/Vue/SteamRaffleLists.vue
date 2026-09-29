<script setup lang="ts">
/**
 * "Listas" tab of the Steam raffle. Presentational: it emits the intent
 * (create / rename / remove / add item / remove item) and the container talks
 * to the API. Games are only ever added by searching the loaded library
 * (name -> appid), never by free text.
 */
import { ref, computed, watch } from 'vue';
import { normalizeText, type RaffleGame, type RaffleList } from '../../utils/steamRaffle';

const props = defineProps<{
  lists: RaffleList[];
  games: RaffleGame[];
  loading: boolean;
  busy: boolean;
  error: string;
}>();

const emit = defineEmits<{
  create: [name: string];
  rename: [id: number, name: string];
  remove: [id: number];
  addItem: [listId: number, appid: number];
  removeItem: [listId: number, appid: number];
}>();

const NAME_MAX = 60;
const MAX_SUGGESTIONS = 8;

const selectedId = ref<number | null>(null);
const newName = ref('');
const renaming = ref(false);
const renameValue = ref('');
const confirmingDelete = ref(false);

const query = ref('');
const suggestionsOpen = ref(false);
const activeIndex = ref(-1);

const selected = computed(() => props.lists.find(l => l.id === selectedId.value) ?? null);
const gamesByAppid = computed(() => new Map(props.games.map(g => [g.appid, g])));

const items = computed(() =>
  (selected.value?.appids ?? []).map(appid => ({
    appid,
    game: gamesByAppid.value.get(appid) ?? null,
  })),
);

const suggestions = computed<RaffleGame[]>(() => {
  const q = normalizeText(query.value);
  if (!q || !selected.value) return [];
  const inList = new Set(selected.value.appids);
  const matches = props.games.filter(g => !inList.has(g.appid) && normalizeText(g.name).includes(q));
  matches.sort((a, b) => {
    const aStarts = normalizeText(a.name).startsWith(q) ? 0 : 1;
    const bStarts = normalizeText(b.name).startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.name.localeCompare(b.name, 'es');
  });
  return matches.slice(0, MAX_SUGGESTIONS);
});

const listboxOpen = computed(() => suggestionsOpen.value && suggestions.value.length > 0);

watch(suggestions, () => {
  activeIndex.value = suggestions.value.length > 0 ? 0 : -1;
});

// The container owns the data: react to what it confirms.
let previousIds: number[] = props.lists.map(l => l.id);
watch(
  () => props.lists,
  lists => {
    const created = lists.find(l => !previousIds.includes(l.id));
    if (created) {
      selectedId.value = created.id;
      newName.value = '';
    }
    previousIds = lists.map(l => l.id);

    if (selectedId.value !== null && !lists.some(l => l.id === selectedId.value)) {
      selectedId.value = null;
      confirmingDelete.value = false;
    }
    if (renaming.value && selected.value && selected.value.name === renameValue.value.trim()) {
      renaming.value = false;
    }
  },
);

function selectList(id: number) {
  selectedId.value = id;
  renaming.value = false;
  confirmingDelete.value = false;
  query.value = '';
  suggestionsOpen.value = false;
}

function submitCreate() {
  const name = newName.value.trim();
  if (!name || props.busy) return;
  emit('create', name);
}

function startRename() {
  if (!selected.value) return;
  renameValue.value = selected.value.name;
  renaming.value = true;
}

function submitRename() {
  const name = renameValue.value.trim();
  if (!selected.value || !name || props.busy) return;
  if (name === selected.value.name) {
    renaming.value = false;
    return;
  }
  emit('rename', selected.value.id, name);
}

function confirmDelete() {
  if (!selected.value) return;
  emit('remove', selected.value.id);
}

function pick(game: RaffleGame) {
  if (!selected.value) return;
  emit('addItem', selected.value.id, game.appid);
  query.value = '';
  suggestionsOpen.value = false;
}

function onQueryKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' && suggestions.value.length > 0) {
    e.preventDefault();
    suggestionsOpen.value = true;
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
  } else if (e.key === 'ArrowUp' && suggestions.value.length > 0) {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
  } else if (e.key === 'Enter' && listboxOpen.value && activeIndex.value >= 0) {
    e.preventDefault();
    pick(suggestions.value[activeIndex.value]);
  } else if (e.key === 'Escape' && listboxOpen.value) {
    // Close only the suggestions; the modal must stay open.
    e.stopPropagation();
    suggestionsOpen.value = false;
  }
}

function optionId(g: RaffleGame): string {
  return `raffle-list-option-${g.appid}`;
}

const activeDescendant = computed(() => {
  const g = suggestions.value[activeIndex.value];
  return listboxOpen.value && g ? optionId(g) : undefined;
});

const inputClass =
  'w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/50 transition-colors';
const btnClass =
  'px-3 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnMutedClass =
  'px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer disabled:opacity-50';
</script>

<template>
  <div class="space-y-5">
    <p v-if="error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2" role="alert">
      {{ error }}
    </p>

    <!-- Create -->
    <form class="flex gap-2" @submit.prevent="submitCreate">
      <div class="flex-1 min-w-0">
        <label for="raffle-new-list" class="sr-only">Nombre de la nueva lista</label>
        <input
          id="raffle-new-list"
          v-model="newName"
          type="text"
          :maxlength="NAME_MAX"
          placeholder="Nombre de la nueva lista"
          autocomplete="off"
          :class="inputClass"
        />
      </div>
      <button type="submit" :disabled="busy || !newName.trim()" :class="btnClass">Crear lista</button>
    </form>

    <p v-if="loading" class="text-xs text-text-muted animate-pulse" role="status">Cargando listas...</p>
    <p v-else-if="lists.length === 0" class="text-xs text-text-muted">
      Todavía no tienes listas. Crea una para sortear solo entre los juegos que elijas.
    </p>

    <!-- Lists -->
    <div v-else class="flex flex-wrap gap-1.5" role="group" aria-label="Mis listas">
      <button
        v-for="l in lists"
        :key="l.id"
        type="button"
        :aria-pressed="l.id === selectedId"
        :class="l.id === selectedId
          ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
          : 'border-border-default text-text-secondary hover:border-border-hover hover:text-text-primary'"
        class="px-2.5 py-1 text-[11px] border rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
        @click="selectList(l.id)"
      >
        {{ l.name }} ({{ l.appids.length }})
      </button>
    </div>

    <!-- Selected list -->
    <section v-if="selected" class="border border-border-default rounded-xl p-4 space-y-4" :aria-label="`Lista ${selected.name}`">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <form v-if="renaming" class="flex flex-1 min-w-48 gap-2" @submit.prevent="submitRename">
          <label for="raffle-rename-list" class="sr-only">Nuevo nombre de la lista</label>
          <input
            id="raffle-rename-list"
            v-model="renameValue"
            type="text"
            :maxlength="NAME_MAX"
            autocomplete="off"
            :class="inputClass"
            @keydown.esc.stop="renaming = false"
          />
          <button type="submit" :disabled="busy || !renameValue.trim()" :class="btnClass">Guardar</button>
          <button type="button" :class="btnMutedClass" @click="renaming = false">Cancelar</button>
        </form>
        <template v-else>
          <h3 class="text-sm font-semibold text-text-primary min-w-0 truncate">{{ selected.name }}</h3>
          <div v-if="!confirmingDelete" class="flex gap-2 shrink-0">
            <button type="button" :class="btnMutedClass" @click="startRename">Renombrar</button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer"
              @click="confirmingDelete = true"
            >
              Eliminar
            </button>
          </div>
        </template>
      </div>

      <!-- Delete confirmation, inside the modal -->
      <div
        v-if="confirmingDelete"
        class="flex flex-wrap items-center justify-between gap-3 bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2"
        role="alert"
      >
        <span class="text-xs text-text-primary">¿Eliminar la lista "{{ selected.name }}"?</span>
        <div class="flex gap-2 shrink-0">
          <button type="button" :disabled="busy" :class="btnMutedClass" @click="confirmingDelete = false">Cancelar</button>
          <button
            type="button"
            :disabled="busy"
            :aria-label="`Confirmar eliminación de la lista ${selected.name}`"
            class="px-3 py-1.5 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/20 transition-colors cursor-pointer disabled:opacity-50"
            @click="confirmDelete"
          >
            Sí, eliminar
          </button>
        </div>
      </div>

      <!-- Library autocomplete -->
      <div class="relative">
        <label for="raffle-list-search" class="block text-xs text-text-muted mb-1">Agregar juego de tu biblioteca</label>
        <input
          id="raffle-list-search"
          v-model="query"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="raffle-list-suggestions"
          :aria-expanded="listboxOpen"
          :aria-activedescendant="activeDescendant"
          placeholder="Escribe el nombre del juego..."
          autocomplete="off"
          :class="inputClass"
          @input="suggestionsOpen = true"
          @focus="suggestionsOpen = true"
          @blur="suggestionsOpen = false"
          @keydown="onQueryKeydown"
        />
        <ul
          v-show="listboxOpen"
          id="raffle-list-suggestions"
          role="listbox"
          aria-label="Juegos de la biblioteca"
          class="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto bg-surface-2 border border-border-hover rounded-lg shadow-xl"
        >
          <li
            v-for="(g, i) in suggestions"
            :id="optionId(g)"
            :key="g.appid"
            role="option"
            :aria-selected="i === activeIndex"
            :class="i === activeIndex ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-primary'"
            class="px-3 py-2 text-xs cursor-pointer truncate"
            @mousedown.prevent="pick(g)"
            @mousemove="activeIndex = i"
          >
            {{ g.name }}
          </li>
        </ul>
        <p v-if="query.trim() && suggestions.length === 0" class="text-[11px] text-text-muted mt-1">
          Ningún juego de tu biblioteca coincide (o ya está en la lista).
        </p>
      </div>

      <!-- Items -->
      <p v-if="items.length === 0" class="text-xs text-text-muted">Esta lista está vacía.</p>
      <ul v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Juegos de la lista">
        <li
          v-for="item in items"
          :key="item.appid"
          class="flex items-center justify-between gap-2 bg-surface-2 border border-border-default rounded-lg px-3 py-2"
        >
          <span class="text-xs text-text-primary truncate">
            {{ item.game ? item.game.name : `Juego ${item.appid} (ya no está en la biblioteca)` }}
          </span>
          <button
            type="button"
            class="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-neon-pink hover:bg-neon-pink/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
            :aria-label="`Quitar ${item.game ? item.game.name : item.appid} de la lista`"
            :disabled="busy"
            @click="emit('removeItem', selected.id, item.appid)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
