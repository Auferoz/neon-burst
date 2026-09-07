<script setup lang="ts">
/** Filter bar for the library. Owns no state: every control is a v-model bound to the container. */
import type { SortBy, DataFilter } from '../../utils/libraryFilters';

defineProps<{
  activeStores: readonly string[];
  countByStore: Record<string, number>;
  incompleteCount: number;
  shownCount: number;
  totalCount: number;
}>();

const search = defineModel<string>('search', { required: true });
const store = defineModel<string>('store', { required: true });
const sort = defineModel<SortBy>('sort', { required: true });
const data = defineModel<DataFilter>('data', { required: true });

const controlClass =
  'bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-neon-yellow/40 focus-visible:outline-none transition-colors';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <input
      v-model="search"
      type="search"
      placeholder="Buscar juego..."
      aria-label="Buscar juego"
      :class="controlClass"
      class="placeholder:text-text-muted"
    />

    <select v-model="store" aria-label="Filtrar por tienda" :class="controlClass">
      <option value="">Todas las tiendas</option>
      <option v-for="s in activeStores" :key="s" :value="s">
        {{ s }} ({{ countByStore[s] }})
      </option>
    </select>

    <select v-model="data" aria-label="Filtrar por estado de los datos" :class="controlClass">
      <option value="all">Todos los datos</option>
      <option value="incomplete">Sin información ({{ incompleteCount }})</option>
      <option value="complete">Solo completos</option>
    </select>

    <select v-model="sort" aria-label="Ordenar" :class="controlClass">
      <option value="title">Título (A-Z)</option>
      <option value="released">Lanzamiento</option>
      <option value="recent">Añadidos recientemente</option>
      <option value="stores">Más tiendas primero</option>
    </select>

    <span class="ml-auto text-xs text-text-muted">
      {{ shownCount }} de {{ totalCount }}
    </span>
  </div>
</template>
