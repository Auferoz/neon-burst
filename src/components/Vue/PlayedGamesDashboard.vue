<script setup lang="ts">
import { computed, type Component } from 'vue';
import IconGamepad from '../Icons/IconGamepad.vue';
import IconPauseCircle from '../Icons/IconPauseCircle.vue';
import IconCheckCircle from '../Icons/IconCheckCircle.vue';
import IconXCircle from '../Icons/IconXCircle.vue';

const props = defineProps<{
  games: { estado: string }[];
}>();

const stats = computed(() => {
  const counts: Record<string, number> = {};
  for (const g of props.games) {
    counts[g.estado] = (counts[g.estado] || 0) + 1;
  }

  return [
    {
      label: 'Jugando',
      count: counts['Jugando'] || 0,
      icon: IconGamepad as Component,
      bg: 'bg-neon-blue/10',
      border: 'border-neon-blue/25',
      text: 'text-neon-blue',
    },
    {
      label: 'Pausado',
      count: counts['Pausado'] || 0,
      icon: IconPauseCircle as Component,
      bg: 'bg-neon-yellow/10',
      border: 'border-neon-yellow/25',
      text: 'text-neon-yellow',
    },
    {
      label: 'Completado',
      count: counts['Completado'] || 0,
      icon: IconCheckCircle as Component,
      bg: 'bg-neon-green/10',
      border: 'border-neon-green/25',
      text: 'text-neon-green',
    },
    {
      label: 'Abandonado',
      count: counts['Abandonado'] || 0,
      icon: IconXCircle as Component,
      bg: 'bg-neon-pink/10',
      border: 'border-neon-pink/25',
      text: 'text-neon-pink',
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2" role="list" aria-label="Resumen de estados">
    <div
      v-for="stat in stats"
      :key="stat.label"
      role="listitem"
      :aria-label="`${stat.count} juegos ${stat.label.toLowerCase()}`"
      :class="[stat.bg, stat.border]"
      class="relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden"
    >
      <div :class="stat.text" class="shrink-0" aria-hidden="true">
        <component :is="stat.icon" :size="20" />
      </div>
      <div class="min-w-0">
        <div :class="stat.text" class="text-lg lg:text-xl font-bold leading-none mb-0.5">
          {{ stat.count }}
        </div>
        <div class="text-[11px] lg:text-xs text-text-secondary truncate">
          {{ stat.label }}
        </div>
      </div>
    </div>
  </div>
</template>
