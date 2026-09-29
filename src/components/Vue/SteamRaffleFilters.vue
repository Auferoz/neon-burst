<script setup lang="ts">
/**
 * Filters of the Steam raffle. Presentational: receives the filters through
 * v-model and never touches storage or the network. Semantics (ANY-of inside a
 * group, AND across groups) live in src/utils/steamRaffle.ts.
 */
import { computed } from 'vue';
import {
  CONTROL_LABELS,
  hasActiveFilters,
  type GenreCount,
  type MetacriticMin,
  type RaffleFilters,
  type RaffleList,
} from '../../utils/steamRaffle';

const props = defineProps<{
  modelValue: RaffleFilters;
  genres: GenreCount[];
  lists: RaffleList[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: RaffleFilters];
  reset: [];
}>();

type ChipGroupKey = 'genres' | 'controls' | 'modes' | 'durations' | 'states';

interface ChipOption {
  value: string;
  label: string;
}

interface ChipGroup {
  key: ChipGroupKey;
  label: string;
  options: ChipOption[];
}

const staticGroups: ChipGroup[] = [
  {
    key: 'controls',
    label: 'Control',
    options: [
      { value: 'full', label: CONTROL_LABELS.full },
      { value: 'partial', label: CONTROL_LABELS.partial },
      { value: 'none', label: CONTROL_LABELS.none },
    ],
  },
  {
    key: 'modes',
    label: 'Modo',
    options: [
      { value: 'single', label: 'Un jugador' },
      { value: 'multi', label: 'Multijugador' },
      { value: 'coop', label: 'Cooperativo' },
    ],
  },
  {
    key: 'durations',
    label: 'Duración (historia principal)',
    options: [
      { value: 'lt5', label: '< 5 h' },
      { value: '5-15', label: '5–15 h' },
      { value: '15-30', label: '15–30 h' },
      { value: '30-60', label: '30–60 h' },
      { value: '60plus', label: '60 h+' },
    ],
  },
  {
    key: 'states',
    label: 'Estado',
    options: [
      { value: 'unplayed', label: 'Sin jugar' },
      { value: 'tried', label: 'Apenas probado' },
      { value: 'played', label: 'Jugado' },
    ],
  },
];

const groups = computed<ChipGroup[]>(() => [
  {
    key: 'genres',
    label: 'Género',
    options: props.genres.map(g => ({ value: g.name, label: `${g.name} (${g.count})` })),
  },
  ...staticGroups,
]);

const active = computed(() => hasActiveFilters(props.modelValue));

// Literal class strings: Tailwind purges anything built by interpolation.
const chipOn = 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan';
const chipOff = 'border-border-default text-text-secondary hover:border-border-hover hover:text-text-primary';

function patch(partial: Partial<RaffleFilters>) {
  emit('update:modelValue', { ...props.modelValue, ...partial });
}

function isOn(key: ChipGroupKey, value: string): boolean {
  return (props.modelValue[key] as string[]).includes(value);
}

function toggle(key: ChipGroupKey, value: string) {
  const current = props.modelValue[key] as string[];
  const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  patch({ [key]: next } as Partial<RaffleFilters>);
}

function onMetacritic(e: Event) {
  patch({ minMetacritic: Number((e.target as HTMLSelectElement).value) as MetacriticMin });
}

function onList(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  patch({ listId: value === '' ? null : Number(value) });
}

const fieldClass =
  'w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-cyan/50 transition-colors';
</script>

<template>
  <div class="space-y-4">
    <div>
      <label for="raffle-filter-name" class="block text-xs text-text-muted mb-1">Nombre</label>
      <input
        id="raffle-filter-name"
        type="text"
        :value="modelValue.name"
        placeholder="Buscar por nombre..."
        autocomplete="off"
        :class="fieldClass"
        @input="patch({ name: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <fieldset v-for="group in groups" :key="group.key" class="min-w-0">
      <legend class="text-xs text-text-muted mb-1.5">{{ group.label }}</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="opt in group.options"
          :key="opt.value"
          type="button"
          :aria-pressed="isOn(group.key, opt.value)"
          :class="isOn(group.key, opt.value) ? chipOn : chipOff"
          class="px-2.5 py-1 text-[11px] border rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
          @click="toggle(group.key, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <label
        v-if="group.key === 'durations'"
        class="mt-2 flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer"
      >
        <input
          type="checkbox"
          :checked="modelValue.includeUnknownDuration"
          :disabled="modelValue.durations.length === 0"
          class="accent-neon-cyan"
          @change="patch({ includeUnknownDuration: ($event.target as HTMLInputElement).checked })"
        />
        Incluir sin dato de duración
      </label>
    </fieldset>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="raffle-filter-metacritic" class="block text-xs text-text-muted mb-1">Metacritic mínimo</label>
        <select
          id="raffle-filter-metacritic"
          :value="modelValue.minMetacritic"
          :class="fieldClass"
          class="cursor-pointer"
          @change="onMetacritic"
        >
          <option :value="0">Cualquiera</option>
          <option :value="70">70+</option>
          <option :value="80">80+</option>
          <option :value="90">90+</option>
        </select>
      </div>
      <div>
        <label for="raffle-filter-list" class="block text-xs text-text-muted mb-1">Mis listas</label>
        <select
          id="raffle-filter-list"
          :value="modelValue.listId ?? ''"
          :class="fieldClass"
          class="cursor-pointer"
          @change="onList"
        >
          <option value="">Todos mis juegos</option>
          <option v-for="l in lists" :key="l.id" :value="l.id">{{ l.name }} ({{ l.appids.length }})</option>
        </select>
      </div>
    </div>

    <button
      type="button"
      :disabled="!active"
      class="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      @click="emit('reset')"
    >
      Limpiar filtros
    </button>
  </div>
</template>
