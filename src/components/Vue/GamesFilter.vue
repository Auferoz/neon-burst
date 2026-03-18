<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  años: number[];
  estados: string[];
  plataformas: string[];
  selectedAño: string;
  selectedEstado: string;
  selectedPlataforma: string;
  searchQuery: string;
  totalGames: number;
  filteredCount: number;
}>();

const emit = defineEmits<{
  'update:selectedAño': [value: string];
  'update:selectedEstado': [value: string];
  'update:selectedPlataforma': [value: string];
  'update:searchQuery': [value: string];
}>();

const hasActiveFilters = computed(() =>
  props.selectedAño !== '' || props.selectedEstado !== '' || props.selectedPlataforma !== '' || props.searchQuery !== ''
);
</script>

<template>
  <div class="space-y-4">
    <!-- Title -->
    <h2 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">Filtros</h2>

    <!-- Search -->
    <div>
      <label for="search-games" class="sr-only">Buscar juegos</label>
      <input
        id="search-games"
        type="search"
        :value="searchQuery"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        placeholder="Buscar juego..."
        class="w-full bg-surface-2 border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-colors duration-200"
      />
    </div>

    <!-- Filter row -->
    <div class="flex flex-wrap gap-3 items-center">
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

      <!-- Counter -->
      <span class="text-xs text-text-muted ml-auto">
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
