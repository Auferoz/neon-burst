<script setup lang="ts">
/**
 * "Guardar lista" of the raffle tab. Presentational: saves the games still in
 * the pool (marked ones) as a new list, or overwrites the list currently used
 * as filter. The container owns the request and the resulting state.
 */
import { ref, computed, watch, nextTick } from 'vue';
import type { RaffleList } from '../../utils/steamRaffle';

const props = defineProps<{
  count: number;
  /** List selected in the filters, if any: offered as "replace". */
  activeList: RaffleList | null;
  busy: boolean;
  error: string;
  /** Success message from the last save; cleared by the container. */
  saved: string;
}>();

const emit = defineEmits<{
  saveNew: [name: string];
  replace: [id: number];
}>();

const NAME_MAX = 60;

const open = ref(false);
const mode = ref<'new' | 'replace'>('new');
const name = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

const trimmed = computed(() => name.value.trim());
const canSubmit = computed(() =>
  !props.busy && props.count > 0 && (mode.value === 'replace' ? !!props.activeList : trimmed.value.length > 0),
);
const countText = computed(() => `${props.count} ${props.count === 1 ? 'juego' : 'juegos'}`);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    mode.value = 'new';
    nextTick(() => nameInput.value?.focus());
  }
}

function submit() {
  if (!canSubmit.value) return;
  if (mode.value === 'replace' && props.activeList) emit('replace', props.activeList.id);
  else emit('saveNew', trimmed.value);
}

// Close the form once the container reports a successful save.
watch(() => props.saved, msg => {
  if (msg) {
    open.value = false;
    name.value = '';
  }
});

watch(() => props.activeList, list => {
  if (!list && mode.value === 'replace') mode.value = 'new';
});
</script>

<template>
  <div class="w-full">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="count === 0"
        :aria-expanded="open"
        aria-controls="raffle-save-list-form"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-neon-cyan border border-neon-cyan/40 rounded-lg hover:bg-neon-cyan/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed"
        @click="toggle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
        </svg>
        Guardar como lista
      </button>
      <p v-if="saved" class="text-[11px] text-neon-green" role="status">{{ saved }}</p>
    </div>

    <form
      v-if="open"
      id="raffle-save-list-form"
      class="mt-3 p-3 rounded-xl border border-neon-cyan/25 bg-surface-2/60 space-y-3"
      aria-label="Guardar los juegos marcados como lista"
      @submit.prevent="submit"
    >
      <p class="text-[11px] text-text-secondary">
        Se guardan los <strong class="text-neon-cyan">{{ countText }}</strong> que siguen marcados en el bombo.
      </p>

      <fieldset v-if="activeList" class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
        <legend class="sr-only">Dónde guardar</legend>
        <label class="inline-flex items-center gap-1.5 cursor-pointer">
          <input v-model="mode" type="radio" value="new" class="accent-neon-cyan" />
          Lista nueva
        </label>
        <label class="inline-flex items-center gap-1.5 cursor-pointer">
          <input v-model="mode" type="radio" value="replace" class="accent-neon-cyan" />
          Reemplazar «{{ activeList.name }}»
        </label>
      </fieldset>

      <div v-if="mode === 'new'">
        <label for="raffle-save-list-name" class="block text-[11px] text-text-muted mb-1">Nombre de la lista</label>
        <input
          id="raffle-save-list-name"
          ref="nameInput"
          v-model="name"
          type="text"
          :maxlength="NAME_MAX"
          placeholder="Ej: Para este finde"
          class="w-full px-3 py-1.5 text-xs bg-surface-1 border border-border-input rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/60"
        />
      </div>
      <p v-else class="text-[11px] text-neon-orange">
        Se reemplaza el contenido de «{{ activeList?.name }}» por estos juegos.
      </p>

      <p v-if="error" class="text-[11px] text-neon-pink" role="alert">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-[11px] text-text-secondary border border-border-default rounded-lg hover:text-text-primary transition-colors cursor-pointer"
          @click="open = false"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="!canSubmit"
          class="px-3 py-1.5 text-[11px] font-semibold text-neon-cyan border border-neon-cyan/50 bg-neon-cyan/10 rounded-lg hover:bg-neon-cyan/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ busy ? 'Guardando…' : mode === 'replace' ? 'Reemplazar' : 'Guardar' }}
        </button>
      </div>
    </form>
  </div>
</template>
