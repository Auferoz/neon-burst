<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  años: number[];
  estados: string[];
  plataformas: string[];
  /** Demo / Early Access / Review. El value es la columna de la flag. */
  marcas: readonly { value: string; label: string }[];
  selectedAño: string;
  selectedEstado: string;
  selectedPlataforma: string;
  selectedMarca: string;
  searchQuery: string;
  totalGames: number;
  filteredCount: number;
}>();

const emit = defineEmits<{
  'update:selectedAño': [value: string];
  'update:selectedEstado': [value: string];
  'update:selectedPlataforma': [value: string];
  'update:selectedMarca': [value: string];
  'update:searchQuery': [value: string];
}>();

const hasActiveFilters = computed(() =>
  props.selectedAño !== '' || props.selectedEstado !== '' ||
  props.selectedPlataforma !== '' || props.selectedMarca !== '' ||
  props.searchQuery !== ''
);
</script>

<template>
  <div class="space-y-4">
    <!-- Title -->
    <h2 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">Filtros</h2>

    <!-- Search -->
    <!-- <div>
      <label for="search-games" class="sr-only">Buscar juegos</label>
      <input
        id="search-games"
        type="search"
        :value="searchQuery"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        placeholder="Buscar juego..."
        class="w-full bg-surface-2 border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors duration-200"
      />
    </div> -->

    <!-- Filter row -->
    <div class="flex flex-wrap gap-3 items-center justify-between">
      <div>
        <label for="filter-año" class="sr-only">Filtrar por año</label>
        <select
          id="filter-año"
          :value="selectedAño"
          @change="emit('update:selectedAño', ($event.target as HTMLSelectElement).value)"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors duration-200 cursor-pointer"
        >
          <option value="">Todos los años</option>
          <option v-for="a in años" :key="a" :value="String(a)">{{ a }}</option>
        </select>
      </div>

      <div>
        <label for="filter-estado" class="sr-only">Filtrar por estado</label>
        <select
          id="filter-estado"
          :value="selectedEstado"
          @change="emit('update:selectedEstado', ($event.target as HTMLSelectElement).value)"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors duration-200 cursor-pointer"
        >
          <option value="">Todos los estados</option>
          <option v-for="e in estados" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>

      <div>
        <label for="filter-plataforma" class="sr-only">Filtrar por plataforma</label>
        <select
          id="filter-plataforma"
          :value="selectedPlataforma"
          @change="emit('update:selectedPlataforma', ($event.target as HTMLSelectElement).value)"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors duration-200 cursor-pointer"
        >
          <option value="">Todas las plataformas</option>
          <option v-for="p in plataformas" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>

      <div>
        <label for="filter-marca" class="sr-only">Filtrar por marca</label>
        <select
          id="filter-marca"
          :value="selectedMarca"
          @change="emit('update:selectedMarca', ($event.target as HTMLSelectElement).value)"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-blue/50 transition-colors duration-200 cursor-pointer"
        >
          <option value="">Todas las marcas</option>
          <option v-for="m in marcas" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>

      <!-- Counter -->
      <span class="text-xs text-text-secondary ml-auto">
        <template v-if="hasActiveFilters">
          {{ filteredCount }} de {{ totalGames }}
        </template>
        <template v-else>
          {{ totalGames }} juegos
        </template>
      </span>
    </div>
  </div>
</template>
